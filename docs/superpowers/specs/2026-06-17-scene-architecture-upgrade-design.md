# 场景架构升级设计：JS → TS + 栈式引擎

**日期**: 2026-06-17
**状态**: 已确认

---

## 目标

将主项目的场景管理架构从"单场景替换 + JS + 回调耦合"升级到"栈式场景管理 + TS + EventBus 解耦"，对齐 `example/` 目录的架构设计。

## 关键决策

| 决定 | 选择 |
|---|---|
| 迁移方式 | 在主项目原地改造（方案 B） |
| PixiJS 版本 | v7 (legacy)，不升级 |
| TypeScript | 全部转 TS，strict 模式 |
| 构建工具 | esbuild 打包为 `game.js` |
| 目录结构 | 对齐 example（engine/scenes/core/config/views/platform） |
| Game 类 | 消除，入口文件做初始化 |
| 游戏逻辑分离 | 严格分离：core/ 纯逻辑，views/ 纯渲染 |
| 功能范围 | 全部保留（技能系统、多关卡、百搭牌、步数管理、快乐值） |
| example/ 处理 | 保留不删 |
| pixi-legacy | npm 包 + esbuild 打包，外部文件删除 |

---

## 一、目录结构

```
src/
├── main.ts                    # 浏览器入口（开发调试用）
├── main.minigame.ts           # 微信小游戏入口
├── bootstrap.ts               # PixiJS Application 初始化
├── engine/
│   ├── Scene.ts               # 场景基类（完整生命周期 + 自动清理）
│   ├── SceneManager.ts        # 栈式场景管理（push/pop/replace）
│   ├── EventBus.ts            # 通用发布-订阅
│   └── EventManager.ts        # 触摸命中检测
├── scenes/
│   ├── MenuScene.ts           # 主菜单
│   ├── GameScene.ts           # 游戏主场景
│   └── overlays/
│       ├── PauseOverlay.ts    # 暂停覆盖层
│       └── ResultOverlay.ts   # 结算覆盖层
├── core/
│   ├── types.ts               # 公共类型定义
│   ├── GameLogic.ts           # 纯游戏逻辑（零 Pixi 依赖）
│   ├── Board.ts               # 棋盘逻辑
│   ├── Card.ts                # 卡片实体
│   ├── SlotBar.ts             # 卡槽逻辑
│   ├── StepManager.ts         # 步数/失败管理
│   └── SkillSystem.ts         # 技能触发与效果
├── config/
│   ├── cards.ts               # 卡片定义
│   ├── levels.ts              # 关卡配置
│   └── skills.ts              # 技能定义
├── views/
│   ├── Button.ts              # 可复用按钮
│   └── CardView.ts            # 卡片渲染组件
├── platform/
│   ├── storage.ts             # 跨平台存储
│   └── PixiAdapter.ts         # 微信 DOM API polyfill
└── utils/
    └── Logger.ts              # 日志工具
```

---

## 二、引擎层：Scene 基类

### 生命周期

```
push/replace
    ↓
_mount(manager, bus)     ← 注入 SceneManager 和 EventBus
    ↓
onEnter(params)           ← 首次进入，创建 UI
    ↓
onResume()               ← 获取焦点（push后 / pop上层后）
    ↓
onUpdate(dt) ←→ onUpdate(dt) ←→ ...  ← 每帧循环
    ↓
onPause()                ← 失去焦点（上层 push）
    ↓
onExit()                 ← 即将被弹出栈
    ↓
_teardown()              ← 自动：取消订阅 → onDestroy → destroy 容器
    ↓
onDestroy()              ← 最终清理钩子
```

### 关键机制

- `listen<T>(event, handler)`：订阅 EventBus，自动登记到 `_disposers`，`_teardown` 时批量取消
- `this.container`：Scene 专属 PIXI Container，`_teardown` 时 `container.destroy({ children: true })`
- `this.manager` / `this.bus`：通过 `_mount()` 注入，Scene 内直接使用

---

## 三、引擎层：SceneManager

### 栈模型

```
     ┌──────────────────┐
     │   ResultOverlay  │  ← top (active: update + render)
     ├──────────────────┤
     │   GameScene      │  ← paused (render only, visible under overlay)
     ├──────────────────┤
     │   MenuScene      │  ← paused / destroyed
     └──────────────────┘
```

### 操作

| 操作 | 行为 | 典型用途 |
|---|---|---|
| `push(scene, params?)` | 暂停当前 → 挂载新场景 → onEnter → onResume | 暂停覆盖层、结算弹窗 |
| `pop()` | onExit → teardown → 恢复下层 onResume | 关闭弹窗 |
| `replace(scene, params?)` | 清空栈（全部 teardown）→ push 新场景 | 菜单→游戏、结算→菜单 |

渲染：每帧 `update(dt)` 只发给栈顶场景。栈中所有场景的 container 保留在 stage 上，覆盖层后面可见底层画面。

---

## 四、引擎层：EventBus

### 接口

```typescript
class EventBus {
  on<T>(event: string, handler: (payload: T) => void): () => void
  off<T>(event: string, handler: (payload: T) => void): void
  emit<T>(event: string, payload?: T): void
}
```

### 事件契约

| 事件 | 发出者 | Payload | 订阅者 |
|---|---|---|---|
| `boardInit` | Board | `{ cards: CardData[] }` | GameScene |
| `stepsChanged` | StepManager | `{ remaining: number }` | GameScene |
| `cardToSlot` | Board | `{ card: CardData, slotIndex: number }` | GameScene |
| `boardChanged` | Board | `{ cards: {uid, blocked}[] }` | GameScene |
| `eliminated` | SlotBar | `{ uids: string[], happiness: number }` | GameScene, SkillSystem |
| `happyChanged` | SkillSystem | `{ value: number }` | GameScene |
| `skillTriggered` | SkillSystem | `{ skill: SkillDef }` | GameScene |
| `skillApplied` | GameScene | `{ skill: SkillDef }` | Board/SlotBar |
| `gameOver` | GameLogic | `{ win, happiness, levelId, stepsUsed }` | GameScene |

EventManager 保留不变，继续负责触摸命中检测。

---

## 五、游戏逻辑层：core/

### 原则

所有 core/ 类**不 import PixiJS**，只操作纯数据结构，通过 EventBus 通知变化。

### 模块职责

| 模块 | 职责 | 输入 | 输出（emit） |
|---|---|---|---|
| GameLogic | 协调一盘游戏的完整流程 | 关卡配置 + EventBus | gameOver |
| Board | 卡片生成、覆盖判定、点击取卡 | level config | boardInit, cardToSlot, boardChanged |
| Card | 纯数据：uid, type, emoji, blocked, layer, position | — | — |
| SlotBar | 7格卡槽：插入、三连消除 | card uid | eliminated |
| StepManager | 步数管理、失败判定 | 每步动作 | stepsChanged, gameOver(fail) |
| SkillSystem | 累计消除触发技能 | eliminated 事件 | skillTriggered, skillApplied |

---

## 六、场景导航流

```
app 启动
   ↓
MenuScene ──replace(GameScene, { levelId })──→ GameScene
                                                    │
                        ┌───────────────────────────┤
                        ↓                           ↓
                 push(PauseOverlay)          push(ResultOverlay, { result })
                        │                           │
                        ↓                           ↓
                   pop() 恢复                 replace(MenuScene)
                                              replace(GameScene) 重玩
```

---

## 七、视图层：views/

| 组件 | 职责 | 依赖 |
|---|---|---|
| Button | 文本 + 背景矩形 + 命中区域 | EventManager, PIXI |
| CardView | 卡片 emoji + 圆角背景 + 遮挡灰显 + 选中高亮 | PIXI |

GameScene 维护 `cardViews: Map<string, CardView>`，监听 `boardInit` 创建视图，监听 `eliminated` 销毁视图。

---

## 八、平台适配

- `platform/PixiAdapter.ts`：polyfill window/document/requestAnimationFrame（微信环境）
- `platform/storage.ts`：抽象 localStorage / wx.setStorageSync
- 入口文件加载顺序：polyfill 必须放在最前面

---

## 九、构建工具链

- **构建**：esbuild `src/main.minigame.ts` → 单文件 `game.js`（CJS 格式）
- **类型检查**：`tsc --noEmit`
- **依赖**：`pixi.js-legacy` (npm)，替代 `libs/pixi-legacy.min.js`
- `libs/pixi-unsafe-eval-v7.js` 保留

---

## 十、文件变更汇总

| 操作 | 文件/目录 |
|---|---|
| 删除 | `src/core/Game.js` |
| 删除 | `src/core/Scene.js` |
| 删除 | `src/core/SceneManager.js` |
| 升级 | `src/core/EventManager.js` → `engine/EventManager.ts` |
| 新增 | `engine/EventBus.ts` |
| 新增 | `engine/Scene.ts`, `engine/SceneManager.ts` |
| 重写 | `src/scenes/MenuScene.js` → `scenes/MenuScene.ts` |
| 重写 | `src/scenes/GameScene.js` → `scenes/GameScene.ts` |
| 重写 | `src/scenes/ResultScene.js` → `scenes/overlays/ResultOverlay.ts` |
| 新增 | `scenes/overlays/PauseOverlay.ts` |
| 拆分 | `src/game/*.js` → `core/*.ts` + `views/*.ts` |
| 迁移 | `src/data/*.js` → `config/*.ts` |
| 升级 | `src/wechat/PixiAdapter.js` → `platform/PixiAdapter.ts` |
| 新增 | `platform/storage.ts` |
| 新增 | `package.json`, `tsconfig.json` |
| 新增 | `src/bootstrap.ts`, `src/main.ts`, `src/main.minigame.ts` |
| 外部化 | `libs/pixi-legacy.min.js` → npm + esbuild |

---

## 十一、迁移顺序

| 步骤 | 内容 | 验证方式 |
|---|---|---|
| 1. 搭骨架 | package.json, tsconfig.json, bootstrap.ts, 入口文件，安装依赖 | `npm run build` 产出空白 Pixi 的 game.js |
| 2. 引擎三件套 | Scene, SceneManager, EventBus, EventManager | dummy Scene 验证 push/pop 生命周期 |
| 3. MenuScene | 迁移至新基类 | 菜单画面可见，点击触发 replace |
| 4. 核心逻辑 | GameLogic, Board, Card, SlotBar, StepManager, SkillSystem 纯逻辑 | 浏览器端模拟事件流验证 |
| 5. GameScene | 事件驱动重写，CardView, Button | 完整一盘游戏可玩 |
| 6. 覆盖层 | PauseOverlay, ResultOverlay | 暂停/恢复、结算弹窗 |
| 7. 配置与存储 | config/, platform/storage.ts | 多关卡切换，最高分持久化 |

---

## 十二、错误处理

- 场景切换异常不破坏栈状态
- pop 空栈忽略
- EventBus handler 异常不影响其他 handler
- GameLogic 暴露只读状态，防止外部意外修改
- `_teardown()` 保证即使回调抛异常也能完成清理

---

## 十三、架构对比总结

| 维度 | 改造前 | 改造后 |
|---|---|---|
| 场景管理 | 单场景替换 | 栈式 push/pop/replace |
| 生命周期 | 4 钩子 | 6 钩子 + 自动清理 |
| 事件通信 | 回调闭包链 | EventBus 发布-订阅 |
| 逻辑与渲染 | 混在 Scene 里 | core/ 纯逻辑 + views/ 渲染 |
| 覆盖层 | 无 | PauseOverlay + ResultOverlay |
| 类型 | JavaScript | TypeScript (strict) |
| 构建 | 无 | esbuild → game.js |
| God Object | Game.js | 消除 |
