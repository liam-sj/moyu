import * as PIXI from 'pixi.js-legacy'
import type { Scene } from './Scene'
import { EventBus } from './EventBus'
import { EventManager } from './EventManager'

export class SceneManager {
  private stack: Scene[] = []
  readonly bus = new EventBus()
  readonly eventManager: EventManager

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

  update(dt: number): void {
    this.current?.onUpdate(dt)
  }
}
