# 场景架构升级实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将主项目从"单场景替换 + JS + 回调耦合"升级为"栈式场景管理 + TS + EventBus 解耦"，严格分离逻辑与渲染。

**Architecture:** 7 步增量迁移，每步产出可运行的 game.js。引入 engine/（Scene、SceneManager、EventBus、EventManager），纯逻辑 core/（GameLogic、Board、Card、SlotBar、StepManager、SkillSystem），渲染层 views/，覆盖层 scenes/overlays/，平台层 platform/。入口文件替代 Game 类。

**Tech Stack:** TypeScript (strict) + PixiJS v7 legacy + esbuild + WeChat Mini-Game API

---

### Task 1: 搭骨架 — package.json / tsconfig / 构建 / 入口

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/bootstrap.ts`
- Create: `src/main.ts`
- Create: `src/main.minigame.ts`
- Modify: `game.js`（入口重写）
- Delete: `libs/pixi-legacy.min.js`（改用 npm 包）
- Create: `.gitignore`（补 node_modules）

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "moyu-master",
  "version": "2.0.0",
  "description": "摸鱼大师 - 微信小游戏（PixiJS v7 + TypeScript 栈式架构）",
  "type": "module",
  "scripts": {
    "dev": "esbuild src/main.ts --bundle --outfile=dist/bundle.js --sourcemap --watch --servedir=.",
    "build": "esbuild src/main.minigame.ts --bundle --format=iife --outfile=game.js --platform=browser --global-name=game",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "pixi.js-legacy": "^7.4.2"
  },
  "devDependencies": {
    "@types/wechat-miniprogram": "^3.4.10",
    "esbuild": "^0.28.1",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: 安装依赖**

Run: `cd C:/Users/lenovo/WeChatProjects/moyu-master && npm install`
Expected: node_modules 生成，无错误

- [ ] **Step 3: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "lib": ["ES2020", "DOM"],
    "types": ["wechat-miniprogram"],
    "outDir": "./dist",
    "rootDir": "./src",
    "sourceMap": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4: 创建 src/bootstrap.ts**

```typescript
import * as PIXI from 'pixi.js-legacy'

export const GAME_WIDTH = 750
export const GAME_HEIGHT = 1334

export function createApp(canvas?: HTMLCanvasElement): PIXI.Application {
  return new PIXI.Application({
    view: canvas || undefined,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: 0x2C3E50,
    backgroundAlpha: 1,
    antialias: false,
    resolution: 1,
    autoDensity: false,
    forceCanvas: true,
  })
}
```

- [ ] **Step 5: 创建 src/main.ts（浏览器调试入口）**

```typescript
import { createApp } from './bootstrap'
import { SceneManager } from './engine/SceneManager'
import { MenuScene } from './scenes/MenuScene'

const app = createApp()
document.body.appendChild(app.view as HTMLCanvasElement)

const manager = new SceneManager(app.stage)
manager.push(new MenuScene())

app.ticker.add(() => {
  manager.eventManager.clearHitAreas()
  manager.update(app.ticker.deltaMS / (1000 / 60))
  app.renderer.render(app.stage)
})
```

注意：浏览器入口需要 `pixi.js` 而非 `pixi.js-legacy`，但开发阶段用 legacy 也可以。这里的 import 在构建时由 esbuild 处理，实际微信入口用 `main.minigame.ts`。

- [ ] **Step 6: 创建 src/main.minigame.ts（微信入口）**

```typescript
// ★ polyfill 必须在最前面
import { installPolyfills, getMainCanvas } from './platform/PixiAdapter'
installPolyfills()

import * as PIXI from 'pixi.js-legacy'
import './libs/pixi-unsafe-eval-v7'

// 安全 eval 补丁
PIXI.settings.FAIL_IF_MAJOR_PERFORMANCE_CAVEAT = false
;(function () {
  function _noop() {}
  try {
    if ((PIXI as any).Renderer?.prototype) {
      (PIXI as any).Renderer.prototype._unsafeEvalCheck = _noop
    }
    if ((PIXI as any).CanvasRenderer?.prototype) {
      (PIXI as any).CanvasRenderer.prototype._unsafeEvalCheck = _noop
    }
  } catch (e) {}
  try {
    ;(PIXI as any).unsafeEvalSupported = function () { return true }
  } catch (e) {}
})()

import { createApp } from './bootstrap'
import { SceneManager } from './engine/SceneManager'
import { MenuScene } from './scenes/MenuScene'

const canvas = getMainCanvas()
const app = createApp(canvas)

const manager = new SceneManager(app.stage)

// 帧循环
app.ticker.add(() => {
  manager.eventManager.clearHitAreas()
  manager.update(app.ticker.deltaMS / (1000 / 60))
  app.renderer.render(app.stage)
})

// 启动
manager.push(new MenuScene())
```

注意：此时 SceneManager、MenuScene 等还未创建，此文件暂时无法 `npm run build`。等 Task 2/3 完成即可构建。

- [ ] **Step 7: 创建 .gitignore**

```
node_modules/
dist/
*.js.map
.DS_Store
```

- [ ] **Step 8: 删除 libs/pixi-legacy.min.js**

Run: `rm C:/Users/lenovo/WeChatProjects/moyu-master/libs/pixi-legacy.min.js`

- [ ] **Step 9: 保留 libs/pixi-unsafe-eval-v7.js**

不做任何操作，在 `main.minigame.ts` 中通过 import 引用。

- [ ] **Step 10: 提交**

```bash
git add package.json tsconfig.json .gitignore src/bootstrap.ts src/main.ts src/main.minigame.ts
git rm libs/pixi-legacy.min.js
git commit -m "feat: 搭骨架 — npm/esbuild/TS 构建体系 + 入口文件"
```

---

### Task 2: 引擎三件套 — Scene / SceneManager / EventBus / EventManager

**Files:**
- Create: `src/engine/EventBus.ts`
- Create: `src/engine/Scene.ts`
- Create: `src/engine/SceneManager.ts`
- Create: `src/engine/EventManager.ts`（从 src/core/EventManager.js 升级）
- Create: `src/engine/index.ts`（统一导出）

- [ ] **Step 1: 创建 src/engine/EventBus.ts**

```typescript
type Handler<T = any> = (payload: T) => void

export class EventBus {
  private map = new Map<string, Set<Handler>>()

  on<T = any>(type: string, h: Handler<T>): () => void {
    let set = this.map.get(type)
    if (!set) {
      set = new Set()
      this.map.set(type, set)
    }
    set.add(h as Handler)
    return () => this.off(type, h)
  }

  off<T = any>(type: string, h: Handler<T>): void {
    this.map.get(type)?.delete(h as Handler)
  }

  emit<T = any>(type: string, payload?: T): void {
    const handlers = this.map.get(type)
    if (!handlers) return
    handlers.forEach((h) => {
      try { h(payload) } catch (e) { console.error(`[EventBus] handler error for "${type}":`, e) }
    })
  }

  clear(): void {
    this.map.clear()
  }
}
```

- [ ] **Step 2: 创建 src/engine/Scene.ts**

```typescript
import * as PIXI from 'pixi.js-legacy'
import type { SceneManager } from './SceneManager'
import type { EventBus } from './EventBus'

export abstract class Scene {
  readonly container = new PIXI.Container()

  protected manager!: SceneManager
  protected bus!: EventBus
  protected eventManager!: import('./EventManager').EventManager

  private disposers: Array<() => void> = []

  /** 框架内部：注入依赖，子类勿动 */
  _mount(manager: SceneManager, bus: EventBus, eventManager: import('./EventManager').EventManager): void {
    this.manager = manager
    this.bus = bus
    this.eventManager = eventManager
  }

  /** 子类用此方法订阅 EventBus 事件，销毁时自动解绑 */
  protected listen<T>(type: string, h: (p: T) => void): void {
    this.disposers.push(this.bus.on(type, h))
  }

  /** 注册触摸命中区域（委托给 EventManager） */
  protected registerHitArea(rect: { x: number; y: number; w: number; h: number }, callback: () => void, layer = 0): void {
    this.eventManager.registerHitArea(rect, callback, layer)
  }

  /** 框架内部：销毁时统一清理 */
  _teardown(): void {
    for (const off of this.disposers) {
      try { off() } catch (e) { /* ignore */ }
    }
    this.disposers = []
    this.onDestroy()
    this.container.destroy({ children: true })
  }

  // ── 生命周期钩子 ──
  onEnter(_params?: unknown): void {}
  onResume(): void {}
  onUpdate(_dt: number): void {}
  onPause(): void {}
  onExit(): void {}
  onDestroy(): void {}
}
```

- [ ] **Step 3: 创建 src/engine/EventManager.ts（从旧 core/EventManager.js 升级）**

```typescript
interface HitArea {
  x: number
  y: number
  w: number
  h: number
  callback: () => void
  layer: number
}

export class EventManager {
  private _canvas: any
  private _hitAreas: HitArea[] = []
  private _boundOnTouch: (e: any) => void

  constructor(canvas: any) {
    this._canvas = canvas
    this._boundOnTouch = this._onTouch.bind(this)
  }

  start(): void {
    wx.onTouchStart(this._boundOnTouch)
  }

  stop(): void {
    wx.offTouchStart(this._boundOnTouch)
  }

  registerHitArea(rect: { x: number; y: number; w: number; h: number }, callback: () => void, layer = 0): void {
    this._hitAreas.push({
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h,
      callback,
      layer,
    })
  }

  clearHitAreas(): void {
    this._hitAreas.length = 0
  }

  private _onTouch(e: any): void {
    if (!e.touches || e.touches.length === 0) return

    const touch = e.touches[0]
    const pos = { x: touch.x || touch.clientX || 0, y: touch.y || touch.clientY || 0 }

    const sorted = this._hitAreas.slice().sort((a, b) => b.layer - a.layer)

    for (let i = 0; i < sorted.length; i++) {
      if (this._contains(pos, sorted[i])) {
        sorted[i].callback()
        return
      }
    }
  }

  private _contains(pos: { x: number; y: number }, area: HitArea): boolean {
    return pos.x >= area.x &&
           pos.x <= area.x + area.w &&
           pos.y >= area.y &&
           pos.y <= area.y + area.h
  }
}
```

- [ ] **Step 4: 创建 src/engine/SceneManager.ts**

```typescript
import * as PIXI from 'pixi.js-legacy'
import type { Scene } from './Scene'
import { EventBus } from './EventBus'
import { EventManager } from './EventManager'

export class SceneManager {
  private stack: Scene[] = []
  readonly bus = new EventBus()
  readonly eventManager: EventManager

  constructor(private root: PIXI.Container) {
    // EventManager 在微信环境依赖 wx.onTouchStart
    // 浏览器环境下用 document 作为 fallback canvas（开发调试用）
    const canvas = (typeof wx !== 'undefined') ? (wx as any).createCanvas() : document.createElement('canvas')
    this.eventManager = new EventManager(canvas)
    if (typeof wx !== 'undefined') {
      this.eventManager.start()
    }
  }

  get current(): Scene | undefined {
    return this.stack[this.stack.length - 1]
  }

  push(scene: Scene, params?: unknown): void {
    this.current?.onPause()
    scene._mount(this, this.bus, this.eventManager)
    this.root.addChild(scene.container)
    this.stack.push(scene)
    scene.onEnter(params)
    scene.onResume()
  }

  pop(): void {
    const top = this.stack.pop()
    if (!top) return
    top.onExit()
    this.root.removeChild(top.container)
    top._teardown()
    this.current?.onResume()
  }

  replace(scene: Scene, params?: unknown): void {
    while (this.stack.length > 0) {
      this.pop()
    }
    this.push(scene, params)
  }

  update(dt: number): void {
    this.current?.onUpdate(dt)
  }
}
```

- [ ] **Step 5: 创建 src/engine/index.ts**

```typescript
export { Scene } from './Scene'
export { SceneManager } from './SceneManager'
export { EventBus } from './EventBus'
export { EventManager } from './EventManager'
```

- [ ] **Step 6: 运行类型检查**

Run: `npx tsc --noEmit`
Expected: 可能有 "Cannot find module" 错误（因为 scenes/ 等尚未创建），但 engine/ 自身应无类型错误

- [ ] **Step 7: 提交**

```bash
git add src/engine/
git commit -m "feat: 引擎三件套 — Scene/SceneManager/EventBus/EventManager"
```

---

### Task 3: 平台适配层 + 存储 + 工具

**Files:**
- Create: `src/platform/PixiAdapter.ts`（从 src/wechat/PixiAdapter.js 升级）
- Create: `src/platform/storage.ts`（从 example 移植）
- Create: `src/utils/Logger.ts`（从 src/utils/Logger.js 升级）
- Delete: `src/wechat/PixiAdapter.js`
- Delete: `src/utils/Logger.js`

- [ ] **Step 1: 创建 src/platform/PixiAdapter.ts**

```typescript
// WeChat Mini-Game adapter for PixiJS v7.
// Must run BEFORE PixiJS is loaded.
// Polyfills missing DOM APIs that PixiJS expects.

export function installPolyfills(): void {
  // Intl polyfill
  if (typeof (globalThis as any).Intl === 'undefined') {
    (globalThis as any).Intl = {
      NumberFormat: function () { return { format: (n: number) => String(n), formatToParts: (n: number) => [{ type: 'integer', value: String(n) }], resolvedOptions: () => ({ locale: 'zh-CN' }) } },
      DateTimeFormat: function () { return { format: (d: any) => String(d), formatToParts: (d: any) => [{ type: 'literal', value: String(d) }], resolvedOptions: () => ({ locale: 'zh-CN' }) } },
      Collator: function () { return { compare: (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0, resolvedOptions: () => ({ locale: 'zh-CN' }) } },
      PluralRules: function () { return { select: () => 'other', resolvedOptions: () => ({ locale: 'zh-CN' }) } },
    }
  }

  // window event methods
  if (typeof (globalThis as any).addEventListener === 'undefined') {
    (globalThis as any).addEventListener = function () {}
    ;(globalThis as any).removeEventListener = function () {}
    ;(globalThis as any).dispatchEvent = function () {}
  }

  // performance polyfill
  if (typeof (globalThis as any).performance === 'undefined') {
    (globalThis as any).performance = { now: () => Date.now() }
  }

  // document.createElement
  if (typeof (globalThis as any).document === 'undefined') {
    (globalThis as any).document = {
      createElement: function (tagName: string) {
        if (tagName === 'canvas') {
          const c = wx.createCanvas()
          ;(c as any).type = 'canvas'
          if (!(c instanceof (globalThis as any).HTMLCanvasElement)) {
            ;(c as any).__proto__.__proto__ = new ((globalThis as any).HTMLCanvasElement)()
          }
          if (!(c as any).style) (c as any).style = {}
          if (!(c as any).addEventListener) {
            ;(c as any).addEventListener = function () {}
            ;(c as any).removeEventListener = function () {}
            ;(c as any).dispatchEvent = function () {}
          }
          return c
        }
        return { tagName: tagName, style: {} }
      },
      createElementNS: function (_ns: string, tagName: string) {
        return (globalThis as any).document.createElement(tagName)
      },
      body: { appendChild: function () {}, removeChild: function () {} },
      head: { appendChild: function () {}, removeChild: function () {} },
      documentElement: { style: {} },
      addEventListener: function () {},
      removeEventListener: function () {},
      createEvent: function () { return {} },
      getElementById: function () { return null },
    }
  }

  // main canvas patching
  const mainCanvas = (globalThis as any).canvas || wx.createCanvas()
  if (mainCanvas && !(mainCanvas as any).addEventListener) {
    ;(mainCanvas as any).addEventListener = function () {}
    ;(mainCanvas as any).removeEventListener = function () {}
    ;(mainCanvas as any).dispatchEvent = function () {}
  }
  ;(globalThis as any).__pixi_main_canvas = mainCanvas

  // window / location / navigator
  if (typeof (globalThis as any).window === 'undefined') {
    ;(globalThis as any).window = globalThis
  }
  if (!(globalThis as any).location) {
    ;(globalThis as any).location = { href: '', protocol: 'https:', host: '' }
  }
  if (!(globalThis as any).navigator) {
    ;(globalThis as any).navigator = { userAgent: 'WeChat', platform: 'WeChat' }
  }

  // HTMLCanvasElement with Symbol.hasInstance
  if (typeof (globalThis as any).HTMLCanvasElement === 'undefined') {
    ;(globalThis as any).HTMLCanvasElement = function () {}
    Object.defineProperty((globalThis as any).HTMLCanvasElement, Symbol.hasInstance, {
      value: function (instance: any) {
        return instance && typeof instance.getContext === 'function'
      },
      writable: false,
    })
  }

  // Image
  if (typeof (globalThis as any).Image === 'undefined') {
    ;(globalThis as any).Image = wx.createImage
  }

  // requestAnimationFrame
  if (typeof (globalThis as any).requestAnimationFrame === 'undefined') {
    ;(globalThis as any).requestAnimationFrame = function (cb: () => void) {
      return setTimeout(cb, 16)
    }
    ;(globalThis as any).cancelAnimationFrame = function (id: number) {
      clearTimeout(id)
    }
  }
}

export function getMainCanvas(): any {
  return (globalThis as any).__pixi_main_canvas || wx.createCanvas()
}
```

- [ ] **Step 2: 创建 src/platform/storage.ts**

```typescript
interface IStorage {
  get<T>(key: string, def: T): T
  set(key: string, val: unknown): void
}

class WebStorage implements IStorage {
  get<T>(key: string, def: T): T {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : def
    } catch {
      return def
    }
  }
  set(key: string, val: unknown): void {
    try { localStorage.setItem(key, JSON.stringify(val)) } catch { /* ignore */ }
  }
}

class WxStorage implements IStorage {
  get<T>(key: string, def: T): T {
    try {
      const raw = wx.getStorageSync(key)
      return raw ? (JSON.parse(raw) as T) : def
    } catch {
      return def
    }
  }
  set(key: string, val: unknown): void {
    try { wx.setStorageSync(key, JSON.stringify(val)) } catch { /* ignore */ }
  }
}

export const storage: IStorage =
  typeof wx !== 'undefined' ? new WxStorage() : new WebStorage()
```

- [ ] **Step 3: 创建 src/utils/Logger.ts（从旧 Logger.js 升级）**

```typescript
let DEBUG = true

export function setDebug(enabled: boolean): void {
  DEBUG = enabled
}

export function log(tag: string, msg: string, data?: unknown): void {
  if (!DEBUG) return
  if (data !== undefined) {
    console.log(`[${tag}] ${msg}`, data)
  } else {
    console.log(`[${tag}] ${msg}`)
  }
}

export function warn(tag: string, msg: string, data?: unknown): void {
  if (data !== undefined) {
    console.warn(`[${tag}] ${msg}`, data)
  } else {
    console.warn(`[${tag}] ${msg}`)
  }
}

export function error(tag: string, msg: string, data?: unknown): void {
  if (data !== undefined) {
    console.error(`[${tag}] ${msg}`, data)
  } else {
    console.error(`[${tag}] ${msg}`)
  }
}
```

- [ ] **Step 4: 删除旧文件**

```bash
rm src/wechat/PixiAdapter.js
rm src/utils/Logger.js
```

- [ ] **Step 5: 运行类型检查**

Run: `npx tsc --noEmit`
Expected: engine/ + platform/ + utils/ 无类型错误

- [ ] **Step 6: 提交**

```bash
git add src/platform/ src/utils/
git rm src/wechat/PixiAdapter.js src/utils/Logger.js
git commit -m "feat: 平台适配层 + 存储 + 日志 — PixiAdapter/storage/Logger 升级至 TS"
```

---

### Task 4: 核心逻辑层 — Card / types / 配置 → 纯 TS + EventBus

这一步把 `src/game/` 和 `src/data/` 拆为纯逻辑（core/）和配置（config/），零 PixiJS 依赖，通过 EventBus 通信。

**Files:**
- Create: `src/core/types.ts`
- Create: `src/core/Card.ts`（从 src/game/Card.js 升级，纯数据，去渲染代码）
- Create: `src/core/Board.ts`（从 src/game/Board.js 拆分，纯逻辑）
- Create: `src/core/SlotBar.ts`（从 src/game/SlotBar.js 拆分，纯逻辑）
- Create: `src/core/StepManager.ts`（从 src/game/StepManager.js 升级）
- Create: `src/core/SkillSystem.ts`（从 src/game/SkillSystem.js 升级）
- Create: `src/core/GameLogic.ts`（新增顶层协调者）
- Create: `src/config/cards.ts`（从 src/data/cards.js 升级）
- Create: `src/config/levels.ts`（从 src/data/levels.js 升级）
- Create: `src/config/skills.ts`（从 src/data/skills.js 升级）
- Delete: `src/game/`
- Delete: `src/data/`

- [ ] **Step 1: 创建 src/core/types.ts**

```typescript
// ── 卡片相关 ──
export type CardRarity = 'common' | 'uncommon' | 'rare'
export type CardEffectType = 'negative' | 'positive' | 'dual'

export interface NormalCardConfig {
  id: string
  icon: string
  name: string
  rarity: CardRarity
  weight: number
}

export interface FuncCardConfig {
  id: string
  icon: string
  name: string
  type: CardEffectType
  effect: string
  revealIcon: string
  revealName: string
  weight: number
}

export interface CardData {
  uid: string
  type: 'normal' | 'event'
  config: NormalCardConfig | FuncCardConfig
  cardId: string
  icon: string
  name: string
  layer: number
  row: number
  col: number
  isRevealed: boolean
  isRemoved: boolean
  isCovered: boolean
}

// ── 棋盘 ──
export interface BoardCard {
  uid: string
  type: 'normal' | 'event'
  config: NormalCardConfig | FuncCardConfig
  cardId: string
  icon: string
  name: string
  layer: number
  row: number
  col: number
  isCovered: boolean
  isRevealed: boolean
  isRemoved: boolean
}

// ── 卡槽 ──
export interface SlotCard {
  uid: string
  type: 'normal' | 'event'
  config: NormalCardConfig | FuncCardConfig
  cardId: string
  icon: string
  name: string
  isRevealed: boolean
}

// ── 关卡 ──
export interface LevelConfig {
  id: string
  name: string
  normalCardTypes: number
  funcCardCount: number
  funcTypes: string[]
  funcRatio?: { negative: number; positive: number; dual: number }
  layers: number
  gridRows: number
  gridCols: number
  totalCards: number
  steps: number
  slotLimit: number
}

// ── 技能 ──
export interface SkillConfig {
  id: string
  name: string
  icon: string
  tag: string
  desc: string
  apply: (ctx: SkillContext) => void
}

export interface SkillContext {
  slotFreeClicks: number
  slotLimit: number
  clearMostInSlot: boolean
  removeCoveredCards: number
  transformToWild: number
  slotOverflowShield: boolean
  stepsRemaining: number
  noMoreBossPatrol: boolean
  revealAllEvents: boolean
  selectAndClear: boolean
  clearRandomRare: boolean
  swapTwoInSlot: boolean
  tempSlotLimit9: number
  gainWildCard: boolean
  extraSkillTrigger: boolean
  stepsUnlimited: boolean
  slotUnlimited: boolean
}

// ── 游戏结果 ──
export interface GameResult {
  won: boolean
  happiness: number
  reason: string
  levelId: string
  stepsUsed: number
}

// ── 事件 Payload ──
export interface BoardInitEvent { cards: BoardCard[] }
export interface StepsChangedEvent { remaining: number }
export interface CardToSlotEvent { card: BoardCard; slotIndex: number }
export interface BoardChangedEvent { cards: Array<{ uid: string; blocked: boolean }> }
export interface EliminatedEvent { uids: string[]; happiness: number; count: number }
export interface HappyChangedEvent { value: number }
export interface SkillTriggeredEvent { skills: SkillConfig[] }
export interface SkillAppliedEvent { skill: SkillConfig }
export interface GameOverEvent extends GameResult {}
```

- [ ] **Step 2: 创建 src/core/Card.ts**

Card 变成纯数据工厂函数 + 方法对象（不依赖 PixiJS）：

```typescript
import type { NormalCardConfig, FuncCardConfig, CardData, BoardCard } from './types'

let uidSeq = 0

export function createCardData(opts: {
  type: 'normal' | 'event'
  config: NormalCardConfig | FuncCardConfig
  layer: number
  row: number
  col: number
}): CardData {
  return {
    uid: `c${uidSeq++}`,
    type: opts.type,
    config: opts.config,
    cardId: opts.config.id,
    icon: opts.config.icon,
    name: opts.config.name,
    layer: opts.layer,
    row: opts.row,
    col: opts.col,
    isRevealed: false,
    isRemoved: false,
    isCovered: true,
  }
}

export function cardToBoardCard(card: CardData, isCovered: boolean): BoardCard {
  return {
    uid: card.uid,
    type: card.type,
    config: card.config,
    cardId: card.cardId,
    icon: card.icon,
    name: card.name,
    layer: card.layer,
    row: card.row,
    col: card.col,
    isCovered,
    isRevealed: card.isRevealed,
    isRemoved: card.isRemoved,
  }
}

export function revealCard(card: CardData): void {
  if (card.type !== 'event' || card.isRevealed) return
  card.isRevealed = true
  const config = card.config as FuncCardConfig
  if (config.revealIcon) card.icon = config.revealIcon
  if (config.revealName) card.name = config.revealName
}

export function getCardColor(card: CardData): string {
  const config = card.config
  if (card.type === 'event' && !card.isRevealed) return '#9B59B6'
  if (card.type === 'event' && card.isRevealed) {
    const t = (config as FuncCardConfig).type
    if (t === 'negative') return '#E74C3C'
    if (t === 'positive') return '#2ECC71'
    if (t === 'dual') return '#F39C12'
  }
  const r = (config as NormalCardConfig).rarity
  if (r === 'rare') return '#F1C40F'
  if (r === 'uncommon') return '#3498DB'
  return '#95A5A6'
}
```

- [ ] **Step 3: 创建 src/core/Board.ts**

Board 纯逻辑（无 PIXI），拆掉所有渲染代码：

```typescript
import type { EventBus } from '../engine/EventBus'
import type { LevelConfig, BoardCard, BoardInitEvent, CardToSlotEvent, BoardChangedEvent } from './types'
import type { NormalCardConfig, FuncCardConfig } from './types'
import { createCardData, cardToBoardCard, revealCard } from './Card'
import { NORMAL_CARDS, FUNC_CARDS, FUNC_TYPE } from '../config/cards'

export class Board {
  private grid: (BoardCard | null)[][][] = []
  private bus: EventBus
  private config: LevelConfig | null = null

  // 布局参数（由 GameLogic 设置）
  cardWidth = 64
  cardHeight = 80
  offsetX = 0
  offsetY = 0
  layerOffsetX = 4
  layerOffsetY = 4
  gap = 8

  constructor(bus: EventBus) {
    this.bus = bus
  }

  calcLayout(screenW: number, screenH: number, rows: number, cols: number): void {
    const areaTop = 20
    const areaBottom = 180
    const areaH = screenH - areaTop - areaBottom
    const areaW = screenW - 20
    const gap = 8
    this.cardWidth = Math.floor((areaW - gap * (cols + 1)) / cols)
    this.cardHeight = Math.floor(this.cardWidth * 1.25)
    this.offsetX = Math.floor((screenW - (this.cardWidth * cols + gap * (cols - 1))) / 2)
    this.offsetY = areaTop + Math.floor((areaH - (this.cardHeight * rows + gap * (rows - 1))) / 2)
    this.gap = gap
    this.layerOffsetX = Math.floor(this.cardWidth * 0.08)
    this.layerOffsetY = Math.floor(this.cardHeight * 0.06)
  }

  generate(config: LevelConfig): void {
    this.config = config
    this.grid = []
    const { layers, gridRows: rows, gridCols: cols } = config

    for (let l = 0; l < layers; l++) {
      this.grid[l] = []
      for (let r = 0; r < rows; r++) {
        this.grid[l][r] = []
        for (let c = 0; c < cols; c++) this.grid[l][r][c] = null
      }
    }

    const cardList = this._buildCardList(config)
    this._fillGrid(cardList, layers, rows, cols)
    this._updateCoveredState()
    this._emitBoardInit()
  }

  private _buildCardList(config: LevelConfig): Array<{ type: 'normal' | 'event'; config: NormalCardConfig | FuncCardConfig }> {
    const list: Array<{ type: 'normal' | 'event'; config: NormalCardConfig | FuncCardConfig }> = []
    const normalCount = config.totalCards - config.funcCardCount

    const usedNormalTypes = NORMAL_CARDS.slice(0, config.normalCardTypes)
    let perType = Math.floor(normalCount / config.normalCardTypes)
    perType = perType - (perType % 3)
    for (const ct of usedNormalTypes) {
      for (let j = 0; j < perType; j++) {
        list.push({ type: 'normal', config: ct })
      }
    }
    const remain = normalCount - list.length
    for (let k = 0; k < remain; k++) {
      list.push({ type: 'normal', config: usedNormalTypes[0] })
    }

    const funcRatio = config.funcRatio || { negative: 1, positive: 0, dual: 0 }
    const negCount = Math.floor(config.funcCardCount * (funcRatio.negative || 0.5))
    const posCount = Math.floor(config.funcCardCount * (funcRatio.positive || 0.25))
    const dualCount = config.funcCardCount - negCount - posCount

    this._addFuncCards(list, FUNC_TYPE.NEGATIVE, negCount)
    this._addFuncCards(list, FUNC_TYPE.POSITIVE, posCount)
    this._addFuncCards(list, FUNC_TYPE.DUAL, dualCount)
    this._shuffle(list)
    return list
  }

  private _addFuncCards(
    list: Array<{ type: 'normal' | 'event'; config: NormalCardConfig | FuncCardConfig }>,
    funcType: string, count: number
  ): void {
    const pool = FUNC_CARDS.filter(c => (c as FuncCardConfig).type === funcType)
    for (let i = 0; i < count; i++) {
      const pick = pool[Math.floor(Math.random() * pool.length)]
      list.push({ type: 'event', config: pick as FuncCardConfig })
    }
  }

  private _shuffle<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
  }

  private _fillGrid(
    cardList: Array<{ type: 'normal' | 'event'; config: NormalCardConfig | FuncCardConfig }>,
    layers: number, rows: number, cols: number
  ): void {
    const eventCards = cardList.filter(c => c.type === 'event')
    const normalCards = cardList.filter(c => c.type === 'normal')
    normalCards.sort((a, b) => {
      const order: Record<string, number> = { rare: 0, uncommon: 1, common: 2 }
      return (order[(a.config as NormalCardConfig).rarity] || 2) - (order[(b.config as NormalCardConfig).rarity] || 2)
    })

    for (let l = 0; l < layers; l++) {
      let coverage: number
      if (layers === 1) coverage = 0.95
      else if (l === 0) coverage = 0.9
      else if (l === layers - 1) coverage = 0.3
      else coverage = 0.5

      const needed = Math.floor(rows * cols * coverage)
      let placed = 0
      for (let r = 0; r < rows && placed < needed; r++) {
        for (let c = 0; c < cols && placed < needed; c++) {
          if (this.grid[l][r][c] !== null) continue
          let cardData: { type: 'normal' | 'event'; config: NormalCardConfig | FuncCardConfig } | undefined
          if (l === layers - 1 && eventCards.length > 0) cardData = eventCards.shift()
          else if (normalCards.length > 0) cardData = normalCards.shift()
          else if (eventCards.length > 0) cardData = eventCards.shift()
          else break
          if (!cardData) break
          const card = createCardData({ type: cardData.type, config: cardData.config, layer: l, row: r, col: c })
          this.grid[l][r][c] = cardToBoardCard(card, false)
          placed++
        }
      }
    }
  }

  private _updateCoveredState(): void {
    for (let l = 0; l < this.grid.length; l++) {
      for (let r = 0; r < this.grid[l].length; r++) {
        for (let c = 0; c < this.grid[l][r].length; c++) {
          const card = this.grid[l][r][c]
          if (!card) continue
          card.isCovered = this._isCovered(card)
        }
      }
    }
  }

  private _isCovered(card: BoardCard): boolean {
    const upperLayer = card.layer + 1
    if (upperLayer >= this.grid.length) return false
    const checkPositions = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]
    for (const [dr, dc] of checkPositions) {
      const rr = card.row + dr, cc = card.col + dc
      if (rr >= 0 && rr < this.grid[upperLayer].length &&
          cc >= 0 && cc < this.grid[upperLayer][0].length &&
          this.grid[upperLayer][rr][cc] !== null) return true
    }
    return false
  }

  getClickableCards(): BoardCard[] {
    const result: BoardCard[] = []
    for (let l = 0; l < this.grid.length; l++)
      for (let r = 0; r < this.grid[l].length; r++)
        for (let c = 0; c < this.grid[l][r].length; c++) {
          const card = this.grid[l][r][c]
          if (card && !card.isRemoved && !card.isCovered) result.push(card)
        }
    return result
  }

  removeCard(uid: string): BoardCard | null {
    for (let l = 0; l < this.grid.length; l++)
      for (let r = 0; r < this.grid[l].length; r++)
        for (let c = 0; c < this.grid[l][r].length; c++) {
          const card = this.grid[l][r][c]
          if (card && card.uid === uid && !card.isRemoved) {
            card.isRemoved = true
            this.grid[l][r][c] = null
            this._updateCoveredState()
            return card
          }
        }
    return null
  }

  revealAllEvents(): void {
    for (let l = 0; l < this.grid.length; l++)
      for (let r = 0; r < this.grid[l].length; r++)
        for (let c = 0; c < this.grid[l][r].length; c++) {
          const card = this.grid[l][r][c]
          if (card && card.type === 'event' && !card.isRevealed) {
            revealCard(card)
          }
        }
    this._emitBoardInit()
  }

  removeCoveredCards(count: number): BoardCard[] {
    const covered: BoardCard[] = []
    for (let l = 0; l < this.grid.length; l++)
      for (let r = 0; r < this.grid[l].length; r++)
        for (let c = 0; c < this.grid[l][r].length; c++) {
          const card = this.grid[l][r][c]
          if (card && card.isCovered && !card.isRemoved) covered.push(card)
        }
    this._shuffle(covered)
    const toRemove = covered.slice(0, count)
    for (const card of toRemove) this.removeCard(card.uid)
    return toRemove
  }

  hasCards(): boolean {
    for (let l = 0; l < this.grid.length; l++)
      for (let r = 0; r < this.grid[l].length; r++)
        for (let c = 0; c < this.grid[l][r].length; c++)
          if (this.grid[l][r][c] && !this.grid[l][r][c]!.isRemoved) return true
    return false
  }

  private _emitBoardInit(): void {
    const cards: BoardCard[] = []
    for (let l = 0; l < this.grid.length; l++)
      for (let r = 0; r < this.grid[l].length; r++)
        for (let c = 0; c < this.grid[l][r].length; c++) {
          const card = this.grid[l][r][c]
          if (card && !card.isRemoved) cards.push({ ...card })
        }
    this.bus.emit<BoardInitEvent>('boardInit', { cards })
  }

  private _emitBoardChanged(): void {
    const cards: Array<{ uid: string; blocked: boolean }> = []
    for (let l = 0; l < this.grid.length; l++)
      for (let r = 0; r < this.grid[l].length; r++)
        for (let c = 0; c < this.grid[l][r].length; c++) {
          const card = this.grid[l][r][c]
          if (card && !card.isRemoved) cards.push({ uid: card.uid, blocked: card.isCovered })
        }
    this.bus.emit<BoardChangedEvent>('boardChanged', { cards })
  }
}
```

注意：Board 中的 render 方法（`_renderAll`、`_renderCardAt`、`getCardScreenPos`）已删除，渲染职责转移到 views/CardView。

- [ ] **Step 4: 创建 src/core/SlotBar.ts**

```typescript
import type { EventBus } from '../engine/EventBus'
import type { SlotCard, EliminatedEvent } from './types'
import type { BoardCard } from './types'
import { log } from '../utils/Logger'

const TAG = 'SlotBar'

export class SlotBar {
  slots: (SlotCard | null)[] = []
  maxSlots: number
  private bus: EventBus
  private happiness = 0

  // 布局参数
  slotWidth = 56
  slotHeight = 72
  gap = 6
  startX = 0
  startY = 0

  constructor(maxSlots: number, bus: EventBus) {
    this.maxSlots = maxSlots
    this.bus = bus
    for (let i = 0; i < maxSlots; i++) this.slots.push(null)
  }

  calcLayout(screenW: number, screenH: number): void {
    const totalW = this.maxSlots * this.slotWidth + (this.maxSlots - 1) * this.gap
    this.startX = Math.floor((screenW - totalW) / 2)
    this.startY = screenH - 140
  }

  addCard(card: BoardCard): boolean {
    const emptyIdx = this.slots.findIndex(s => s === null)
    if (emptyIdx === -1) { log(TAG, 'Slot full'); return false }
    this.slots[emptyIdx] = {
      uid: card.uid,
      type: card.type,
      config: card.config,
      cardId: card.cardId,
      icon: card.icon,
      name: card.name,
      isRevealed: card.isRevealed,
    }
    this.bus.emit('slotChanged', {})
    this._checkMatch(card.cardId)
    return true
  }

  getVacantCount(): number {
    return this.slots.filter(s => s === null).length
  }

  isFull(): boolean { return this.getVacantCount() === 0 }

  private _checkMatch(cardId: string): void {
    const wildCards: number[] = []
    const sameCards: number[] = []
    for (let i = 0; i < this.maxSlots; i++) {
      const s = this.slots[i]
      if (!s) continue
      if (s.cardId === cardId) sameCards.push(i)
      if (s.type === 'event' && (s.config as any).effect === 'wild_card' && s.isRevealed) wildCards.push(i)
    }
    if (sameCards.length >= 3) {
      this._eliminate(sameCards.slice(0, 3))
      return
    }
    if (wildCards.length > 0 && (sameCards.length + wildCards.length) >= 3) {
      const needed = 3 - sameCards.length
      this._eliminate(sameCards.concat(wildCards.slice(0, needed)))
    }
  }

  private _eliminate(indices: number[]): void {
    const uids: string[] = []
    for (const i of indices) {
      if (this.slots[i]) {
        uids.push(this.slots[i]!.uid)
      }
      this.slots[i] = null
    }
    this.happiness += 10
    this.bus.emit<EliminatedEvent>('eliminated', { uids, happiness: this.happiness, count: indices.length })
  }

  clearMostCardType(): void {
    const counts: Record<string, number[]> = {}
    for (let i = 0; i < this.maxSlots; i++) {
      const s = this.slots[i]; if (!s) continue
      const key = s.cardId
      if (!counts[key]) counts[key] = []
      counts[key].push(i)
    }
    let maxKey: string | null = null, maxCount = 0
    for (const k in counts) { if (counts[k].length > maxCount) { maxCount = counts[k].length; maxKey = k } }
    if (maxKey) this._eliminate(counts[maxKey])
  }

  shuffleSlots(): void {
    const cards = this.slots.filter(s => s !== null) as SlotCard[]
    for (let j = cards.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1))
      ;[cards[j], cards[k]] = [cards[k], cards[j]]
    }
    let ci = 0
    for (let s = 0; s < this.maxSlots; s++) { if (this.slots[s]) this.slots[s] = cards[ci++] }
    this.bus.emit('slotChanged', {})
  }

  transformToWild(): void {
    for (let i = 0; i < this.maxSlots; i++) {
      if (this.slots[i] && this.slots[i]!.type !== 'event') {
        const c = this.slots[i]!
        c.type = 'event'
        c.cardId = 'paid_leave'
        c.icon = '🌟'
        c.name = '万能卡'
        c.config = { id: 'paid_leave', effect: 'wild_card', type: 'positive' } as any
        c.isRevealed = true
        break
      }
    }
    this.bus.emit('slotChanged', {})
  }

  reset(maxSlots?: number): void {
    if (maxSlots) this.maxSlots = maxSlots
    this.slots = []
    this.happiness = 0
    for (let i = 0; i < this.maxSlots; i++) this.slots.push(null)
  }
}
```

- [ ] **Step 5: 创建 src/core/StepManager.ts**

```typescript
import type { EventBus } from '../engine/EventBus'
import type { StepsChangedEvent } from './types'

export class StepManager {
  stepsRemaining: number
  maxSteps: number
  slotLimit: number
  baseSlotLimit: number
  slotFreeClicks = 0
  tempSlotLimit9 = 0
  slotOverflowShield = false
  stepsUnlimited = false
  slotUnlimited = false
  noMoreBossPatrol = false

  private bus: EventBus

  constructor(bus: EventBus) {
    this.bus = bus
    this.stepsRemaining = 35
    this.maxSteps = 35
    this.slotLimit = 7
    this.baseSlotLimit = 7
  }

  init(config: { steps: number; slotLimit: number }): void {
    this.stepsRemaining = config.steps
    this.maxSteps = config.steps
    this.slotLimit = config.slotLimit
    this.baseSlotLimit = config.slotLimit
    this.slotFreeClicks = 0
    this.tempSlotLimit9 = 0
    this.slotOverflowShield = false
    this.stepsUnlimited = false
    this.slotUnlimited = false
    this._emit()
  }

  useStep(): boolean {
    if (this.stepsUnlimited) return true
    if (this.stepsRemaining <= 0) return false
    this.stepsRemaining--
    this._emit()
    return true
  }

  occupiesSlot(): boolean {
    if (this.slotFreeClicks > 0) { this.slotFreeClicks--; return false }
    return true
  }

  getEffectiveSlotLimit(): number {
    if (this.slotUnlimited) return Infinity
    if (this.tempSlotLimit9 > 0) return 9
    return this.slotLimit
  }

  tick(): void {
    if (this.tempSlotLimit9 > 0) this.tempSlotLimit9--
  }

  checkFailure(slotFull: boolean, canEliminate: boolean): { isFailed: boolean; reason: string; shieldActivated: boolean } {
    if (!this.stepsUnlimited && this.stepsRemaining <= 0) {
      return { isFailed: true, reason: 'steps', shieldActivated: false }
    }
    if (!this.slotUnlimited && slotFull && !canEliminate) {
      if (this.slotOverflowShield) {
        this.slotOverflowShield = false
        return { isFailed: false, reason: '', shieldActivated: true }
      }
      return { isFailed: true, reason: 'slot_full', shieldActivated: false }
    }
    return { isFailed: false, reason: '', shieldActivated: false }
  }

  private _emit(): void {
    this.bus.emit<StepsChangedEvent>('stepsChanged', { remaining: this.stepsRemaining })
  }
}
```

- [ ] **Step 6: 创建 src/core/SkillSystem.ts**

```typescript
import type { EventBus } from '../engine/EventBus'
import type { SkillConfig, SkillContext, SkillTriggeredEvent, EliminatedEvent } from './types'
import { getRandomSkills } from '../config/skills'
import { log } from '../utils/Logger'

const TAG = 'SkillSystem'

export class SkillSystem {
  private eliminateCount = 0
  private triggerThreshold = 3
  private isShowingSelection = false
  private bus: EventBus

  constructor(bus: EventBus) {
    this.bus = bus
    this.bus.on<EliminatedEvent>('eliminated', () => this.onEliminate())
  }

  init(): void {
    this.eliminateCount = 0
    this.triggerThreshold = 3
    this.isShowingSelection = false
  }

  onEliminate(): void {
    this.eliminateCount++
    if (this.eliminateCount % this.triggerThreshold === 0) {
      this._showSelection()
    }
  }

  private _showSelection(): void {
    if (this.isShowingSelection) return
    this.isShowingSelection = true
    const skills = getRandomSkills(3)
    log(TAG, 'Skill selection: ' + skills.map(s => s.name).join(', '))
    this.bus.emit<SkillTriggeredEvent>('skillTriggered', { skills })
  }

  selectSkill(skill: SkillConfig, ctx: SkillContext): void {
    this.isShowingSelection = false
    log(TAG, 'Player selected: ' + skill.name)
    skill.apply(ctx)
    this.bus.emit('skillApplied', { skill })
  }

  reset(): void {
    this.init()
  }
}
```

- [ ] **Step 7: 创建 src/core/GameLogic.ts**

GameLogic 是顶层协调者，注入 EventBus，不依赖 PixiJS：

```typescript
import type { EventBus } from '../engine/EventBus'
import type { LevelConfig, GameOverEvent, GameResult } from './types'
import { Board } from './Board'
import { SlotBar } from './SlotBar'
import { StepManager } from './StepManager'
import { SkillSystem } from './SkillSystem'
import { log } from '../utils/Logger'

const TAG = 'GameLogic'

export class GameLogic {
  readonly board: Board
  readonly slotBar: SlotBar
  readonly stepManager: StepManager
  readonly skillSystem: SkillSystem

  private levelConfig: LevelConfig
  private bus: EventBus
  happyValue = 0
  eliminateGroupCount = 0
  consecutiveNegative = 0
  private over = false

  constructor(levelConfig: LevelConfig, bus: EventBus) {
    this.levelConfig = levelConfig
    this.bus = bus
    this.board = new Board(bus)
    this.slotBar = new SlotBar(levelConfig.slotLimit, bus)
    this.stepManager = new StepManager(bus)
    this.skillSystem = new SkillSystem(bus)
  }

  init(screenW: number, screenH: number): void {
    this.happyValue = 0
    this.eliminateGroupCount = 0
    this.over = false
    this.consecutiveNegative = 0

    const config = this.levelConfig
    this.board.calcLayout(screenW, screenH, config.gridRows, config.gridCols)
    this.slotBar.calcLayout(screenW, screenH)
    this.board.generate(config)
    this.slotBar.reset(config.slotLimit)
    this.stepManager.init(config)
    this.skillSystem.init()
  }

  onCardClicked(cardUid: string): void {
    if (this.over) return

    const card = this.board.removeCard(cardUid)
    if (!card) return

    if (!this.stepManager.useStep()) {
      this._endGame(false, '步数耗尽！')
      return
    }

    // 事件卡揭示
    if (card.type === 'event' && !card.isRevealed) {
      this._revealEventCard(card)
    }

    if (this.stepManager.occupiesSlot()) {
      if (!this.slotBar.addCard(card)) {
        this._checkFailure()
        return
      }
    } else {
      this.slotBar.addCard(card)
    }

    this.stepManager.tick()

    if (!this.board.hasCards()) {
      this._endGame(true, '棋盘清空！')
      return
    }

    this._checkFailure()
  }

  private _revealEventCard(card: any): void {
    // 连续3次负面卡 -> 下一次必定正面
    if (this.consecutiveNegative >= 3) {
      const positiveCards = ['paid_leave', 'colleague_coffee', 'early_leave', 'boss_favor', 'reimburse']
      const pick = positiveCards[Math.floor(Math.random() * positiveCards.length)]
      const FUNC_CARDS = require('../config/cards').FUNC_CARDS
      for (const fc of FUNC_CARDS) {
        if (fc.id === pick) { card.config = fc; card.cardId = fc.id; break }
      }
      this.consecutiveNegative = 0
    }
    card.isRevealed = true
    const config = card.config as any
    if (config.revealIcon) card.icon = config.revealIcon
    if (config.revealName) card.name = config.revealName

    this._applyFuncEffect(card)

    if (config.type === 'negative') this.consecutiveNegative++
    else this.consecutiveNegative = 0
  }

  private _applyFuncEffect(card: any): void {
    const effect = card.config.effect
    switch (effect) {
      case 'boss_patrol': {
        const slots = this.slotBar.slots
        const nonNull: number[] = []
        for (let i = 0; i < slots.length; i++) { if (slots[i]) nonNull.push(i) }
        if (nonNull.length > 0) {
          const target = nonNull[Math.floor(Math.random() * nonNull.length)]
          slots[target] = { uid: 'boss_patrol', type: 'event', config: card.config, cardId: 'boss_patrol', icon: '⚠️', name: '老板巡视', isRevealed: true }
        }
        break
      }
      case 'slot_limit_down': this.stepManager.slotLimit = Math.max(3, this.stepManager.slotLimit - 1); break
      case 'shuffle_slots': this.slotBar.shuffleSlots(); break
      case 'remove_most': this.slotBar.clearMostCardType(); break
      case 'add_steps_3': this.stepManager.stepsRemaining += 3; break
      case 'double_happy_10': this.stepManager.slotFreeClicks += 10; break // simplified
      default: break
    }
  }

  onEliminate(count: number): void {
    this.happyValue += 10
    this.eliminateGroupCount++
    // skillSystem 已在 EventBus 上监听 eliminated 事件，这里不需手动调用
  }

  getSkillContext(): any {
    const self = this
    return {
      get slotFreeClicks() { return self.stepManager.slotFreeClicks },
      set slotFreeClicks(v: number) { self.stepManager.slotFreeClicks = v },
      get slotLimit() { return self.stepManager.slotLimit },
      set slotLimit(v: number) { self.stepManager.slotLimit = v },
      get clearMostInSlot() { return false },
      set clearMostInSlot(v: boolean) { if (v) self.slotBar.clearMostCardType() },
      get removeCoveredCards() { return 0 },
      set removeCoveredCards(v: number) { self.board.removeCoveredCards(v) },
      get transformToWild() { return 0 },
      set transformToWild(v: number) { if (v) self.slotBar.transformToWild() },
      get slotOverflowShield() { return self.stepManager.slotOverflowShield },
      set slotOverflowShield(v: boolean) { self.stepManager.slotOverflowShield = v },
      get stepsRemaining() { return self.stepManager.stepsRemaining },
      set stepsRemaining(v: number) { self.stepManager.stepsRemaining = v },
      get noMoreBossPatrol() { return self.stepManager.noMoreBossPatrol },
      set noMoreBossPatrol(v: boolean) { self.stepManager.noMoreBossPatrol = v },
      get revealAllEvents() { return false },
      set revealAllEvents(v: boolean) { if (v) self.board.revealAllEvents() },
      get tempSlotLimit9() { return self.stepManager.tempSlotLimit9 },
      set tempSlotLimit9(v: number) { self.stepManager.tempSlotLimit9 = v },
      get stepsUnlimited() { return self.stepManager.stepsUnlimited },
      set stepsUnlimited(v: boolean) { self.stepManager.stepsUnlimited = v },
      get slotUnlimited() { return self.stepManager.slotUnlimited },
      set slotUnlimited(v: boolean) { self.stepManager.slotUnlimited = v },
      selectAndClear: false,
      clearRandomRare: false,
      swapTwoInSlot: false,
      gainWildCard: false,
      extraSkillTrigger: false,
    }
  }

  private _checkFailure(): void {
    this.stepManager.tick()
    if (!this.board.hasCards()) {
      this._endGame(true, '棋盘清空！')
      return
    }
  }

  private _endGame(won: boolean, reason: string): void {
    if (this.over) return
    this.over = true
    let bonusHappy = 0
    if (won) {
      bonusHappy += this.stepManager.stepsRemaining * 10
      if (this.slotBar.getVacantCount() >= 3) bonusHappy += 20
    }
    this.happyValue += bonusHappy
    const result: GameResult = {
      won,
      happiness: this.happyValue,
      reason,
      levelId: this.levelConfig.id,
      stepsUsed: this.stepManager.maxSteps - this.stepManager.stepsRemaining,
    }
    log(TAG, `Game over: won=${won}, happy=${this.happyValue}, reason=${reason}`)
    this.bus.emit<GameOverEvent>('gameOver', result)
  }
}
```

- [ ] **Step 8: 创建 src/config/cards.ts**

将 `src/data/cards.js` 升级为 TS（加类型注解，内容不变）：

```typescript
import type { NormalCardConfig, FuncCardConfig } from '../core/types'

export const NORMAL_CARDS: NormalCardConfig[] = [
  { id: 'phone',    icon: '📱', name: '刷手机',   rarity: 'common', weight: 90 },
  { id: 'toilet',   icon: '🚽', name: '带薪拉屎', rarity: 'common', weight: 80 },
  { id: 'sleep',    icon: '😴', name: '打瞌睡',   rarity: 'common', weight: 70 },
  { id: 'snack',    icon: '🍜', name: '吃零食',   rarity: 'uncommon', weight: 40 },
  { id: 'shop',     icon: '🛒', name: '逛淘宝',   rarity: 'uncommon', weight: 35 },
  { id: 'gossip',   icon: '💬', name: '聊八卦',   rarity: 'rare', weight: 15 },
  { id: 'game',     icon: '🎮', name: '偷偷游戏', rarity: 'rare', weight: 10 },
]

export const FUNC_TYPE = {
  NEGATIVE: 'negative',
  POSITIVE: 'positive',
  DUAL: 'dual',
} as const

export const FUNC_CARDS: FuncCardConfig[] = [
  { id: 'boss_patrol',    icon: '⚠️', name: '老板巡视', type: 'negative',
    effect: 'boss_patrol', revealIcon: '⚠️', revealName: '老板巡视', weight: 30 },
  { id: 'emergency_meet', icon: '📞', name: '紧急会议', type: 'negative',
    effect: 'lock_cards', revealIcon: '📞', revealName: '紧急会议', weight: 15 },
  { id: 'printer_jam',    icon: '🖨️', name: '卡纸打印机', type: 'negative',
    effect: 'slot_limit_down', revealIcon: '🖨️', revealName: '卡纸打印机', weight: 15 },
  { id: 'system_crash',   icon: '💻', name: '系统崩溃', type: 'negative',
    effect: 'shuffle_slots', revealIcon: '💻', revealName: '系统崩溃', weight: 25 },
  { id: 'new_task',       icon: '📋', name: '临时加需求', type: 'negative',
    effect: 'add_cards_to_board', revealIcon: '📋', revealName: '临时加需求', weight: 15 },
  { id: 'paid_leave',     icon: '🌟', name: '带薪年假', type: 'positive',
    effect: 'wild_card', revealIcon: '🌟', revealName: '带薪年假', weight: 15 },
  { id: 'colleague_coffee', icon: '☕', name: '同事请咖啡', type: 'positive',
    effect: 'remove_most', revealIcon: '☕', revealName: '同事请咖啡', weight: 15 },
  { id: 'early_leave',    icon: '🎫', name: '提前下班券', type: 'positive',
    effect: 'add_steps_3', revealIcon: '🎫', revealName: '提前下班券', weight: 8 },
  { id: 'boss_favor',     icon: '🍀', name: '领导的宠儿', type: 'positive',
    effect: 'immune_negative_3', revealIcon: '🍀', revealName: '领导的宠儿', weight: 15 },
  { id: 'reimburse',      icon: '💰', name: '报销通过', type: 'positive',
    effect: 'double_happy_10', revealIcon: '💰', revealName: '报销通过', weight: 12 },
  { id: 'job_rotate',     icon: '🔀', name: '岗位轮换', type: 'dual',
    effect: 'random_transform_one', revealIcon: '🔀', revealName: '岗位轮换', weight: 20 },
  { id: 'overtime',       icon: '⏳', name: '加班申请', type: 'dual',
    effect: 'add_steps_5_boss_rise', revealIcon: '⏳', revealName: '加班申请', weight: 15 },
  { id: 'dept_dinner',    icon: '🍺', name: '部门聚餐', type: 'dual',
    effect: 'remove_3_slot_down', revealIcon: '🍺', revealName: '部门聚餐', weight: 15 },
  { id: 'weekly_report',  icon: '📊', name: '全员周报', type: 'dual',
    effect: 'reveal_add_boss', revealIcon: '📊', revealName: '全员周报', weight: 12 },
]
```

- [ ] **Step 9: 创建 src/config/levels.ts**

```typescript
import type { LevelConfig } from '../core/types'

export const LEVELS: Record<string, LevelConfig> = {
  level1: {
    id: 'level1',
    name: '第一关',
    normalCardTypes: 4,
    funcCardCount: 2,
    funcTypes: ['negative'],
    layers: 2,
    gridRows: 4,
    gridCols: 4,
    totalCards: 24,
    steps: 30,
    slotLimit: 7,
  },
  level2: {
    id: 'level2',
    name: '第二关',
    normalCardTypes: 7,
    funcCardCount: 12,
    funcTypes: ['negative', 'positive', 'dual'],
    funcRatio: { negative: 0.5, positive: 0.25, dual: 0.25 },
    layers: 4,
    gridRows: 5,
    gridCols: 5,
    totalCards: 48,
    steps: 35,
    slotLimit: 7,
  },
}

export function getLevelConfig(levelId: string): LevelConfig {
  return LEVELS[levelId] || LEVELS.level1
}
```

- [ ] **Step 10: 创建 src/config/skills.ts**

```typescript
import type { SkillConfig, SkillContext } from '../core/types'

export const SKILL_TAG = {
  RHYTHM: '节奏型',
  TOLERANCE: '容错型',
  EMERGENCY: '救急型',
  RELIEF: '减压型',
  WILD: '万能型',
  LIFE_SAVER: '保命型',
  ENDURANCE: '续航型',
  BURDEN: '减负型',
  INFO: '信息型',
  CLEAR: '定向清除',
  STRATEGY: '策略型',
  LEGENDARY: '传说型',
} as const

const SKILLS: SkillConfig[] = [
  { id: 'S1',  name: '飞行模式',     icon: '📵', tag: SKILL_TAG.RHYTHM,
    desc: '接下来3次点击不占槽位',
    apply: (ctx: SkillContext) => { ctx.slotFreeClicks = 3 } },
  { id: 'S2',  name: '同事掩护',     icon: '🤝', tag: SKILL_TAG.TOLERANCE,
    desc: '本局槽位上限+1',
    apply: (ctx: SkillContext) => { ctx.slotLimit += 1 } },
  { id: 'S3',  name: '提前下班',     icon: '⏰', tag: SKILL_TAG.EMERGENCY,
    desc: '立即清空槽位中数量最多的那种卡',
    apply: (ctx: SkillContext) => { ctx.clearMostInSlot = true } },
  { id: 'S4',  name: '清理桌面',     icon: '🗑️', tag: SKILL_TAG.RELIEF,
    desc: '随机移除棋盘上3张被压住的卡',
    apply: (ctx: SkillContext) => { ctx.removeCoveredCards = 3 } },
  { id: 'S5',  name: '假装工作',     icon: '🎭', tag: SKILL_TAG.WILD,
    desc: '将槽位中一张卡变成万能卡',
    apply: (ctx: SkillContext) => { ctx.transformToWild = 1 } },
  { id: 'S6',  name: '周报护体',     icon: '📊', tag: SKILL_TAG.LIFE_SAVER,
    desc: '下一次槽满时不失败，改为清空全部槽位',
    apply: (ctx: SkillContext) => { ctx.slotOverflowShield = true } },
  { id: 'S7',  name: '极限逃生',     icon: '🏃', tag: SKILL_TAG.ENDURANCE,
    desc: '额外获得5步',
    apply: (ctx: SkillContext) => { ctx.stepsRemaining += 5 } },
  { id: 'S8',  name: '老板出差',     icon: '👔', tag: SKILL_TAG.BURDEN,
    desc: '本局不再生成"老板巡视"卡',
    apply: (ctx: SkillContext) => { ctx.noMoreBossPatrol = true } },
  { id: 'S9',  name: '茶水间情报',   icon: '🍵', tag: SKILL_TAG.INFO,
    desc: '揭示所有❓事件卡身份',
    apply: (ctx: SkillContext) => { ctx.revealAllEvents = true } },
  { id: 'S10', name: '屏幕切换',     icon: '💻', tag: SKILL_TAG.CLEAR,
    desc: '指定一种卡，本局该种卡全部消除',
    apply: (ctx: SkillContext) => { ctx.selectAndClear = true } },
  { id: 'S11', name: '团建请假',     icon: '🎉', tag: SKILL_TAG.CLEAR,
    desc: '随机移除一种稀有卡的全部',
    apply: (ctx: SkillContext) => { ctx.clearRandomRare = true } },
  { id: 'S12', name: '带薪转岗',     icon: '🔄', tag: SKILL_TAG.STRATEGY,
    desc: '槽内任意两张卡互换位置',
    apply: (ctx: SkillContext) => { ctx.swapTwoInSlot = true } },
  { id: 'S13', name: '装死模式',     icon: '💤', tag: SKILL_TAG.TOLERANCE,
    desc: '接下来5步内，槽满上限临时变为9',
    apply: (ctx: SkillContext) => { ctx.tempSlotLimit9 = 5 } },
  { id: 'S14', name: '工作记忆',     icon: '🧠', tag: SKILL_TAG.WILD,
    desc: '获得一张万能卡进槽',
    apply: (ctx: SkillContext) => { ctx.gainWildCard = true } },
  { id: 'S15', name: '年度最佳员工', icon: '🏆', tag: SKILL_TAG.LEGENDARY,
    desc: '本局槽位上限+1，且技能触发次数+1',
    apply: (ctx: SkillContext) => { ctx.slotLimit += 1; ctx.extraSkillTrigger = true } },
  { id: 'S16', name: '忘记打卡',     icon: '🦄', tag: SKILL_TAG.LEGENDARY,
    desc: '本局取消步数限制，但槽位上限-2',
    apply: (ctx: SkillContext) => { ctx.stepsUnlimited = true; ctx.slotLimit = Math.max(3, ctx.slotLimit - 2) } },
  { id: 'S17', name: '无人办公室',   icon: '🔓', tag: SKILL_TAG.LEGENDARY,
    desc: '本局槽位上限取消，但步数减半',
    apply: (ctx: SkillContext) => { ctx.slotUnlimited = true; ctx.stepsRemaining = Math.floor(ctx.stepsRemaining / 2) } },
]

export function getRandomSkills(count: number = 3): SkillConfig[] {
  const pool = SKILLS.slice()
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  let hasLegendary = Math.random() < 0.2
  const result: SkillConfig[] = []
  for (let k = 0; k < pool.length && result.length < count; k++) {
    if (pool[k].tag === SKILL_TAG.LEGENDARY && !hasLegendary) continue
    if (pool[k].tag === SKILL_TAG.LEGENDARY) hasLegendary = false
    result.push(pool[k])
  }
  return result
}
```

- [ ] **Step 11: 类型检查 + 提交**

Run: `npx tsc --noEmit`
Expected: core/ + config/ 无类型错误（可能有 scenes/ 目录引用错误，忽略）

```bash
git add src/core/ src/config/
git rm -r src/game/ src/data/
git commit -m "feat: 核心逻辑层 — Board/Card/SlotBar/StepManager/SkillSystem/GameLogic 纯 TS + EventBus"
```

---

### Task 5: 视图层 — Button / CardView

**Files:**
- Create: `src/views/Button.ts`（从 src/ui/Button.js 升级）
- Create: `src/views/CardView.ts`（新增，纯渲染组件）
- Delete: `src/ui/Button.js`
- Delete: `src/ui/`（目录清空）

- [ ] **Step 1: 创建 src/views/Button.ts**

```typescript
import * as PIXI from 'pixi.js-legacy'

function hexToInt(hex: string): number {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result) {
    return (parseInt(result[1], 16) << 16) | (parseInt(result[2], 16) << 8) | parseInt(result[3], 16)
  }
  return 0xFF8C42
}

export interface ButtonOptions {
  bgColor?: string
  textColor?: string
  fontSize?: number
  radius?: number
  onClick?: (() => void) | null
  shadow?: boolean
}

export class Button {
  readonly container = new PIXI.Container()
  readonly hitArea: { x: number; y: number; w: number; h: number }
  onClick: (() => void) | null

  private bg: PIXI.Graphics
  private highlight: PIXI.Graphics
  private label: PIXI.Text
  private x: number; private y: number; private w: number; private h: number
  private bgColor: string; private textColor: string; private fontSize: number
  private radius: number; private shadow: boolean

  constructor(x: number, y: number, w: number, h: number, text: string, options: ButtonOptions = {}) {
    this.x = x; this.y = y; this.w = w; this.h = h
    this.bgColor = options.bgColor || '#FF8C42'
    this.textColor = options.textColor || '#FFFFFF'
    this.fontSize = options.fontSize || 16
    this.radius = options.radius !== undefined ? options.radius : 3
    this.onClick = options.onClick || null
    this.shadow = options.shadow !== undefined ? options.shadow : true

    this.hitArea = { x, y, w, h }

    this.bg = new PIXI.Graphics()
    this.highlight = new PIXI.Graphics()
    this.label = new PIXI.Text(text, {
      fontFamily: 'sans-serif',
      fontSize: this.fontSize,
      fontWeight: 'bold',
      fill: this.textColor,
      align: 'center',
    } as any)
    this.label.anchor.set(0.5)
    this.label.x = x + w / 2
    this.label.y = y + h / 2

    this.container.addChild(this.bg)
    this.container.addChild(this.highlight)
    this.container.addChild(this.label)
    this._redraw()
  }

  private _redraw(): void {
    const g = this.bg
    const { x, y, w, h } = this

    g.clear()
    if (this.shadow) {
      g.beginFill(0x000000, 0.15)
      g.drawRect(x + 2, y + 2, w, h)
      g.endFill()
    }
    g.beginFill(hexToInt(this.bgColor))
    g.drawRect(x, y, w, h)
    g.endFill()
    g.beginFill(0x000000, 0.18)
    g.drawRect(x, y + h - 2, w, 2)
    g.drawRect(x + w - 2, y, 2, h)
    g.endFill()

    const hl = this.highlight
    hl.clear()
    hl.beginFill(0xFFFFFF, 0.2)
    hl.drawRect(x + 1, y + 1, w - 2, 2)
    hl.drawRect(x + 1, y + 1, 2, h - 2)
    hl.endFill()
  }

  setText(text: string): void {
    this.label.text = text
  }
}
```

- [ ] **Step 2: 创建 src/views/CardView.ts**

CardView 是纯渲染组件，根据 BoardCard 数据渲染，不使用 PixiJS 事件（通过 EventManager 注册）：

```typescript
import * as PIXI from 'pixi.js-legacy'
import type { BoardCard } from '../core/types'
import { getCardColor } from '../core/Card'

export class CardView {
  readonly container = new PIXI.Container()
  readonly uid: string
  readonly cardWidth: number
  readonly cardHeight: number

  private isCovered: boolean

  constructor(card: BoardCard, cardWidth: number, cardHeight: number, layerOffsetX: number, layerOffsetY: number, gap: number, offsetX: number, offsetY: number) {
    this.uid = card.uid
    this.cardWidth = cardWidth
    this.cardHeight = cardHeight
    this.isCovered = card.isCovered

    const x = offsetX + card.col * (cardWidth + gap) + card.layer * layerOffsetX
    const y = offsetY + card.row * (cardHeight + gap) - card.layer * layerOffsetY
    this.container.x = x
    this.container.y = y

    this._draw(card, cardWidth, cardHeight)
  }

  private _draw(card: BoardCard, w: number, h: number): void {
    const color = getCardColor(card)
    const bgColorInt = hexToInt(color)

    const bg = new PIXI.Graphics()
    if (card.isCovered) {
      bg.beginFill(0xBDC3C7)
    } else {
      bg.beginFill(0xFFFFFF)
    }
    bg.drawRoundedRect(0, 0, w, h, 6)
    bg.endFill()
    bg.lineStyle(1.5, bgColorInt, card.isCovered ? 0.3 : 0.8)
    bg.drawRoundedRect(0, 0, w, h, 6)
    this.container.addChild(bg)

    if (card.isCovered) {
      const mask = new PIXI.Graphics()
      mask.beginFill(0x000000, 0.3)
      mask.drawRoundedRect(0, 0, w, h, 6)
      mask.endFill()
      this.container.addChild(mask)
    }

    const displayIcon = (card.type === 'event' && !card.isRevealed) ? '❓' : card.icon
    const iconText = new PIXI.Text(displayIcon, {
      fontFamily: 'sans-serif', fontSize: 28, align: 'center',
    } as any)
    iconText.anchor.set(0.5)
    iconText.x = w / 2
    iconText.y = h * 0.35
    this.container.addChild(iconText)

    const displayName = (card.type === 'event' && !card.isRevealed) ? '事件' : card.name
    const nameText = new PIXI.Text(displayName, {
      fontFamily: 'sans-serif', fontSize: 13,
      fill: card.isCovered ? '#999999' : '#333333', align: 'center',
    } as any)
    nameText.anchor.set(0.5)
    nameText.x = w / 2
    nameText.y = h * 0.7
    this.container.addChild(nameText)

    const bar = new PIXI.Graphics()
    bar.beginFill(bgColorInt, card.isCovered ? 0.4 : 0.9)
    bar.drawRect(4, h - 6, w - 8, 4)
    bar.endFill()
    this.container.addChild(bar)
  }

  destroy(): void {
    this.container.destroy({ children: true })
  }
}

function hexToInt(hex: string): number {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result) {
    return (parseInt(result[1], 16) << 16) | (parseInt(result[2], 16) << 8) | parseInt(result[3], 16)
  }
  return 0xFF8C42
}
```

- [ ] **Step 3: 删除旧 ui/ 目录**

```bash
rm -r src/ui/
```

- [ ] **Step 4: 提交**

```bash
git add src/views/
git rm -r src/ui/
git commit -m "feat: 视图层 — Button/CardView 纯渲染组件升级至 TS"
```

---

### Task 6: 场景层 — MenuScene / GameScene / PauseOverlay / ResultOverlay

**Files:**
- Create: `src/scenes/MenuScene.ts`（从 MenuScene.js 重写，继承新 Scene 基类）
- Create: `src/scenes/GameScene.ts`（从 GameScene.js 重写，事件驱动）
- Create: `src/scenes/overlays/PauseOverlay.ts`（新增）
- Create: `src/scenes/overlays/ResultOverlay.ts`（从 ResultScene.js 重写为覆盖层）
- Delete: `src/scenes/MenuScene.js`
- Delete: `src/scenes/GameScene.js`
- Delete: `src/scenes/ResultScene.js`
- Delete: `src/core/Scene.js`、`src/core/SceneManager.js`、`src/core/EventManager.js`、`src/core/Game.js`

- [ ] **Step 1: 创建 src/scenes/MenuScene.ts**

```typescript
import * as PIXI from 'pixi.js-legacy'
import { Scene } from '../engine/Scene'
import { Button } from '../views/Button'

export class MenuScene extends Scene {
  onEnter(_params?: unknown): void {
    const sysInfo = wx.getSystemInfoSync()
    const w = sysInfo.windowWidth
    const h = sysInfo.windowHeight

    // 标题
    const title = new PIXI.Text('摸鱼大师', {
      fontFamily: 'sans-serif', fontSize: 48, fontWeight: 'bold',
      fill: '#F39C12', align: 'center',
    } as any)
    title.anchor.set(0.5); title.x = w / 2; title.y = h * 0.25
    this.container.addChild(title)

    // 副标题
    const subtitle = new PIXI.Text('职场摸鱼三消挑战', {
      fontFamily: 'sans-serif', fontSize: 18, fill: '#BDC3C7', align: 'center',
    } as any)
    subtitle.anchor.set(0.5); subtitle.x = w / 2; subtitle.y = h * 0.33
    this.container.addChild(subtitle)

    // Emoji 装饰
    const deco = new PIXI.Text('📱 🚽 😴 🍜 🛒 💬 🎮', {
      fontFamily: 'sans-serif', fontSize: 24, align: 'center',
    } as any)
    deco.anchor.set(0.5); deco.x = w / 2; deco.y = h * 0.45
    this.container.addChild(deco)

    // 开始按钮
    const btnW = 200, btnH = 56
    const btn = new Button(
      Math.floor((w - btnW) / 2), Math.floor(h * 0.6), btnW, btnH,
      '开始摸鱼',
      { bgColor: '#E67E22', textColor: '#FFFFFF', fontSize: 22, radius: 8, shadow: true }
    )
    this.container.addChild(btn.container)
    this.registerHitArea(btn.hitArea, () => {
      // 动态 import GameScene
      const { GameScene } = require('../scenes/GameScene')
      this.manager.replace(new GameScene(), { levelId: 'level1' })
    }, 10)

    // 底部提示
    const tip = new PIXI.Text('点击卡片 → 集齐3张消除 → 触发技能', {
      fontFamily: 'sans-serif', fontSize: 13, fill: '#7F8C8D', align: 'center',
    } as any)
    tip.anchor.set(0.5); tip.x = w / 2; tip.y = h * 0.85
    this.container.addChild(tip)
  }
}
```

- [ ] **Step 2: 创建 src/scenes/GameScene.ts**

这是最大的文件，重写为事件驱动模式。GameScene 监听 core 层事件 → 渲染 UI：

```typescript
import * as PIXI from 'pixi.js-legacy'
import { Scene } from '../engine/Scene'
import { GameLogic } from '../core/GameLogic'
import { CardView } from '../views/CardView'
import { Button } from '../views/Button'
import { getLevelConfig } from '../config/levels'
import type { BoardCard, GameResult, SkillConfig, BoardInitEvent, StepsChangedEvent, CardToSlotEvent, BoardChangedEvent, EliminatedEvent, SkillTriggeredEvent, GameOverEvent } from '../core/types'
import { log } from '../utils/Logger'

const TAG = 'GameScene'

export class GameScene extends Scene {
  private logic!: GameLogic
  private boardLayer = new PIXI.Container()
  private slotLayer = new PIXI.Container()
  private hudLayer = new PIXI.Container()
  private cardViews = new Map<string, CardView>()
  private slotViews: (CardView | null)[] = []

  private levelId: string = 'level1'
  private screenW = 0
  private screenH = 0

  // 技能弹窗状态
  private pendingSkills: SkillConfig[] | null = null
  private skillHitAreas: Array<{ rect: { x: number; y: number; w: number; h: number }; callback: () => void }> = []
  private skillOverlay: PIXI.Graphics | null = null
  private skillPopupElements: PIXI.Container[] = []

  onEnter(params?: unknown): void {
    this.levelId = (params as any)?.levelId || 'level1'

    const sysInfo = wx.getSystemInfoSync()
    this.screenW = sysInfo.windowWidth
    this.screenH = sysInfo.windowHeight

    this.container.addChild(this.boardLayer)
    this.container.addChild(this.slotLayer)
    this.container.addChild(this.hudLayer)

    // 暂停按钮
    const pauseBtn = new Button(this.screenW - 130, 8, 120, 44, '暂停', {
      bgColor: '#7F8C8D', fontSize: 16, radius: 6,
    })
    this.container.addChild(pauseBtn.container)
    this.registerHitArea(pauseBtn.hitArea, () => {
      const { PauseOverlay } = require('./overlays/PauseOverlay')
      this.manager.push(new PauseOverlay())
    }, 15)

    // ── 订阅事件 ──
    this.listen<BoardInitEvent>('boardInit', (e) => this.renderBoard(e.cards))
    this.listen<StepsChangedEvent>('stepsChanged', (e) => this.renderHUD(e.remaining))
    this.listen<CardToSlotEvent>('cardToSlot', (e) => this.animateCardToSlot(e.card))
    this.listen<BoardChangedEvent>('boardChanged', (e) => this.syncBlocked(e.cards))
    this.listen<EliminatedEvent>('eliminated', (e) => this.onEliminated(e.uids))
    this.listen<SkillTriggeredEvent>('skillTriggered', (e) => this.showSkillSelection(e.skills))
    this.listen<GameOverEvent>('gameOver', (e) => this.onGameOver(e))

    // ── 初始化逻辑 ──
    const config = getLevelConfig(this.levelId)
    this.logic = new GameLogic(config, this.bus)

    // 订阅 slotChanged 重绘槽
    this.listen('slotChanged', () => this.renderSlotBar())

    this.logic.init(this.screenW, this.screenH)
    log(TAG, 'GameScene entered, level=' + this.levelId)
  }

  onUpdate(_dt: number): void {
    // 每帧注册卡片命中区域
    if (!this.pendingSkills) {
      this.registerCardHitAreas()
    } else {
      this.registerSkillHitAreas()
    }
  }

  onResume(): void {
    log(TAG, 'GameScene resumed')
  }

  onPause(): void {
    log(TAG, 'GameScene paused')
  }

  // ── 渲染 ──

  private renderBoard(cards: BoardCard[]): void {
    this.boardLayer.removeChildren()
    this.cardViews.clear()

    const board = this.logic.board
    for (const card of cards) {
      const view = new CardView(
        card, board.cardWidth, board.cardHeight,
        board.layerOffsetX, board.layerOffsetY,
        board.gap, board.offsetX, board.offsetY
      )
      this.boardLayer.addChild(view.container)
      this.cardViews.set(card.uid, view)
    }
  }

  private renderSlotBar(): void {
    this.slotLayer.removeChildren()
    this.slotViews = []

    const bar = this.logic.slotBar
    for (let i = 0; i < bar.maxSlots; i++) {
      const slot = bar.slots[i]
      const x = bar.startX + i * (bar.slotWidth + bar.gap)
      const y = bar.startY
      const w = bar.slotWidth, h = bar.slotHeight

      const bg = new PIXI.Graphics()
      if (slot) {
        bg.beginFill(0xFFFFFF)
        bg.drawRoundedRect(x, y, w, h, 4)
        bg.endFill()
        bg.lineStyle(1.5, hexToInt(getCardColorFromSlot(slot)), 0.8)
        bg.drawRoundedRect(x, y, w, h, 4)
        this.slotLayer.addChild(bg)

        const icon = (slot.type === 'event' && !slot.isRevealed) ? '❓' : slot.icon
        const iconTxt = new PIXI.Text(icon, { fontFamily: 'sans-serif', fontSize: 22, align: 'center' } as any)
        iconTxt.anchor.set(0.5); iconTxt.x = x + w / 2; iconTxt.y = y + h * 0.4
        this.slotLayer.addChild(iconTxt)

        const nameTxt = new PIXI.Text(slot.name, { fontFamily: 'sans-serif', fontSize: 10, fill: '#333', align: 'center' } as any)
        nameTxt.anchor.set(0.5); nameTxt.x = x + w / 2; nameTxt.y = y + h * 0.75
        this.slotLayer.addChild(nameTxt)
      } else {
        bg.lineStyle(1, 0xBDC3C7, 0.5)
        bg.drawRoundedRect(x, y, w, h, 4)
        this.slotLayer.addChild(bg)
      }
    }
  }

  private renderHUD(stepsRemaining?: number): void {
    this.hudLayer.removeChildren()
    const bar = this.logic.stepManager
    const config = getLevelConfig(this.levelId)
    const w = this.screenW

    const remaining = stepsRemaining ?? bar.stepsRemaining

    const levelTxt = new PIXI.Text(config.name, { fontFamily: 'sans-serif', fontSize: 14, fill: '#BDC3C7' } as any)
    levelTxt.x = 10; levelTxt.y = 8
    this.hudLayer.addChild(levelTxt)

    const stepsColor = remaining <= 5 ? '#E74C3C' : '#FFFFFF'
    const stepsTxt = new PIXI.Text('步数: ' + remaining, {
      fontFamily: 'sans-serif', fontSize: 18, fontWeight: 'bold', fill: stepsColor,
    } as any)
    stepsTxt.anchor.set(0.5, 0); stepsTxt.x = w / 2; stepsTxt.y = 5
    this.hudLayer.addChild(stepsTxt)

    const happyTxt = new PIXI.Text('😊 ' + this.logic.happyValue, {
      fontFamily: 'sans-serif', fontSize: 16, fontWeight: 'bold', fill: '#F1C40F',
    } as any)
    happyTxt.anchor.set(1, 0); happyTxt.x = w - 10; happyTxt.y = 8
    this.hudLayer.addChild(happyTxt)

    let slotStatus = this.logic.slotBar.getVacantCount() + ' 空格'
    if (bar.slotFreeClicks > 0) slotStatus += ' | 🛡️飞行中×' + bar.slotFreeClicks
    if (bar.tempSlotLimit9 > 0) slotStatus += ' | 💤装死中×' + bar.tempSlotLimit9
    const slotTxt = new PIXI.Text(slotStatus, { fontFamily: 'sans-serif', fontSize: 13, fill: '#95A5A6', align: 'center' } as any)
    slotTxt.anchor.set(0.5); slotTxt.x = w / 2; slotTxt.y = this.logic.slotBar.startY - 25
    this.hudLayer.addChild(slotTxt)
  }

  // ── 卡片命中区域 ──

  private registerCardHitAreas(): void {
    const clickable = this.logic.board.getClickableCards()
    const board = this.logic.board
    for (const card of clickable) {
      const view = this.cardViews.get(card.uid)
      if (!view) continue
      const rect = {
        x: view.container.x,
        y: view.container.y,
        w: board.cardWidth,
        h: board.cardHeight,
      }
      this.registerHitArea(rect, () => {
        this.logic.onCardClicked(card.uid)
        this.renderSlotBar()
        this.renderHUD()
        this.checkFailure()
      }, 5)
    }
  }

  private registerSkillHitAreas(): void {
    for (const item of this.skillHitAreas) {
      this.registerHitArea(item.rect, item.callback, 20)
    }
  }

  // ── 事件响应 ──

  private animateCardToSlot(card: BoardCard): void {
    const view = this.cardViews.get(card.uid)
    if (!view) return
    this.boardLayer.removeChild(view.container)
    this.renderSlotBar()
  }

  private syncBlocked(cards: Array<{ uid: string; blocked: boolean }>): void {
    // 遮挡状态变化 → 重建视图（简化处理）
    for (const { uid, blocked } of cards) {
      const view = this.cardViews.get(uid)
      if (view) view.container.alpha = blocked ? 0.4 : 1
    }
  }

  private onEliminated(uids: string[]): void {
    for (const uid of uids) {
      const view = this.cardViews.get(uid)
      if (view) {
        view.destroy()
        this.cardViews.delete(uid)
      }
    }
    this.renderSlotBar()
    this.renderHUD()
    this.logic.onEliminate(uids.length)
  }

  private checkFailure(): void {
    const bar = this.logic.slotBar
    const sm = this.logic.stepManager
    const slotFull = bar.isFull()

    let canEliminate = false
    const counts: Record<string, number> = {}
    for (let i = 0; i < bar.maxSlots; i++) {
      const s = bar.slots[i]; if (!s) continue
      counts[s.cardId] = (counts[s.cardId] || 0) + 1
    }
    for (const k in counts) { if (counts[k] >= 3) { canEliminate = true; break } }

    const result = sm.checkFailure(slotFull, canEliminate)
    if (result.shieldActivated) {
      bar.reset(bar.maxSlots)
      this.renderSlotBar()
      this.renderHUD()
      return
    }
    if (result.isFailed) {
      const reason = result.reason === 'steps' ? '步数耗尽！' : '被老板发现！'
      this.logic['_endGame'](false, reason) // 触发 gameOver 事件
    }
  }

  private showSkillSelection(skills: SkillConfig[]): void {
    this.pendingSkills = skills
    this.skillHitAreas = []

    const w = this.screenW, h = this.screenH
    const overlay = new PIXI.Graphics()
    overlay.beginFill(0x000000, 0.6); overlay.drawRect(0, 0, w, h); overlay.endFill()
    this.container.addChild(overlay)
    this.skillOverlay = overlay

    const popupTitle = new PIXI.Text('🎯 选择技能', {
      fontFamily: 'sans-serif', fontSize: 24, fontWeight: 'bold', fill: '#F39C12', align: 'center',
    } as any)
    popupTitle.anchor.set(0.5); popupTitle.x = w / 2; popupTitle.y = h * 0.15
    this.container.addChild(popupTitle)
    this.skillPopupElements.push(popupTitle)

    const self = this
    const btnW = w - 60, btnH = 80, startY = h * 0.25, gap = 20

    for (let i = 0; i < skills.length; i++) {
      ;((skill: SkillConfig, idx: number) => {
        const y = startY + idx * (btnH + gap)
        const sc = new PIXI.Container()

        const bg = new PIXI.Graphics()
        bg.beginFill(0x34495E); bg.drawRoundedRect(30, y, btnW, btnH, 8); bg.endFill()
        sc.addChild(bg)

        const iconTxt = new PIXI.Text(skill.icon, { fontFamily: 'sans-serif', fontSize: 28, align: 'center' } as any)
        iconTxt.anchor.set(0.5); iconTxt.x = 70; iconTxt.y = y + btnH / 2
        sc.addChild(iconTxt)

        const nameTxt = new PIXI.Text(skill.name, {
          fontFamily: 'sans-serif', fontSize: 18, fontWeight: 'bold', fill: '#FFFFFF', align: 'left',
        } as any)
        nameTxt.x = 100; nameTxt.y = y + 12
        sc.addChild(nameTxt)

        const descTxt = new PIXI.Text(skill.desc, {
          fontFamily: 'sans-serif', fontSize: 13, fill: '#BDC3C7', align: 'left',
        } as any)
        descTxt.x = 100; descTxt.y = y + 40
        sc.addChild(descTxt)

        const tagTxt = new PIXI.Text(skill.tag, {
          fontFamily: 'sans-serif', fontSize: 11, fill: '#F39C12', align: 'right',
        } as any)
        tagTxt.anchor.set(1, 0.5); tagTxt.x = 30 + btnW - 15; tagTxt.y = y + btnH / 2
        sc.addChild(tagTxt)

        self.container.addChild(sc)
        self.skillPopupElements.push(sc)

        self.skillHitAreas.push({
          rect: { x: 30, y, w: btnW, h: btnH },
          callback: () => self.onSkillSelected(skill),
        })
      })(skills[i], i)
    }
  }

  private onSkillSelected(skill: SkillConfig): void {
    // 清理弹窗
    if (this.skillOverlay) { this.container.removeChild(this.skillOverlay); this.skillOverlay = null }
    for (const el of this.skillPopupElements) { this.container.removeChild(el) }
    this.skillPopupElements = []
    this.skillHitAreas = []
    this.pendingSkills = null

    const ctx = this.logic.getSkillContext()
    this.logic.skillSystem.selectSkill(skill, ctx)
    this.renderHUD()
  }

  private onGameOver(result: GameResult): void {
    const { ResultOverlay } = require('./overlays/ResultOverlay')
    this.manager.push(new ResultOverlay(result))
  }
}

// Helper
function hexToInt(hex: string): number {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result) {
    return (parseInt(result[1], 16) << 16) | (parseInt(result[2], 16) << 8) | parseInt(result[3], 16)
  }
  return 0x95A5A6
}

function getCardColorFromSlot(slot: any): string {
  const config = slot.config
  if (slot.type === 'event' && !slot.isRevealed) return '#9B59B6'
  if (slot.type === 'event' && slot.isRevealed) {
    const t = config.type
    if (t === 'negative') return '#E74C3C'
    if (t === 'positive') return '#2ECC71'
    if (t === 'dual') return '#F39C12'
  }
  const r = config.rarity
  if (r === 'rare') return '#F1C40F'
  if (r === 'uncommon') return '#3498DB'
  return '#95A5A6'
}
```

- [ ] **Step 3: 创建 src/scenes/overlays/PauseOverlay.ts**

```typescript
import * as PIXI from 'pixi.js-legacy'
import { Scene } from '../../engine/Scene'
import { Button } from '../../views/Button'

export class PauseOverlay extends Scene {
  onEnter(): void {
    const sysInfo = wx.getSystemInfoSync()
    const w = sysInfo.windowWidth
    const h = sysInfo.windowHeight

    const mask = new PIXI.Graphics()
    mask.beginFill(0x000000, 0.6)
    mask.drawRect(0, 0, w, h)
    mask.endFill()
    this.container.addChild(mask)

    const txt = new PIXI.Text('已暂停', {
      fontFamily: 'sans-serif', fontSize: 48, fill: '#FFFFFF', fontWeight: 'bold', align: 'center',
    } as any)
    txt.anchor.set(0.5)
    txt.x = w / 2
    txt.y = h * 0.38
    this.container.addChild(txt)

    const btnW = 260, btnH = 70
    const resumeBtn = new Button(
      Math.floor((w - btnW) / 2), Math.floor(h * 0.5), btnW, btnH,
      '继续游戏',
      { bgColor: '#27AE60', fontSize: 22, radius: 8, shadow: true }
    )
    this.container.addChild(resumeBtn.container)
    this.registerHitArea(resumeBtn.hitArea, () => {
      this.manager.pop()
    }, 20)
  }
}
```

- [ ] **Step 4: 创建 src/scenes/overlays/ResultOverlay.ts**

```typescript
import * as PIXI from 'pixi.js-legacy'
import { Scene } from '../../engine/Scene'
import { Button } from '../../views/Button'
import type { GameResult } from '../../core/types'

export class ResultOverlay extends Scene {
  constructor(private result: GameResult) {
    super()
  }

  onEnter(): void {
    const sysInfo = wx.getSystemInfoSync()
    const w = sysInfo.windowWidth
    const h = sysInfo.windowHeight

    // 遮罩
    const mask = new PIXI.Graphics()
    mask.beginFill(0x1A252F, 0.95)
    mask.drawRect(0, 0, w, h)
    mask.endFill()
    this.container.addChild(mask)

    // 标题
    const titleText = this.result.won ? '🎉 通关成功！' : '😫 被老板发现！'
    const titleColor = this.result.won ? '#2ECC71' : '#E74C3C'
    const title = new PIXI.Text(titleText, {
      fontFamily: 'sans-serif', fontSize: 36, fontWeight: 'bold',
      fill: titleColor, align: 'center',
    } as any)
    title.anchor.set(0.5); title.x = w / 2; title.y = h * 0.2
    this.container.addChild(title)

    // 原因
    const reasonText = this.result.won ? '成功清空全部卡片' : ('失败原因: ' + this.result.reason)
    const reason = new PIXI.Text(reasonText, {
      fontFamily: 'sans-serif', fontSize: 14, fill: '#95A5A6', align: 'center',
    } as any)
    reason.anchor.set(0.5); reason.x = w / 2; reason.y = h * 0.3
    this.container.addChild(reason)

    // 快乐值
    const happyText = new PIXI.Text('快乐值: ' + this.result.happiness, {
      fontFamily: 'sans-serif', fontSize: 28, fontWeight: 'bold',
      fill: '#F1C40F', align: 'center',
    } as any)
    happyText.anchor.set(0.5); happyText.x = w / 2; happyText.y = h * 0.42
    this.container.addChild(happyText)

    // 统计
    const stats = '使用步数: ' + (this.result.stepsUsed || 0)
    const statsText = new PIXI.Text(stats, {
      fontFamily: 'sans-serif', fontSize: 14, fill: '#7F8C8D', align: 'center',
    } as any)
    statsText.anchor.set(0.5); statsText.x = w / 2; statsText.y = h * 0.52
    this.container.addChild(statsText)

    // 按钮
    const btnW = 180, btnH = 50

    const replayBtn = new Button(
      Math.floor((w - btnW) / 2), Math.floor(h * 0.63), btnW, btnH,
      '再来一局',
      { bgColor: '#27AE60', textColor: '#FFFFFF', fontSize: 18, radius: 8, shadow: true }
    )
    this.container.addChild(replayBtn.container)
    this.registerHitArea(replayBtn.hitArea, () => {
      const { GameScene } = require('../GameScene')
      this.manager.replace(new GameScene(), { levelId: this.result.levelId })
    }, 10)

    const menuBtn = new Button(
      Math.floor((w - btnW) / 2), Math.floor(h * 0.73), btnW, btnH,
      '返回菜单',
      { bgColor: '#7F8C8D', textColor: '#FFFFFF', fontSize: 18, radius: 8, shadow: true }
    )
    this.container.addChild(menuBtn.container)
    this.registerHitArea(menuBtn.hitArea, () => {
      const { MenuScene } = require('../MenuScene')
      this.manager.replace(new MenuScene())
    }, 10)
  }
}
```

- [ ] **Step 5: 清理旧代码**

```bash
rm src/core/Scene.js src/core/SceneManager.js src/core/EventManager.js src/core/Game.js
rm src/scenes/MenuScene.js src/scenes/GameScene.js src/scenes/ResultScene.js
```

- [ ] **Step 6: 运行 esbuild 构建验证**

Run: `npx esbuild src/main.minigame.ts --bundle --format=iife --outfile=game.js --platform=browser --global-name=game`
Expected: 无编译错误（类型检查可忽略，esbuild 不做类型检查）
Expected: 产出 `game.js` 文件

- [ ] **Step 7: 运行类型检查**

Run: `npx tsc --noEmit`
Expected: 应有少量 require() 相关的 any 类型警告，可接受（微信小游戏需要动态 require 来避免循环依赖）

- [ ] **Step 8: 提交**

```bash
git add src/scenes/
git rm src/scenes/MenuScene.js src/scenes/GameScene.js src/scenes/ResultScene.js
git rm src/core/Scene.js src/core/SceneManager.js src/core/EventManager.js src/core/Game.js
git commit -m "feat: 场景层 — MenuScene/GameScene/PauseOverlay/ResultOverlay 事件驱动重写"
```

---

### Task 7: 配置 & 存储验证 + 整体联调

**Files:**
- 验证: `src/config/` 所有文件
- 验证: `src/platform/storage.ts`
- 验证: `game.js` 整体构建

- [ ] **Step 1: 完整构建**

Run: `npm run build`
Expected: 无错误，产出 `game.js`

- [ ] **Step 2: 类型检查**

Run: `npm run type-check`
Expected: 通过或仅有少量 `require()` 警告

- [ ] **Step 3: 浏览器快速冒烟测试**

在 `src/main.ts` 中构建浏览器版本验证：
Run: `npx esbuild src/main.ts --bundle --outfile=dist/bundle.js --sourcemap --platform=browser --global-name=game`
Expected: 产出 dist/bundle.js，用本地 HTML 页面加载后能看到菜单画面

- [ ] **Step 4: 微信开发者工具验证**

将整个项目导入微信开发者工具：
Expected:
- 菜单画面正常渲染
- 点击"开始摸鱼"进入游戏画面
- 卡片可点击、消除、HUD 更新
- 暂停按钮弹出 PauseOverlay，按继续恢复
- 通关/失败弹出 ResultOverlay
- "再来一局"和"返回菜单"按钮正常

- [ ] **Step 5: 提交最终版本**

```bash
git add -A
git commit -m "feat: 联调通过 — 栈式场景架构 + TS 迁移完成"
```
