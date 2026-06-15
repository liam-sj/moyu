# 摸鱼大师 Phase 1 — 可玩原型设计

## 一期范围

核心三消玩法：棋盘堆叠点击 → 槽位消除 → 肉鸽技能 → 双重限制 → 通关/失败结算。不含局外成长、每日词条、签到、广告变现、音效等。

## 技术选型

- **引擎**：PixiJS v7 (pixi-legacy, Canvas 渲染)
- **适配**：PixiAdapter（DOM shim），从 minigame-1 项目复用
- **架构**：Scene-driven（MenuScene → GameScene → ResultScene）
- **渲染**：纯文字卡片（emoji + 中文），PIXI.Graphics 圆角矩形 + PIXI.Text，零图片资源

## 文件结构

```
moyu-master/
├── game.js                          # 入口：PixiAdapter.install() → 加载 PixiJS → new Game()
├── game.json                        # deviceOrientation: portrait
├── libs/                            # 从 minigame-1 复制
│   ├── pixi-legacy.min.js
│   └── pixi-unsafe-eval-v7.js
├── src/
│   ├── wechat/PixiAdapter.js        # 从 minigame-1 复制
│   ├── core/
│   │   ├── Game.js                  # PIXI.Application + SceneManager + EventManager
│   │   ├── Scene.js                 # 基类：onEnter/update/render/onExit
│   │   ├── SceneManager.js          # 场景切换（switchTo, _applyPendingSwitch）
│   │   └── EventManager.js          # 触摸 hit area 管理
│   ├── scenes/
│   │   ├── MenuScene.js             # 标题 + 开始按钮
│   │   ├── GameScene.js             # ★ 核心：棋盘 + 槽位 + 技能 + HUD
│   │   └── ResultScene.js           # 通关/失败结算
│   ├── game/
│   │   ├── Board.js                 # 棋盘：卡片堆叠、遮挡检测
│   │   ├── Card.js                  # 卡片实体
│   │   ├── SlotBar.js              # 槽位栏（7格）
│   │   ├── SkillSystem.js          # 肉鸽技能
│   │   └── StepManager.js          # 步数+槽位双重限制
│   ├── data/
│   │   ├── cards.js                 # 7基础卡 + 功能卡配置
│   │   ├── skills.js               # 17个技能池
│   │   └── levels.js               # 第一关/第二关参数
│   ├── ui/Button.js                 # PIXI 按钮
│   └── utils/Logger.js             # 日志
```

## 核心组件设计

### Board（棋盘）

二维网格 + 层级数组：

```
grid[layer][row][col] → Card | null
```

- **generate(level)**：根据关卡参数生成堆叠，确保总数是3的倍数
- **isCovered(card)**：检查上层同位置及相邻4格是否有卡片覆盖
- **getClickableCards()**：返回所有可见且未被压住的卡片
- **onCardClicked(card)**：移除卡片，释放下层，返回被释放的卡片列表

**第二关生成策略**：稀有卡压底层（上覆2-3张），可见同种最多2张（第3张必被压），❓事件卡放顶层。

### Card（卡片实体）

PIXI.Container 结构：
- 圆角矩形背景 (PIXI.Graphics)
- Emoji 图标 (PIXI.Text, fontSize: 28)
- 中文名称 (PIXI.Text, fontSize: 14)
- 底部颜色条（普通灰/稀有金/❓紫/负面红/正面绿）

属性：id, type(normal|event), cardId, layer, row, col, isRevealed, isRemoved

### SlotBar（槽位栏）

7格槽位，屏幕底部横排。
- **addCard(card)**：飞入动画(300ms缓动) → 检查消除
- **checkMatch(card)**：同类型≥3张触发消除动画
- **isFull()**：7格全满 → 失败条件
- **getVacantCount()**：空格数统计

### StepManager（双重限制）

| 限制 | 说明 | 失败条件 |
|------|------|----------|
| 步数 | 每次点击-1 | 步数=0 |
| 槽位 | 7格上限 | 槽满且无法消除 |

两者独立，同时为空时游戏结束。

### SkillSystem（肉鸽技能）

- **触发**：每消除3组(9张) → 弹出三选一
- **技能池**：15个常规 + 2个传说（S16忘记打卡、S17无人办公室）
- **执行**：技能选完后立即生效，持续型技能在 StepManager 中跟踪剩余次数/步数

## 场景流程

```
MenuScene ──[开始]──> GameScene ──[通关/失败]──> ResultScene
                         ↑                            |
                         └───[再来一局]───────────────┘
```

### GameScene 核心循环

```
1. 棋盘生成 → 渲染卡片堆叠
2. 玩家点击可点击卡片
3. 步数-1，卡片飞入槽位
4. 槽位检查消除（3同卡）
5. 消除3组 → 弹出技能三选一
6. 检查胜负条件 → 结算或继续
```

## 数据配置

### 第一关（教学关）
- 卡片种类：3-4种普通卡 + 1-2种轻度负面❓
- 层数：1-2层
- 步数：30步
- 通关率目标：~100%

### 第二关（挑战关）
- 卡片种类：6-8种 + 全部功能卡
- 层数：3-5层
- 步数：35步
- 通关率目标：3%-8%

## 复用清单（从 minigame-1）

| 文件 | 来源 | 修改 |
|------|------|------|
| `libs/pixi-legacy.min.js` | 直接复制 | 无 |
| `libs/pixi-unsafe-eval-v7.js` | 直接复制 | 无 |
| `src/wechat/PixiAdapter.js` | 直接复制 | 无 |
| `src/core/Scene.js` | 直接复制 | 无 |
| `src/core/SceneManager.js` | 直接复制 | 无 |
| `src/core/EventManager.js` | 直接复制 | 无 |
| `src/ui/Button.js` | 直接复制 | 颜色/样式调整 |
| `src/utils/Logger.js` | 直接复制 | 无 |
| `src/core/Game.js` | 参考改写 | 去除云服务/CatStats，替换场景 |
