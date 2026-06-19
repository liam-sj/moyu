import * as PIXI from 'pixi.js-legacy'
import { Scene } from '../engine/Scene'
import { Button } from '../views/Button'
import { createCardImage, onAtlasReady } from '../views/CardView'

export class MenuScene extends Scene {
  private _startHitArea: { x: number; y: number; w: number; h: number } | null = null
  private _startCallback: (() => void) | null = null

  onEnter(_params?: unknown): void {
    const sysInfo = wx.getSystemInfoSync()
    const w = sysInfo.windowWidth
    const h = sysInfo.windowHeight

    const bg = new PIXI.Graphics()
    bg.beginFill(0xC8A87C)
    bg.drawRect(0, 0, w, h)
    bg.endFill()
    this.container.addChild(bg)

    const title = new PIXI.Text('摸鱼大师', {
      fontFamily: 'sans-serif', fontSize: 48, fontWeight: 'bold',
      fill: '#F39C12', align: 'center',
    } as any)
    title.anchor.set(0.5); title.x = w / 2; title.y = h * 0.20
    this.container.addChild(title)

    const subtitle = new PIXI.Text('职场摸鱼三消挑战', {
      fontFamily: 'sans-serif', fontSize: 18, fill: '#5C3828', align: 'center',
    } as any)
    subtitle.anchor.set(0.5); subtitle.x = w / 2; subtitle.y = h * 0.28
    this.container.addChild(subtitle)

    // Show actual card sprites in 2 rows (4+3) — may re-render when atlas loads
    const cardList = ['phone', 'toilet', 'sleep', 'snack', 'shop', 'gossip', 'game']
    const cols = 4; const cardW = 50; const cardH = 65; const gap = 12
    const totalW = cols * cardW + (cols - 1) * gap
    const startX = (w - totalW) / 2; const startY = h * 0.36
    const cardContainer = new PIXI.Container()
    this.container.addChild(cardContainer)

    const renderCards = () => {
      cardContainer.removeChildren()
      for (let i = 0; i < cardList.length; i++) {
        const col = i % cols; const row = Math.floor(i / cols)
        const img = createCardImage(cardList[i], '', false, false, cardW, cardH, false)
        img.x = startX + col * (cardW + gap) + cardW / 2
        img.y = startY + row * (cardH + gap) + cardH / 2
        cardContainer.addChild(img)
      }
    }
    renderCards()
    // Re-render when atlas finishes loading
    onAtlasReady(() => renderCards())

    const btnW = 200, btnH = 56
    const btn = new Button(
      Math.floor((w - btnW) / 2), Math.floor(h * 0.58), btnW, btnH,
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
      fontFamily: 'sans-serif', fontSize: 13, fill: '#5C3828', align: 'center',
    } as any)
    tip.anchor.set(0.5); tip.x = w / 2; tip.y = h * 0.82
    this.container.addChild(tip)
  }

  onUpdate(_dt: number): void {
    if (this._startHitArea && this._startCallback) {
      this.registerHitArea(this._startHitArea, this._startCallback, 10)
    }
  }
}
