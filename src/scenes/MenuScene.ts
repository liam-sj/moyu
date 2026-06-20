import * as PIXI from 'pixi.js-legacy'
import { Scene } from '../engine/Scene'
import { Button } from '../views/Button'
import { createCardImage, onAtlasReady } from '../views/CardView'
import { getCachedPond, getPondById } from '../config/ponds'
import { generatePoster } from '../utils/SharePoster'

export class MenuScene extends Scene {
  private _startHitArea: { x: number; y: number; w: number; h: number } | null = null
  private _startCallback: (() => void) | null = null
  private _rankingContainer: PIXI.Container | null = null
  private _rankingTab: string = 'fat'
  private _rankingData: any = null
  private _tabHitAreas: Array<{ rect: { x: number; y: number; w: number; h: number }; cb: () => void }> = []
  private _shareHitArea: { x: number; y: number; w: number; h: number } | null = null
  private _shareCallback: (() => void) | null = null

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

      // Share button
      const shareBg = new PIXI.Graphics()
      shareBg.beginFill(0x7F8C8D, 0.7)
      shareBg.drawRoundedRect(w - 72, pondCardY + 10, 44, 22, 6)
      shareBg.endFill()
      this.container.addChild(shareBg)
      const shareTxt = new PIXI.Text('📤', {
        fontFamily: 'sans-serif', fontSize: 14,
      } as any)
      shareTxt.anchor.set(0.5); shareTxt.x = w - 50; shareTxt.y = pondCardY + 21
      this.container.addChild(shareTxt)
      this._shareHitArea = { x: w - 72, y: pondCardY + 10, w: 44, h: 22 }
      this._shareCallback = () => generatePoster()
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

    // ── Tabbed Ranking (replaces old ranking bar) ──
    const rankingY = pondCardY + pondCardH + 12
    this._renderRankingTabs(w, rankingY)

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

  private _renderRankingTabs(w: number, y: number): void {
    const tabs = [
      { key: 'fat', label: '🏆 今日最肥' },
      { key: 'perCapita', label: '👑 人均摸鱼王' },
      { key: 'streak', label: '🔥 连续霸榜' }
    ]
    const tabW = (w - 32) / 3; const tabH = 32
    const tabY = y

    const tabContainer = new PIXI.Container()
    this.container.addChild(tabContainer)

    for (let i = 0; i < tabs.length; i++) {
      const t = tabs[i]
      const tx = 16 + i * tabW
      const isActive = this._rankingTab === t.key

      const bg = new PIXI.Graphics()
      bg.beginFill(isActive ? 0x5C4033 : 0x3A2A20, 0.9)
      bg.drawRoundedRect(tx, tabY, tabW - 4, tabH, 6)
      bg.endFill()
      if (isActive) bg.lineStyle(1, 0xF39C12, 0.6)
      bg.drawRoundedRect(tx, tabY, tabW - 4, tabH, 6)
      tabContainer.addChild(bg)

      const txt = new PIXI.Text(t.label, {
        fontFamily: 'sans-serif', fontSize: 10, fill: isActive ? '#F39C12' : '#8B7355',
      } as any)
      txt.anchor.set(0.5); txt.x = tx + (tabW - 4) / 2; txt.y = tabY + tabH / 2
      tabContainer.addChild(txt)

      // Register hit area (re-registered in onUpdate)
      this._tabHitAreas = this._tabHitAreas || []
      this._tabHitAreas.push({
        rect: { x: tx, y: tabY, w: tabW - 4, h: tabH },
        cb: () => { this._rankingTab = t.key; this._loadRankings(w, tabY + tabH + 8) }
      })
    }

    this._loadRankings(w, tabY + tabH + 8)
  }

  private async _loadRankings(w: number, y: number): Promise<void> {
    try {
      const res = await wx.cloud.callFunction({ name: 'getPondRanking', data: {} })
      this._rankingData = (res as any).result
    } catch { return }

    if (!this._rankingData?.ok) return
    const data = this._rankingData
    let list: any[]

    if (this._rankingTab === 'fat') list = data.fatPondRank
    else if (this._rankingTab === 'perCapita') list = data.perCapitaRank
    else list = data.streakRank

    if (!list || list.length === 0) return

    // Clear old ranking display
    if (this._rankingContainer) { this.container.removeChild(this._rankingContainer); this._rankingContainer.destroy({ children: true }) }
    const ctn = new PIXI.Container()
    this._rankingContainer = ctn
    this.container.addChild(ctn)

    const medals = ['🥇', '🥈', '🥉']
    for (let i = 0; i < Math.min(list.length, 12); i++) {
      const item = list[i]
      const pond = getPondById(item.pondId)
      const ry = y + i * 22
      const rank = item.rank || (i + 1)

      const line = new PIXI.Text(
        `${rank <= 3 ? medals[rank - 1] : rank + ' '} ${pond?.emoji || '🐟'} ${pond?.name || item.pondId}  ` +
        (this._rankingTab === 'fat' ? `${item.dailyClears}条` :
         this._rankingTab === 'perCapita' ? `${item.perCapita}人均` :
         `${item.streakDays}天`),
        { fontFamily: 'sans-serif', fontSize: 11, fill: rank <= 3 ? '#F1C40F' : '#A09080' }
      ) as any
      line.x = 20; line.y = ry
      ctn.addChild(line)
    }
  }

  onUpdate(_dt: number): void {
    if (this._startHitArea && this._startCallback) {
      this.registerHitArea(this._startHitArea, this._startCallback, 10)
    }
    if (this._tabHitAreas) {
      for (const item of this._tabHitAreas) this.registerHitArea(item.rect, item.cb, 12)
    }
    if (this._shareHitArea && this._shareCallback) {
      this.registerHitArea(this._shareHitArea, this._shareCallback, 12)
    }
  }
}
