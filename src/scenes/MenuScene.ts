import * as PIXI from 'pixi.js-legacy'
import { Scene } from '../engine/Scene'
import { Button } from '../views/Button'
import { createCardImage, onAtlasReady } from '../views/CardView'
import { getCachedPond, getPondById } from '../config/ponds'

export class MenuScene extends Scene {
  private _startHitArea: { x: number; y: number; w: number; h: number } | null = null
  private _startCallback: (() => void) | null = null
  private _rankingContainer: PIXI.Container | null = null

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

    // ── Fish Pond Card ──
    const cachedPond = getCachedPond()
    const pondCfg = cachedPond ? getPondById(cachedPond.pondId) : null
    const pondCardY = h * 0.30
    const pondCardH = pondCfg ? 65 : 40

    if (pondCfg && cachedPond) {
      // Has pond: show card
      const cardBg = new PIXI.Graphics()
      cardBg.beginFill(0x2C3E50, 0.9)
      cardBg.drawRoundedRect(16, pondCardY, w - 32, pondCardH, 10)
      cardBg.endFill()
      cardBg.lineStyle(2, pondCfg.colorInt, 0.6)
      cardBg.drawRoundedRect(16, pondCardY, w - 32, pondCardH, 10)
      this.container.addChild(cardBg)

      const pondIcon = new PIXI.Text(pondCfg.emoji + ' ' + pondCfg.name, {
        fontFamily: 'sans-serif', fontSize: 18, fontWeight: 'bold', fill: '#FFFFFF',
      } as any)
      pondIcon.x = 28; pondIcon.y = pondCardY + 10
      this.container.addChild(pondIcon)

      const sloganTxt = new PIXI.Text(pondCfg.slogan, {
        fontFamily: 'sans-serif', fontSize: 11, fill: '#BDC3C7',
      } as any)
      sloganTxt.x = 28; sloganTxt.y = pondCardY + 38
      this.container.addChild(sloganTxt)
    } else {
      // No pond yet: show prompt
      const promptBg = new PIXI.Graphics()
      promptBg.beginFill(0x2C3E50, 0.6)
      promptBg.drawRoundedRect(16, pondCardY, w - 32, pondCardH, 10)
      promptBg.endFill()
      this.container.addChild(promptBg)

      const promptTxt = new PIXI.Text('🐟 通关后选择你的鱼，加入鱼塘', {
        fontFamily: 'sans-serif', fontSize: 14, fill: '#95A5A6', align: 'center',
      } as any)
      promptTxt.anchor.set(0.5); promptTxt.x = w / 2; promptTxt.y = pondCardY + pondCardH / 2
      this.container.addChild(promptTxt)
    }

    // ── Ranking Bar (simple local cache version) ──
    const rankingY = pondCardY + pondCardH + 12
    this._loadRankingBar(w, rankingY)

    // Show actual card sprites in 2 rows (4+3) — may re-render when atlas loads
    const cardList = ['phone', 'toilet', 'sleep', 'snack', 'shop', 'gossip', 'game']
    const cols = 4; const cardW = 50; const cardH = 65; const gap = 12
    const totalW = cols * cardW + (cols - 1) * gap
    const startX = (w - totalW) / 2; const startY = h * 0.45
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
      Math.floor((w - btnW) / 2), Math.floor(h * 0.64), btnW, btnH,
      '开始摸鱼',
      { bgColor: '#E67E22', textColor: '#FFFFFF', fontSize: 22, radius: 8, shadow: true }
    )
    this.container.addChild(btn.container)
    this._startHitArea = btn.hitArea
    this._startCallback = () => {
      const cached = getCachedPond()
      if (!cached) {
        // No pond yet — check if they've cleared level 2 before
        const hasClearedL2 = wx.getStorageSync('cleared_level2')
        if (hasClearedL2 && !wx.getStorageSync('fish_selection_shown')) {
          const { SelectFishScene } = require('./SelectFishScene')
          this.manager.replace(new SelectFishScene())
          return
        }
      }
      const { GameScene } = require('./GameScene')
      this.manager.replace(new GameScene(), { levelId: 'level1' })
    }

    const tip = new PIXI.Text('点击卡片 → 集齐3张消除 → 触发技能', {
      fontFamily: 'sans-serif', fontSize: 13, fill: '#5C3828', align: 'center',
    } as any)
    tip.anchor.set(0.5); tip.x = w / 2; tip.y = h * 0.86
    this.container.addChild(tip)
  }

  private async _loadRankingBar(w: number, y: number): Promise<void> {
    if (this._rankingContainer) {
      this.container.removeChild(this._rankingContainer)
      this._rankingContainer.destroy({ children: true })
    }
    const ctn = new PIXI.Container()
    this._rankingContainer = ctn
    this.container.addChild(ctn)

    try {
      const res = await wx.cloud.callFunction({ name: 'getPondRanking', data: {} })
      const data = (res as any).result
      if (!data.ok || !data.rankings) return
      const top = data.rankings.slice(0, 5)
      const startX = 16; const barY = y
      const medals = ['🥇', '🥈', '🥉']

      const label = new PIXI.Text('🏆 今日最肥鱼塘', {
        fontFamily: 'sans-serif', fontSize: 11, fill: '#F39C12', fontWeight: 'bold',
      } as any)
      label.x = startX; label.y = barY
      ctn.addChild(label)

      let rx = startX + 110
      for (let i = 0; i < top.length; i++) {
        const pond = getPondById(top[i].pondId)
        if (!pond) continue
        const txt = new PIXI.Text(`${medals[i] || ''}${pond.emoji}${top[i].dailyClears}`, {
          fontFamily: 'sans-serif', fontSize: 11, fill: '#BDC3C7',
        } as any)
        txt.x = rx; txt.y = barY
        ctn.addChild(txt)
        rx += txt.width + 16
      }
    } catch (e) {
      // Cloud call failed — skip ranking
    }
  }

  onUpdate(_dt: number): void {
    if (this._startHitArea && this._startCallback) {
      this.registerHitArea(this._startHitArea, this._startCallback, 10)
    }
  }
}
