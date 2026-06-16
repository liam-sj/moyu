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

    // Mask
    const mask = new PIXI.Graphics()
    mask.beginFill(0x1A252F, 0.95)
    mask.drawRect(0, 0, w, h)
    mask.endFill()
    this.container.addChild(mask)

    // Title
    const titleText = this.result.won ? '🎉 通关成功！' : '😫 被老板发现！'
    const titleColor = this.result.won ? '#2ECC71' : '#E74C3C'
    const title = new PIXI.Text(titleText, {
      fontFamily: 'sans-serif', fontSize: 36, fontWeight: 'bold',
      fill: titleColor, align: 'center',
    } as any)
    title.anchor.set(0.5); title.x = w / 2; title.y = h * 0.2
    this.container.addChild(title)

    // Reason
    const reasonText = this.result.won ? '成功清空全部卡片' : ('失败原因: ' + this.result.reason)
    const reason = new PIXI.Text(reasonText, {
      fontFamily: 'sans-serif', fontSize: 14, fill: '#95A5A6', align: 'center',
    } as any)
    reason.anchor.set(0.5); reason.x = w / 2; reason.y = h * 0.3
    this.container.addChild(reason)

    // Happiness
    const happyText = new PIXI.Text('快乐值: ' + this.result.happiness, {
      fontFamily: 'sans-serif', fontSize: 28, fontWeight: 'bold',
      fill: '#F1C40F', align: 'center',
    } as any)
    happyText.anchor.set(0.5); happyText.x = w / 2; happyText.y = h * 0.42
    this.container.addChild(happyText)

    // Stats
    const stats = '使用步数: ' + (this.result.stepsUsed || 0)
    const statsText = new PIXI.Text(stats, {
      fontFamily: 'sans-serif', fontSize: 14, fill: '#7F8C8D', align: 'center',
    } as any)
    statsText.anchor.set(0.5); statsText.x = w / 2; statsText.y = h * 0.52
    this.container.addChild(statsText)

    // Buttons
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
