# 摸鱼大师 — 数据库设计文档

## 概览

| 集合 | 用途 | 写模式 | 读写频率 |
|---|---|---|---|
| `players` | 玩家档案 | 创建 + 更新 | 读高频 / 写低频 |
| `contributions` | 每次通关贡献记录 | 只追加 (append-only) | 写中频 / 读中频 |
| `pond_daily_stats` | 每日鱼塘聚合统计 | 原子更新 (`_.inc` / `_.addToSet`) | 读高频 / 写中频 |
| `pond_streaks` | 连续霸榜天数 | 创建 + 更新 | 读中频 / 写低频 |

---

## `players` — 玩家档案

每个微信用户一条记录，按 `openId` 唯一。

```typescript
{
  openId:          string          // 微信 OpenID（主键）
  pondId:          string          // 当前所在鱼塘 ID
  fishId:          string          // 当前鱼种 ID（见 FISH_IDS）
  avatarUrl:       string          // 微信头像 URL
  nickName:        string          // 微信昵称
  joinDate:        Date            // 首次选塘时间
  lastSwitchDate:  Date | null     // 上次切换鱼塘时间
  switchCount:     number          // 累计切换次数
  visitedPonds:    string[]        // 访问过的鱼塘 ID 列表
  achievements:    Achievement[]   // 已解锁称号
  fishSelectionShown: boolean      // 是否已展示选鱼页
  clearedLevel2:   boolean         // 是否已通关第二关
  createdAt:       Date            // 记录创建时间
  updatedAt:       Date            // 最后更新时间
}

interface Achievement {
  id:           string    // 称号 ID，如 "pond_leader"
  name:         string    // 称号名称，如 "鱼塘领头鱼"
  emoji:        string    // 称号图标
  desc:         string    // 获得条件描述
  unlockedAt:   Date      // 获得时间
}
```

### 索引
- `openId` — 主查询键（默认 `_id` 替代）
- 建议：微信云开发自动为 `_id` 建索引，按 `openId` 查询通过 `where({ openId })` 使用

### 读写云函数
- **写**：`selectFish`（选塘/切换）、`updateAvatar`（更新头像）、`checkAchievements`（写入称号）
- **读**：`selectFish`、`contribute`、`getPondRanking`、`getPondDetail`、`checkAchievements`

### 说明
- `todayContribution` 和 `totalContribution` **不再存储**，改为从 `contributions` 集合实时查询
- `visitedPonds` 记录玩家历史上访问过的所有鱼塘，用于判断是否需要展示选鱼引导

---

## `contributions` — 贡献记录（事件溯源）

每条通关贡献一条记录，**只追加、不修改**，彻底消除并发竞态。

```typescript
{
  _id:             AutoID        // 自动生成
  openId:          string        // 贡献者 OpenID
  pondId:          string        // 贡献到的鱼塘 ID
  fishId:          string        // 贡献时的鱼种（快照）
  avatarUrl:       string        // 贡献时的头像 URL（快照）
  nickName:        string        // 贡献时的昵称（快照）
  date:            string        // 日期 "YYYY-MM-DD"
  createdAt:       Date          // 精确创建时间
}
```

### 索引
- `{ pondId, date }` 复合索引 — 按鱼塘+日期查贡献列表
- `{ openId, date }` 复合索引 — 按玩家+日期查个人贡献
- `{ date }` 单索引 — 查当日全部贡献

### 读写云函数
- **写**：`contribute`（仅 `add`，不修改）
- **读**：`contribute`（count）、`getPondRanking`（聚合）、`getPondDetail`（聚合）、`checkAchievements`（count）

### 设计要点
- 每条记录独立写入，不存在"读→改→写"的数组覆盖问题
- `fishId`、`avatarUrl`、`nickName` 存的是贡献时的快照，即使玩家后来改了鱼种/头像，历史记录不受影响
- 数据量估算：100 日活 × 人均 3 次贡献 = 300 条/天 ≈ 9000 条/月，云开发免费额度内

---

## `pond_daily_stats` — 每日鱼塘统计

按 `pondId + date` 联合唯一。仅存数值型聚合数据，使用原子操作更新。

```typescript
{
  pondId:          string        // 鱼塘 ID
  date:            string        // 日期 "YYYY-MM-DD"
  dailyClears:     number        // 当日通关总次数
  activePlayers:   string[]      // 当日贡献者 OpenID 列表（去重）
}
```

### 索引
- `{ pondId, date }` — 查特定鱼塘当日数据
- `{ date }` — 排行查询（按 dailyClears 排序）

### 读写云函数
- **写**：`contribute`（创建时 `add`、更新时 `_.inc(1)` + `_.addToSet(openId)`）
- **读**：`getPondRanking`、`getPondDetail`

### 原子更新方式

```javascript
// 创建新记录
await db.collection('pond_daily_stats').add({
  data: { pondId, date, dailyClears: 1, activePlayers: [openId] }
})

// 更新已有记录（原子操作，无竞态）
await db.collection('pond_daily_stats').doc(id).update({
  data: {
    dailyClears: _.inc(1),           // 原子递增
    activePlayers: _.addToSet(openId) // 原子去重追加
  }
})
```

### 说明
- `activePlayers.length` 即当日活跃人数，用于计算"人均摸鱼王"
- 不再存储 `contributors` 数组 — 贡献者详情（头像、鱼种）从 `contributions` 集合聚合
- 跨天后自动隔离，每天 12 条记录（12 个鱼塘）

---

## `pond_streaks` — 连续霸榜

按 `pondId` 唯一，记录连续 #1 天数。

```typescript
{
  pondId:            string        // 鱼塘 ID（唯一）
  streakDays:        number        // 连续排名 #1 的天数
  lastRankOneDate:   string        // 最近一次 #1 的日期 "YYYY-MM-DD"
}
```

### 读写云函数
- **写**：`contribute`（排名 #1 时更新 streak）
- **读**：`getPondRanking`、`getPondDetail`

### streak 更新逻辑
```
当日 rank == 1:
  无记录 → 新建 { streakDays: 1, lastRankOneDate: today }
  有记录:
    lastRankOneDate == today  → 不重复计数
    lastRankOneDate == 昨天   → streakDays + 1（连续）
    lastRankOneDate < 昨天    → streakDays = 1（中断，重计）
```

---

## 数据流

```
玩家通关 Level 2
    │
    ├─ 1. selectFish   ──→ players (写入/更新 fishId, pondId, avatarUrl)
    │
    ├─ 2. contribute   ──→ contributions (add 一条贡献)
    │                   ──→ pond_daily_stats (inc dailyClears + addToSet openId)
    │                   ──→ pond_streaks (rank==1 时更新)
    │
    └─ 3. 进入首页
        getPondRanking ──→ pond_daily_stats (排行数据)
                       ──→ contributions (按 openId 聚合 → 贡献者头像+鱼种)
                       ──→ players (我的鱼塘信息)
                       ──→ pond_streaks (霸榜排行)
```

## 鱼种 ID

| ID | 名称 | 图集位置 |
|---|---|---|
| `xiaojinyu` | 小金鱼 | 0 |
| `xianyugan` | 咸鱼干 | 1 |
| `jinli` | 锦鲤 | 2 |
| `hetun` | 河豚 | 3 |
| `moyu` | 墨鱼 | 4 |
| `haima` | 海马 | 5 |
| `feiyu` | 飞鱼 | 6 |
| `zhangyu` | 章鱼 | 7 |
| `bimuyu` | 比目鱼 | 8 |
| `pangxie` | 螃蟹 | 9 |
| `jianyu` | 剑鱼 | 10 |
| `haitun` | 海豚 | 11 |

`__announcer__`（鲨鱼管理员）仅用于鱼塘公告鱼，玩家不可获得。

## 鱼塘 ID

| ID | 名称 |
|---|---|
| `moyutang` | 摸鱼塘 |
| `xianyutang` | 咸鱼塘 |
| `jinlitang` | 锦鲤塘 |
| `hetuntang` | 河豚塘 |
| `moyutang2` | 墨鱼塘 |
| `haimatang` | 海马塘 |
| `feiyutang` | 飞鱼塘 |
| `zhangyutang` | 章鱼塘 |
| `bimuyutang` | 比目鱼塘 |
| `pangxietang` | 螃蟹塘 |
| `jianyutang` | 剑鱼塘 |
| `haituntang` | 海豚塘 |
