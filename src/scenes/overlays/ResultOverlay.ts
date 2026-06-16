import * as PIXI from 'pixi.js-legacy'
import { Scene } from '../../engine/Scene'
import { Button } from '../../views/Button'
import type { GameResult } from '../../core/types'

export class ResultOverlay extends Scene {
  private _replayHitArea: { x: number; y: number; w: number; h: number } | null = null
  private _replayCallback: (() => void) | null = null
  private _menuHitArea: { x: number; y: number; w: number; h: number } | null = null
  private _menuCallback: (() => void) | null = null

  constructor(private result: GameResult) {
    super()
  }

  onEnter(): void {
    const sysInfo = wx.getSystemInfoSync()
    const w = sysInfo.windowWidth
    const h = sysInfo.windowHeight

    const mask = new PIXI.Graphics()
    mask.beginFill(0x1A252F, 0.95)
    mask.drawRect(0, 0, w, h)
    mask.endFill()
    this.container.addChild(mask)

    const titleText = this.result.won ? '🎉 通关成功！' : '😫 被老板发现！'
    const titleColor = this.result.won ? '#2ECC71' : '#E74C3C'
    const title = new PIXI.Text(titleText, {
      fontFamily: 'sans-serif', fontSize: 36, fontWeight: 'bold',
      fill: titleColor, align: 'center',
    } as any)
    title.anchor.set(0.5); title.x = w / 2; title.y = h * 0.2
    this.container.addChild(title)

    const reasonText = this.result.won ? '成功清空全部卡片' : ('失败原因: ' + this.result.reason)
    const reason = new PIXI.Text(reasonText, {
      fontFamily: 'sans-serif', fontSize: 14, fill: '#95A5A6', align: 'center',
    } as any)
    reason.anchor.set(0.5); reason.x = w / 2; reason.y = h * 0.3
    this.container.addChild(reason)

    const happyText = new PIXI.Text('快乐值: ' + this.result.happiness, {
      fontFamily: 'sans-serif', fontSize: 28, fontWeight: 'bold',
      fill: '#F1C40F', align: 'center',
    } as any)
    happyText.anchor.set(0.5); happyText.x = w / 2; happyText.y = h * 0.42
    this.container.addChild(happyText)

    const stats = '使用步数: ' + (this.result.stepsUsed || 0)
    const statsText = new PIXI.Text(stats, {
      fontFamily: 'sans-serif', fontSize: 14, fill: '#7F8C8D', align: 'center',
    } as any)
    statsText.anchor.set(0.5); statsText.x = w / 2; statsText.y = h * 0.52
    this.container.addChild(statsText)

    const btnW = 180, btnH = 50

    const replayBtn = new Button(
      Math.floor((w - btnW) / 2), Math.floor(h * 0.63), btnW, btnH,
      '再来一局',
      { bgColor: '#27AE60', textColor: '#FFFFFF', fontSize: 18, radius: 8, shadow: true }
    )
    this.container.addChild(replayBtn.container)
    this._replayHitArea = replayBtn.hitArea
    this._replayCallback = () => {
      const { GameScene } = require('../GameScene')
      this.manager.replace(new GameScene(), { levelId: this.result.levelId })
    }

    const menuBtn = new Button(
      Math.floor((w - btnW) / 2), Math.floor(h * 0.73), btnW, btnH,
      '返回菜单',
      { bgColor: '#7F8C8D', textColor: '#FFFFFF', fontSize: 18, radius: 8, shadow: true }
    )
    this.container.addChild(menuBtn.container)
    this._menuHitArea = menuBtn.hitArea
    this._menuCallback = () => {
      const { MenuScene } = require('../MenuScene')
      this.manager.replace(new MenuScene())
    }
  }

  /** 每帧重注册命中区域 */
  onUpdate(_dt: number): void {
    if (this._replayHitArea && this._replayCallback) {
      this.registerHitArea(this._replayHitArea, this._replayCallback, 10)
    }
    if (this._menuHitArea && this._menuCallback) {
      this.registerHitArea(this._menuHitArea, this._menuCallback, 10)
    }
  }
}
