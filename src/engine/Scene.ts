import * as PIXI from 'pixi.js-legacy'
import type { SceneManager } from './SceneManager'
import type { EventBus } from './EventBus'
import type { EventManager } from './EventManager'

export abstract class Scene {
  readonly container = new PIXI.Container()

  protected manager!: SceneManager
  protected bus!: EventBus
  protected eventManager!: EventManager

  private disposers: Array<() => void> = []

  /** 框架内部：注入依赖，子类勿动 */
  _mount(manager: SceneManager, bus: EventBus, eventManager: EventManager): void {
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
