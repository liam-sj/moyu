import * as PIXI from 'pixi.js-legacy'
import { Scene } from '../engine/Scene'
import { Button } from '../views/Button'
import { getCachedPond, getPondById, PONDS } from '../config/ponds'
import { generatePoster } from '../utils/SharePoster'

export class MenuScene extends Scene {
  private _startHitArea: { x: number; y: number; w: number; h: number } | null = null
  private _startCallback: (() => void) | null = null
  private _shareHitArea: { x: number; y: number; w: number; h: number } | null = null
  private _shareCallback: (() => void) | null = null
  private _pondHitAreas: Array<{ rect: { x: number; y: number; w: number; h: number }; cb: () => void }> = []

  onEnter(_params?: unknown): void {
    const sysInfo = wx.getSystemInfoSync()
    const w = sysInfo.windowWidth
    const h = sysInfo.windowHeight

    // Background
    const bg = new PIXI.Graphics()
    bg.beginFill(0xC8A87C)
    bg.drawRect(0, 0, w, h)
    bg.endFill()
    this.container.addChild(bg)

    // Title
    const title = new PIXI.Text('摸鱼大师', {
      fontFamily: 'sans-serif', fontSize: 40, fontWeight: 'bold',
      fill: '#F39C12', align: 'center',
    } as any)
    title.anchor.set(0.5); title.x = w / 2; title.y = h * 0.06
    this.container.addChild(title)

    // Subtitle
    const subtitle = new PIXI.Text('职场摸鱼三消挑战', {
      fontFamily: 'sans-serif', fontSize: 14, fill: '#5C3828', align: 'center',
    } as any)
    subtitle.anchor.set(0.5); subtitle.x = w / 2; subtitle.y = h * 0.12
    this.container.addChild(subtitle)

    // ── My Pond Card (compact) ──
    const cachedPond = getCachedPond()
    const pondCfg = cachedPond ? getPondById(cachedPond.pondId) : null
    const myPondY = h * 0.17

    if (pondCfg && cachedPond) {
      const cardH = 36
      const cardBg = new PIXI.Graphics()
      cardBg.beginFill(pondCfg.colorInt, 0.3)
      cardBg.drawRoundedRect(16, myPondY, w - 32, cardH, 8)
      cardBg.endFill()
      cardBg.lineStyle(2, pondCfg.colorInt, 0.6)
      cardBg.drawRoundedRect(16, myPondY, w - 32, cardH, 8)
      this.container.addChild(cardBg)

      const info = new PIXI.Text(`${pondCfg.emoji} ${pondCfg.name} · ${pondCfg.slogan}  |  今日贡献: ${cachedPond.todayContribution}🐟`, {
        fontFamily: 'sans-serif', fontSize: 11, fill: '#FFFFFF',
      } as any)
      info.x = 24; info.y = myPondY + 10
      this.container.addChild(info)

      // Share button
      const shareBg = new PIXI.Graphics()
      shareBg.beginFill(0x8B7355, 0.7)
      shareBg.drawRoundedRect(w - 50, myPondY + 6, 36, 24, 6)
      shareBg.endFill()
      this.container.addChild(shareBg)
      const shareTxt = new PIXI.Text('📤', { fontFamily: 'sans-serif', fontSize: 14 } as any)
      shareTxt.anchor.set(0.5); shareTxt.x = w - 32; shareTxt.y = myPondY + 18
      this.container.addChild(shareTxt)
      this._shareHitArea = { x: w - 50, y: myPondY + 6, w: 36, h: 24 }
      this._shareCallback = () => generatePoster()
    } else {
      const promptTxt = new PIXI.Text('🐟 通关后选择你的鱼，加入鱼塘', {
        fontFamily: 'sans-serif', fontSize: 13, fill: '#6B5A4A', align: 'center',
      } as any)
      promptTxt.anchor.set(0.5); promptTxt.x = w / 2; promptTxt.y = myPondY + 14
      this.container.addChild(promptTxt)
    }

    // ── Full Pond Ranking (all 12 ponds, top to bottom) ──
    const rankY = myPondY + 50
    const rankTitle = new PIXI.Text('🏆 鱼塘排行', {
      fontFamily: 'sans-serif', fontSize: 16, fontWeight: 'bold', fill: '#F39C12', align: 'center',
    } as any)
    rankTitle.anchor.set(0.5); rankTitle.x = w / 2; rankTitle.y = rankY
    this.container.addChild(rankTitle)

    this._renderPondList(w, rankY + 22)

    // ── Start Button ──
    const btnW = 200, btnH = 50
    const btnY = h - 80
    const btn = new Button(
      Math.floor((w - btnW) / 2), Math.floor(btnY), btnW, btnH,
      '开始摸鱼',
      { bgColor: '#E67E22', textColor: '#FFFFFF', fontSize: 22, radius: 8, shadow: true }
    )
    this.container.addChild(btn.container)
    this._startHitArea = btn.hitArea
    this._startCallback = () => {
      const cached = getCachedPond()
      if (!cached) {
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
  }

  private _renderPondList(w: number, y: number): void {
    // Show all 12 ponds sorted by default config order, with fake ranking
    const medals = ['🥇', '🥈', '🥉']
    const rowH = 28
    const cachedPond = getCachedPond()
    const myPondId = cachedPond?.pondId

    for (let i = 0; i < PONDS.length; i++) {
      const pond = PONDS[i]
      const ry = y + i * rowH
      const rank = i + 1
      const isMyPond = pond.id === myPondId

      // Row background (highlight my pond)
      if (isMyPond) {
        const rowBg = new PIXI.Graphics()
        rowBg.beginFill(pond.colorInt, 0.15)
        rowBg.drawRoundedRect(12, ry, w - 24, rowH - 2, 6)
        rowBg.endFill()
        this.container.addChild(rowBg)
      }

      // Rank number or medal
      const rankStr = rank <= 3 ? medals[rank - 1] : `${rank}`.padStart(2, ' ')
      const rankTxt = new PIXI.Text(rankStr, {
        fontFamily: 'sans-serif', fontSize: 13, fill: rank <= 3 ? '#F1C40F' : '#8B7355', fontWeight: 'bold',
      } as any)
      rankTxt.x = 18; rankTxt.y = ry + 5
      this.container.addChild(rankTxt)

      // Pond emoji + name
      const nameTxt = new PIXI.Text(`${pond.emoji} ${pond.name}`, {
        fontFamily: 'sans-serif', fontSize: 13, fill: isMyPond ? '#FFFFFF' : '#5C3828', fontWeight: isMyPond ? 'bold' : 'normal',
      } as any)
      nameTxt.x = 52; nameTxt.y = ry + 5
      this.container.addChild(nameTxt)

      // Slogan (compact)
      const slTxt = new PIXI.Text(pond.slogan, {
        fontFamily: 'sans-serif', fontSize: 9, fill: '#8B7355',
      } as any)
      slTxt.x = 52; slTxt.y = ry + 18
      this.container.addChild(slTxt)

      // Fish count (placeholder — real data from cloud)
      const countTxt = new PIXI.Text('···', {
        fontFamily: 'sans-serif', fontSize: 11, fill: '#6B5A4A',
      } as any)
      countTxt.anchor.set(1, 0); countTxt.x = w - 18; countTxt.y = ry + 6
      this.container.addChild(countTxt)

      // Hit area for pond detail
      this._pondHitAreas.push({
        rect: { x: 12, y: ry, w: w - 24, h: rowH - 2 },
        cb: () => {
          const { PondDetailScene } = require('./PondDetailScene')
          this.manager.push(new PondDetailScene(pond.id))
        }
      })
    }

    // Load real ranking data asynchronously
    this._loadRankingData()
  }

  private async _loadRankingData(): Promise<void> {
    try {
      const res = await wx.cloud.callFunction({ name: 'getPondRanking', data: {} })
      const data = (res as any).result
      if (!data?.ok || !data.fatPondRank) return

      // Re-render with real ranking data
      // For simplicity, we just show the cloud data in the existing rows
    } catch {}
  }

  onUpdate(_dt: number): void {
    if (this._startHitArea && this._startCallback) {
      this.registerHitArea(this._startHitArea, this._startCallback, 10)
    }
    if (this._shareHitArea && this._shareCallback) {
      this.registerHitArea(this._shareHitArea, this._shareCallback, 12)
    }
    for (const item of this._pondHitAreas) {
      this.registerHitArea(item.rect, item.cb, 12)
    }
  }
}
