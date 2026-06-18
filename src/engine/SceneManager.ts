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

  /** Slide-replace: new scene slides in from right. Clean and simple. */
  slideReplace(scene: Scene, params?: unknown, duration = 50): void {
    if (this._transition) return

    // Immediately clean up old scene
    while (this.stack.length > 0) {
      const top = this.stack.pop()!
      top.onExit()
      this.root.removeChild(top.container)
      top._teardown()
    }

    const screenW = (typeof wx !== 'undefined')
      ? wx.getSystemInfoSync().windowWidth
      : (document.documentElement.clientWidth || 375)

    // Mount new scene off-screen right
    scene._mount(this, this.bus, this.eventManager)
    this.root.addChild(scene.container)
    scene.container.x = screenW
    this.stack.push(scene)
    scene.onEnter(params)

    this._transition = {
      oldScene: null,
      newScene: scene,
      elapsed: 0,
      duration,
    }
  }

  update(dt: number): void {
    if (this._transition) {
      const trans = this._transition  // capture ref so we can null it safely
      trans.elapsed += dt
      const progress = Math.min(trans.elapsed / trans.duration, 1)
      const t = 1 - Math.pow(1 - progress, 3)
      const screenW = (typeof wx !== 'undefined')
        ? wx.getSystemInfoSync().windowWidth
        : (document.documentElement.clientWidth || 375)

      trans.newScene.container.x = Math.round(screenW * (1 - t))
      trans.newScene.onUpdate(dt)

      if (progress >= 1) {
        trans.newScene.container.x = 0
        trans.newScene.onResume()
        this._transition = null
      }
      return
    }

    this.current?.onUpdate(dt)
  }
}
