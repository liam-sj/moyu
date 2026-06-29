import * as PIXI from 'pixi.js-legacy'
import { Scene } from '../../engine/Scene'
import { Button } from '../../views/Button'
import type { GameResult } from '../../core/types'
import { LEVELS } from '../../config/levels'

const LEVEL_ORDER = ['level1', 'level2']

function getNextLevelId(current: string): string | null {
  const idx = LEVEL_ORDER.indexOf(current)
  if (idx === -1 || idx >= LEVEL_ORDER.length - 1) return null
  return LEVEL_ORDER[idx + 1]
}

export class ResultOverlay extends Scene {
  private _hitAreas: Array<{ rect: { x: number; y: number; w: number; h: number }; cb: () => void }> = []

  constructor(private result: GameResult, private onRevive?: () => void) {
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

    const nextLevelId = getNextLevelId(this.result.levelId)
    const nextLevelName = nextLevelId ? (LEVELS[nextLevelId]?.name || '下一关') : ''

    const titleText = this.result.won ? '🎉 成功摸到鱼！' : '🦈 被鲨鱼抓住了！'
    const titleColor = this.result.won ? '#2ECC71' : '#E74C3C'
    const title = new PIXI.Text(titleText, {
      fontFamily: 'sans-serif', fontSize: 36, fontWeight: 'bold',
      fill: titleColor, align: 'center',
    } as any)
    title.anchor.set(0.5); title.x = w / 2; title.y = h * 0.15
    this.container.addChild(title)

    const reasonText = this.result.won
      ? (nextLevelId ? '准备挑战 ' + nextLevelName + '！' : '成功清空全部卡片')
      : ('失败原因: ' + this.result.reason)
    const reason = new PIXI.Text(reasonText, {
      fontFamily: 'sans-serif', fontSize: 14, fill: '#9B8B7A', align: 'center',
    } as any)
    reason.anchor.set(0.5); reason.x = w / 2; reason.y = h * 0.24
    this.container.addChild(reason)

    const stats = '使用步数: ' + (this.result.stepsUsed || 0)
    const statsText = new PIXI.Text(stats, {
      fontFamily: 'sans-serif', fontSize: 14, fill: '#7F8C8D', align: 'center',
    } as any)
    statsText.anchor.set(0.5); statsText.x = w / 2; statsText.y = h * 0.42
    this.container.addChild(statsText)

    const btnW = 180, btnH = 50

    if (this.result.won && nextLevelId) {
      const nextBtn = new Button(
        Math.floor((w - btnW) / 2), Math.floor(h * 0.54), btnW, btnH,
        '下一关 → ' + nextLevelName,
        { bgColor: '#E67E22', textColor: '#FFFFFF', fontSize: 18, radius: 8, shadow: true }
      )
      this.container.addChild(nextBtn.container)
      this._hitAreas.push({ rect: nextBtn.hitArea, cb: () => {
        const { GameScene } = require('../GameScene')
        this.manager.replace(new GameScene(), { levelId: nextLevelId })
      }})

      const menuBtn = new Button(
        Math.floor((w - btnW) / 2), Math.floor(h * 0.66), btnW, btnH,
        '返回菜单',
        { bgColor: '#7F8C8D', textColor: '#FFFFFF', fontSize: 18, radius: 8, shadow: true }
      )
      this.container.addChild(menuBtn.container)
      this._hitAreas.push({ rect: menuBtn.hitArea, cb: () => {
        const { MenuScene } = require('../MenuScene')
        this.manager.replace(new MenuScene())
      }})
    } else if (this.result.won && !nextLevelId) {
      const menuBtn = new Button(
        Math.floor((w - btnW) / 2), Math.floor(h * 0.54), btnW, btnH,
        '🎊 全部通关！返回菜单',
        { bgColor: '#E67E22', textColor: '#FFFFFF', fontSize: 18, radius: 8, shadow: true }
      )
      this.container.addChild(menuBtn.container)
      this._hitAreas.push({ rect: menuBtn.hitArea, cb: () => {
        const { MenuScene } = require('../MenuScene')
        this.manager.replace(new MenuScene())
      }})
    } else {
      // Lost: show revive + replay + menu
      const reviveBtn = new Button(
        Math.floor((w - btnW) / 2), Math.floor(h * 0.52), btnW, btnH,
        '💫 复活 (移出3张)',
        { bgColor: '#E74C3C', textColor: '#FFFFFF', fontSize: 16, radius: 8, shadow: true }
      )
      this.container.addChild(reviveBtn.container)
      this._hitAreas.push({ rect: reviveBtn.hitArea, cb: () => {
        if (this.onRevive) this.onRevive()
        this.manager.pop()
      }})

      const replayBtn = new Button(
        Math.floor((w - btnW) / 2), Math.floor(h * 0.64), btnW, btnH,
        '再来一局',
        { bgColor: '#27AE60', textColor: '#FFFFFF', fontSize: 18, radius: 8, shadow: true }
      )
      this.container.addChild(replayBtn.container)
      this._hitAreas.push({ rect: replayBtn.hitArea, cb: () => {
        const { GameScene } = require('../GameScene')
        this.manager.replace(new GameScene(), { levelId: this.result.levelId })
      }})

      const menuBtn = new Button(
        Math.floor((w - btnW) / 2), Math.floor(h * 0.76), btnW, btnH,
        '返回菜单',
        { bgColor: '#7F8C8D', textColor: '#FFFFFF', fontSize: 18, radius: 8, shadow: true }
      )
      this.container.addChild(menuBtn.container)
      this._hitAreas.push({ rect: menuBtn.hitArea, cb: () => {
        const { MenuScene } = require('../MenuScene')
        this.manager.replace(new MenuScene())
      }})
    }
  }

  /** 每帧重注册命中区域 */
  onUpdate(_dt: number): void {
    for (const item of this._hitAreas) {
      this.registerHitArea(item.rect, item.cb, 10)
    }
  }
}
