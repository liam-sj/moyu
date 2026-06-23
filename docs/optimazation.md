# 云函数调用与数据库读写优化方案

## Context

当前项目每个典型游戏会话（进首页 → 通关关卡1 → 通关关卡2 → 选鱼塘 → 回首页）产生 **~10 次云函数调用、~44-53 次 DB 查询**。主要问题：

1. `selectFish` + `contribute` 串行调用，共享一次 `players` 读取却跑了两次
2. `contribute` 内部有冗余查询（重复读 `pond_daily_stats`、贡献时算排名）
3. `getPondRanking` 被调用 2-3 次/会话，每次 5 次 DB 查询
4. `getPondDetail` 中 `myCount` 可从已有数据内存计算却多一次 count 查询
5. 存在死代码（`onGameOver` 中 `contribute` 调用永不可达）和废逻辑（`user_avatar` 读取永不命中）
6. `SelectFishScene` 调用 3 次云函数（selectFish + updateAvatar + contribute），其中 updateAvatar 写入被 selectFish 覆盖

## 优化后预期

| 指标 | 优化前 | 优化后 | 降幅 |
|------|-------|-------|------|
| 每会话云函数调用 | ~10 次 | ~3-4 次 | **60-70%** |
| 每会话 DB 查询 | ~44-53 次 | ~12-14 次 | **~70%** |
| `getPondRanking` 每次查询数 | 5 | 4（并行） | 20% |
| `getPondDetail` 每次查询数 | 5 | 3（并行） | 40% |
| 首页进入（5分钟缓存命中） | 1 次 5 查询 | 0 次 0 查询 | **100%** |

---

## Phase 1：修复死代码（零风险，立即收益）

### 1.1 删除 GameScene.onGameOver 中的死代码

**文件**: `src/scenes/GameScene.ts`

`onGameOver` 中 line 1467 判断 `levelId === 'level2'` 后直接 `return`，line 1477 的 `if (cachedPond && this.levelId === 'level2')` 永不可达。

**操作**: 删除 lines 1474-1488（`contribute` 调用块），保留 `checkAchievements` 调用。

### 1.2 删除死 `user_avatar` 读取

**文件**: `src/scenes/GameScene.ts`, lines 1431-1433

`wx.getStorageSync('user_avatar')` 全项目无任何代码写入此 key，永远返回空。

**操作**: 删除 `if (!avatarUrl) { try { avatarUrl = wx.getStorageSync('user_avatar') || '' } catch (e) {} }` 三行。

---

## Phase 2：合并云函数（减少调用次数）

### 2.1 新建 `selectAndContribute` 云函数

**新建**: `cloudfunctions/selectAndContribute/index.js`, `cloudfunctions/selectAndContribute/package.json`

合并 `selectFish(action=select)` + `contribute` 为一次调用，共享 `players` 读取：

```
入参: { fishId, pondId, avatarUrl, nickName, fishSelectionShown?, checkAchievements? }

执行流程:
1. 读 players（1 次读）
2. 写/更新 players（1 次写）— 包含 selectFish 全部字段 + fishSelectionShown
3. 写 contributions（1 次写）
4. 读+写 pond_daily_stats（1 读 + 1 写）
5. 读 contributions count where openId+date（1 读，和步骤4并行）
6. 条件：读+写 pond_streaks（仅在当日清除数领先时）
7. 可选：checkAchievements 逻辑（入参 checkAchievements=true 时执行）

总查 询: 5-6 次（原来 selectFish + contribute 合计 8-10 次）

返回: { ok, pondName, fishEmoji, todayContribution, pondClears, newAchievements? }
注意：不返回 rank（贡献时不需要排名，排名由 getPondRanking 负责）
```

### 2.2 更新 GameScene._joinPondAsync

**文件**: `src/scenes/GameScene.ts`, lines 1436-1443

```typescript
// 之前: 2 次调用
await wx.cloud.callFunction({ name: 'selectFish', data: {...} })
const conRes = await wx.cloud.callFunction({ name: 'contribute', data: {} })

// 之后: 1 次调用
const conRes = await wx.cloud.callFunction({
  name: 'selectAndContribute',
  data: { fishId, pondId, avatarUrl, nickName, checkAchievements: true }
})
```

### 2.3 更新 SelectFishScene._doSelect

**文件**: `src/scenes/SelectFishScene.ts`, lines 118-133

```typescript
// 之前: 3 次调用 (selectFish + updateAvatar + contribute)
// 之后: 1 次调用
const res = await wx.cloud.callFunction({
  name: 'selectAndContribute',
  data: { fishId: pond.fishId, pondId: pond.id, avatarUrl, nickName, fishSelectionShown: true }
})
```

`fishSelectionShown: true` 原本由 `updateAvatar` 写入，现在直接在 `selectAndContribute` 的 players 更新中写入，省掉整个 `updateAvatar` 调用。

### 2.4 保留 MenuScene._applyAvatar 中的 updateAvatar

**文件**: `src/scenes/MenuScene.ts`, lines 240-245

此处的 `updateAvatar` 独立于选鱼流程（只在用户点击授权按钮时触发），保持不变。

---

## Phase 3：优化云函数内部查询（减少每次调用 DB 量）

### 3.1 优化 `contribute`（保留独立版本做兼容）

**文件**: `cloudfunctions/contribute/index.js`

改动：
- **新增可选参数**: 接受 `pondId, fishId, avatarUrl, nickName` 从客户端传入；若提供则跳过 `players` 读取，省 1 次查询
- **删除步骤5**: 重复读 `pond_daily_stats`（步骤3刚更新过），改为从步骤3/4结果中直接计算 `pondClears`
- **删除步骤6**: 读全量 `pond_daily_stats` 算排名 — 贡献时不需要返回排名，由 `getPondRanking` 负责
- **并行化**: 步骤4的 `pond_daily_stats` 更新与 `contributions` count 查询用 `Promise.all` 并行

**效果**: 6-8 次查询 → 4-5 次

### 3.2 优化 `getPondRanking`

**文件**: `cloudfunctions/getPondRanking/index.js`

改动：
- **删除步骤4**: `contributions.where({ openId, date }).count()` — 步骤2已拉取全量贡献，内存过滤即可：`allContribs.data.filter(c => c.openId === openId).length`
- **并行化**: 步骤1/2/3/5 四个独立查询用 `Promise.all` 并行

```javascript
const [ponds, allContribs, playerRes, streaks] = await Promise.all([
  safeGet(db.collection('pond_daily_stats').where({ date }).orderBy('dailyClears', 'desc')),
  safeGet(db.collection('contributions').where({ date })),
  openId ? safeGet(db.collection('players').where({ openId })) : Promise.resolve({ data: [] }),
  safeGet(db.collection('pond_streaks').orderBy('streakDays', 'desc'))
])
const myContribCount = allContribs.data.filter(c => c.openId === openId).length
```

**效果**: 5 次查询 → 4 次，且执行时间从串行变并行

### 3.3 优化 `getPondDetail`

**文件**: `cloudfunctions/getPondDetail/index.js`

改动：
- **删除步骤5**: `contributions.where({ openId, pondId, date }).count()` — 步骤3已拉取该鱼塘全部贡献，内存过滤：`contribs.data.filter(c => c.openId === openId).length`
- **合并步骤1+2**: 步骤2拉取全量 `pond_daily_stats`，其中已包含目标鱼塘数据，无需步骤1单独查
- **并行化**: 剩余 3 个查询用 `Promise.all`

```javascript
const [allPonds, contribs, streakResult] = await Promise.all([
  safeGet(db.collection('pond_daily_stats').where({ date }).orderBy('dailyClears', 'desc')),
  safeGet(db.collection('contributions').where({ pondId, date })),
  safeGet(db.collection('pond_streaks').where({ pondId }))
])
const stat = allPonds.data.find(p => p.pondId === pondId) || { dailyClears: 0, activePlayers: [] }
const rank = allPonds.data.findIndex(p => p.pondId === pondId) + 1
const myContribution = contribs.data.filter(c => c.openId === openId).length
```

**效果**: 5 次查询 → 3 次，且并行执行

---

## Phase 4：客户端缓存（减少调用频率）

### 4.1 新建缓存模块

**新建**: `src/config/rankingCache.ts`

遵循 `ponds.ts` 中 `getCachedPond`/`setCachedPond` 的既有模式：

```typescript
// 排行缓存（公共数据，5 分钟 TTL）
const RANKING_CACHE_KEY = 'pond_ranking_cache'
const RANKING_CACHE_TTL = 5 * 60 * 1000

export function getCachedRanking(): any | null  // 检查 TTL
export function setCachedRanking(data: any): void
export function clearRankingCache(): void

// 鱼塘详情缓存（公共数据，2 分钟 TTL）
const DETAIL_CACHE_KEY = 'pond_detail_cache'
const DETAIL_CACHE_TTL = 2 * 60 * 1000

export function getCachedDetail(pondId: string): any | null
export function setCachedDetail(pondId: string, data: any): void
export function clearDetailCache(pondId?: string): void  // pondId 为空则全清
```

使用 `wx.getStorageSync`/`setStorageSync`（微信小游戏中可用），CLAUDE.md 的"不用本地存游戏数据"限制不适用——排行和详情是公共只读数据，不是用户游戏状态。

### 4.2 MenuScene._loadRealCounts 使用排行缓存

**文件**: `src/scenes/MenuScene.ts`

```typescript
private async _loadRealCounts(w: number, barY: number): Promise<void> {
  // 先检查缓存
  const cached = getCachedRanking()
  if (cached) {
    this._rankingCloudData = cached
    this._renderWithCloudData(cached, w, barY)
    return
  }
  // 缓存未命中，走云函数
  const res = await wx.cloud.callFunction({ name: 'getPondRanking', data: {} })
  const data = (res as any).result
  if (data?.ok) {
    setCachedRanking(data)
    this._rankingCloudData = data
  }
  this._renderWithCloudData(data, w, barY)
}
```

### 4.3 GameScene._showPondPicker 使用排行缓存

**文件**: `src/scenes/GameScene.ts`, `_showPondPicker` 中的 `getPondRanking` 调用

同样先查缓存，缓存命中则跳过云函数调用。

### 4.4 PondDetailScene + MenuScene 鱼塘详情使用详情缓存

**文件**: `src/scenes/PondDetailScene.ts`, `src/scenes/MenuScene.ts`

两处 `getPondDetail` 调用前先查缓存。

### 4.5 写入后清缓存

**文件**: `src/scenes/GameScene.ts` (`_joinPondAsync` 后), `src/scenes/SelectFishScene.ts` (`_doSelect` 后)

成功调用 `selectAndContribute` 后执行 `clearRankingCache()` + `clearDetailCache()`，确保下次拉取到最新数据。

---

## Phase 5：checkAchievements 内嵌

### 5.1 selectAndContribute 内嵌成就检查

**文件**: `cloudfunctions/selectAndContribute/index.js`

当入参 `checkAchievements === true` 时，在贡献记录完成后执行成就检查逻辑：
- `myCount` 已在步骤5算好，复用
- 成就逻辑与 `checkAchievements/index.js` 一致
- 新成就写入 `players` 时复用已有的 player doc reference

返回值增加 `newAchievements` 字段。

### 5.2 更新 GameScene 通关流程

**文件**: `src/scenes/GameScene.ts`

- **关卡1 胜利**: 保持独立的 `checkAchievements` 调用（关卡1无贡献，不触发 selectAndContribute）
- **关卡2 胜利**: 成就检查已内嵌在 `selectAndContribute` 中，删除独立的 `checkAchievements` 调用。注意处理 `_showFishResult` → `_showPondPicker` → `_joinPondAsync` 的链路中把 `newAchievements` 传出来展示 toast。

---

## 实施顺序

```
Phase 1 (零风险，先做)
  ├─ 1.1 删除 onGameOver 死代码 (GameScene.ts)
  └─ 1.2 删除 user_avatar 死读取 (GameScene.ts)

Phase 2 (核心收益，依赖 Phase 1)
  ├─ 2.1 新建 selectAndContribute 云函数
  ├─ 2.2 更新 GameScene._joinPondAsync
  ├─ 2.3 更新 SelectFishScene._doSelect
  └─ 2.4 MenuScene._applyAvatar 保持不变

Phase 3 (DB 瘦身，可与 Phase 2 并行)
  ├─ 3.1 优化 contribute 接受客户端参数 + 删冗余查询
  ├─ 3.2 优化 getPondRanking 删冗余 + 并行
  └─ 3.3 优化 getPondDetail 合并查询 + 删冗余 + 并行

Phase 4 (缓存层，依赖 Phase 3 确定返回结构)
  ├─ 4.1 新建 rankingCache.ts
  ├─ 4.2 MenuScene 用排行缓存
  ├─ 4.3 GameScene 用排行缓存
  ├─ 4.4 详情缓存
  └─ 4.5 写入后清缓存

Phase 5 (锦上添花)
  ├─ 5.1 selectAndContribute 内嵌成就检查
  └─ 5.2 更新通关流程
```

## 验证方式

1. **语法检查**: 每个 cloud function 修改后执行 `node -c cloudfunctions/<name>/index.js`
2. **TypeScript 检查**: `npm run type-check`
3. **构建检查**: `npm run build` 确认 game.js 正常产出
4. **功能回归测试**（微信开发者工具模拟器）:
   - 首页加载 → 确认排行数据正常展示
   - 选鱼 → 只触发 1 次云函数调用（之前 3 次）
   - 通关关卡1 → checkAchievements 正常
   - 通关关卡2 → 选鱼塘 → 只触发 1 次云函数调用（之前 3 次），成就 toast 正常
   - 再次进首页 → 排行缓存命中，无云函数调用
5. **缓存 TTL 验证**: 等 5 分钟后重新进首页，确认缓存过期后重新拉取

## 关键文件清单

| 文件 | 操作 |
|------|------|
| `src/scenes/GameScene.ts` | 删死代码，改 `_joinPondAsync`，改 `_showPondPicker` 加缓存，删 onGameOver 中独立 checkAchievements |
| `src/scenes/SelectFishScene.ts` | 改 `_doSelect` 为单次 `selectAndContribute`，删 updateAvatar 调用 |
| `src/scenes/MenuScene.ts` | `_loadRealCounts` 加排行缓存，详情调用加缓存 |
| `src/scenes/PondDetailScene.ts` | `_loadDetail` 加详情缓存 |
| `src/config/rankingCache.ts` | 新建缓存模块 |
| `cloudfunctions/selectAndContribute/` | 新建合并云函数 |
| `cloudfunctions/contribute/index.js` | 接受客户端参数，删冗余查询 |
| `cloudfunctions/getPondRanking/index.js` | 删冗余 count + 并行化 |
| `cloudfunctions/getPondDetail/index.js` | 合并查询 + 删冗余 + 并行化 |