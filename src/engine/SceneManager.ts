import * as PIXI from 'pixi.js-legacy'
import type { Scene } from './Scene'
import { EventBus } from './EventBus'
import { EventManager } from './EventManager'

interface Transition {
  oldScene: Scene | null
  newScene: Scene
  elapsed: number
  duration: number
}

export class SceneManager {
  private stack: Scene[] = []
  readonly bus = new EventBus()
  readonly eventManager: EventManager
  private _transition: Transition | null = null

  constructor(private root: PIXI.Container) {
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

  /** Slide-replace: old scene slides out left, new slides in from right. */
  slideReplace(scene: Scene, params?: unknown, duration = 50): void {
    if (this._transition) return

    const oldScene = this.current
    const screenW = (typeof wx !== 'undefined')
      ? wx.getSystemInfoSync().windowWidth
      : (document.documentElement.clientWidth || 375)

    // Pause old scene but keep it alive
    if (oldScene) oldScene.onPause()

    // Mount new scene off-screen right
    scene._mount(this, this.bus, this.eventManager)
    this.root.addChild(scene.container)
    scene.container.x = screenW
    this.stack.push(scene)
    scene.onEnter(params)

    this._transition = {
      oldScene: oldScene || null,
      newScene: scene,
      elapsed: 0,
      duration,
    }
  }

  update(dt: number): void {
    if (this._transition) {
      const trans = this._transition
      trans.elapsed += dt
      const progress = Math.min(trans.elapsed / trans.duration, 1)
      const t = 1 - Math.pow(1 - progress, 3)
      const screenW = (typeof wx !== 'undefined')
        ? wx.getSystemInfoSync().windowWidth
        : (document.documentElement.clientWidth || 375)

      // Old scene slides left, new scene slides in from right
      if (trans.oldScene) {
        trans.oldScene.container.x = Math.round(-screenW * t)
      }
      trans.newScene.container.x = Math.round(screenW * (1 - t))
      trans.newScene.onUpdate(dt)

      if (progress >= 1) {
        trans.newScene.container.x = 0
        trans.newScene.onResume()
        // Clean up old scene
        if (trans.oldScene) {
          trans.oldScene.onExit()
          this.root.removeChild(trans.oldScene.container)
          trans.oldScene._teardown()
          const idx = this.stack.indexOf(trans.oldScene)
          if (idx !== -1) this.stack.splice(idx, 1)
        }
        this._transition = null
      }
      return
    }

    this.current?.onUpdate(dt)
  }
}
