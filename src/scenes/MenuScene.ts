import * as PIXI from 'pixi.js-legacy'
import { Scene } from '../engine/Scene'
import { Button } from '../views/Button'

export class MenuScene extends Scene {
  private _startHitArea: { x: number; y: number; w: number; h: number } | null = null
  private _startCallback: (() => void) | null = null

  onEnter(_params?: unknown): void {
    const sysInfo = wx.getSystemInfoSync()
    const w = sysInfo.windowWidth
    const h = sysInfo.windowHeight

    const title = new PIXI.Text('摸鱼大师', {
      fontFamily: 'sans-serif', fontSize: 48, fontWeight: 'bold',
      fill: '#F39C12', align: 'center',
    } as any)
    title.anchor.set(0.5); title.x = w / 2; title.y = h * 0.25
    this.container.addChild(title)

    const subtitle = new PIXI.Text('职场摸鱼三消挑战', {
      fontFamily: 'sans-serif', fontSize: 18, fill: '#BDC3C7', align: 'center',
    } as any)
    subtitle.anchor.set(0.5); subtitle.x = w / 2; subtitle.y = h * 0.33
    this.container.addChild(subtitle)

    const deco = new PIXI.Text('📱 🚽 😴 🍜 🛒 💬 🎮', {
      fontFamily: 'sans-serif', fontSize: 24, align: 'center',
    } as any)
    deco.anchor.set(0.5); deco.x = w / 2; deco.y = h * 0.45
    this.container.addChild(deco)

    const btnW = 200, btnH = 56
    const btn = new Button(
      Math.floor((w - btnW) / 2), Math.floor(h * 0.6), btnW, btnH,
      '开始摸鱼',
      { bgColor: '#E67E22', textColor: '#FFFFFF', fontSize: 22, radius: 8, shadow: true }
    )
    this.container.addChild(btn.container)
    this._startHitArea = btn.hitArea
    this._startCallback = () => {
      const { GameScene } = require('./GameScene')
      this.manager.replace(new GameScene(), { levelId: 'level1' })
    }

    const tip = new PIXI.Text('点击卡片 → 集齐3张消除 → 触发技能', {
      fontFamily: 'sans-serif', fontSize: 13, fill: '#7F8C8D', align: 'center',
    } as any)
    tip.anchor.set(0.5); tip.x = w / 2; tip.y = h * 0.85
    this.container.addChild(tip)
  }

  /** 每帧重注册命中区域（因为 EventManager.clearHitAreas 每帧清空） */
  onUpdate(_dt: number): void {
    if (this._startHitArea && this._startCallback) {
      this.registerHitArea(this._startHitArea, this._startCallback, 10)
    }
  }
}
