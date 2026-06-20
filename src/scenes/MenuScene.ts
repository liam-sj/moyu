import * as PIXI from 'pixi.js-legacy'
import { Scene } from '../engine/Scene'
import { Button } from '../views/Button'
import { getCachedPond, getPondById, PONDS } from '../config/ponds'
import { PondView } from '../views/PondView'
import { generatePoster } from '../utils/SharePoster'

export class MenuScene extends Scene {
  private _startHitArea: { x: number; y: number; w: number; h: number } | null = null
  private _startCallback: (() => void) | null = null
  private _shareHitArea: { x: number; y: number; w: number; h: number } | null = null
  private _shareCallback: (() => void) | null = null
  private _pondHitAreas: Array<{ rect: { x: number; y: number; w: number; h: number }; cb: () => void }> = []
  private _pondViews: PondView[] = []
  private _scrollCtn: PIXI.Container | null = null
  private _scrollY = 0
  private _scrollMax = 0
  private _lastTouchX = 0
  private _lastTouchY = 0

  onEnter(_params?: unknown): void {
    const sysInfo = wx.getSystemInfoSync()
    const w = sysInfo.windowWidth
    const h = sysInfo.windowHeight

    // Water background
    const bg = new PIXI.Graphics()
    bg.beginFill(0x1A3A5C)
    bg.drawRect(0, 0, w, h)
    bg.endFill()
    this.container.addChild(bg)

    // Title + subtitle
    const title = new PIXI.Text('摸鱼大师', {
      fontFamily: 'sans-serif', fontSize: 36, fontWeight: 'bold', fill: '#F39C12', align: 'center',
    } as any)
    title.anchor.set(0.5); title.x = w / 2; title.y = 18
    this.container.addChild(title)

    const sub = new PIXI.Text('职场摸鱼三消挑战', {
      fontFamily: 'sans-serif', fontSize: 11, fill: '#7FB3D8', align: 'center',
    } as any)
    sub.anchor.set(0.5); sub.x = w / 2; sub.y = 44
    this.container.addChild(sub)

    // My Pond bar
    const cachedPond = getCachedPond()
    const pondCfg = cachedPond ? getPondById(cachedPond.pondId) : null
    const barY = 60

    if (pondCfg && cachedPond) {
      const bar = new PIXI.Graphics()
      bar.beginFill(pondCfg.colorInt, 0.3)
      bar.drawRoundedRect(12, barY, w - 24, 30, 8)
      bar.endFill()
      this.container.addChild(bar)
      const info = new PIXI.Text(`${pondCfg.emoji} ${pondCfg.name} · ${pondCfg.slogan}  |  贡献: ${cachedPond.todayContribution}🐟`, {
        fontFamily: 'sans-serif', fontSize: 10, fill: '#FFFFFF',
      } as any)
      info.x = 20; info.y = barY + 8
      this.container.addChild(info)
      this._shareHitArea = { x: w - 50, y: barY + 3, w: 36, h: 24 }
      this._shareCallback = () => generatePoster()
    } else {
      const prompt = new PIXI.Text('🐟 通关后选鱼，加入鱼塘', {
        fontFamily: 'sans-serif', fontSize: 12, fill: '#5A8AB5', align: 'center',
      } as any)
      prompt.anchor.set(0.5); prompt.x = w / 2; prompt.y = barY + 15
      this.container.addChild(prompt)
    }

    // Scrollable pond list
    const pondW = w - 60; const pondH = 420; const gap = 24
    const gridY = barY + 36
    const listTotal = PONDS.length * (pondH + gap)
    this._scrollMax = Math.max(0, gridY + listTotal + 80 - h)

    this._scrollCtn = new PIXI.Container()
    this.container.addChild(this._scrollCtn)

    for (let i = 0; i < PONDS.length; i++) {
      const px = (w - pondW) / 2
      const py = gridY + i * (pondH + gap)
      const pv = new PondView(PONDS[i], i, px, py, pondW, pondH)
      pv.spawnFish(5)
      this._scrollCtn.addChild(pv.container)
      this._pondViews.push(pv)

      // Title area → opens pond detail
      this._pondHitAreas.push({
        rect: { x: px, y: py, w: pondW, h: 22 },
        cb: () => { const { PondDetailScene } = require('./PondDetailScene'); this.manager.push(new PondDetailScene(PONDS[i].id)) }
      })
    }

    // Load real counts
    this._loadRealCounts()

    // Load user avatar for contributor display
    if (typeof wx !== 'undefined') {
      try {
        wx.getSetting({
          success: (res: any) => {
            if (res.authSetting['scope.userInfo']) {
              wx.getUserInfo({
                success: (info: any) => {
                  const url = info.userInfo.avatarUrl
                  for (const pv of this._pondViews) pv.showContributors([{ url, count: 1 }])
                }
              })
            }
          }
        })
      } catch {}
    }

    // Button
    const btnW = 200; const btnH = 44
    const btn = new Button(Math.floor((w - btnW) / 2), Math.floor(h - 60), btnW, btnH, '开始摸鱼', {
      bgColor: '#E67E22', textColor: '#FFFFFF', fontSize: 20, radius: 8, shadow: true,
    })
    this.container.addChild(btn.container)
    this._startHitArea = btn.hitArea
    this._startCallback = () => {
      const c = getCachedPond()
      if (!c) {
        const hl2 = wx.getStorageSync('cleared_level2')
        if (hl2 && !wx.getStorageSync('fish_selection_shown')) {
          const { SelectFishScene } = require('./SelectFishScene')
          this.manager.replace(new SelectFishScene())
          return
        }
      }
      const { GameScene } = require('./GameScene')
      this.manager.replace(new GameScene(), { levelId: 'level1' })
    }

    // Touch scroll + track position for fish splash
    if (typeof wx !== 'undefined') {
      wx.onTouchStart((e: any) => {
        if (e.touches?.length) {
          this._lastTouchX = e.touches[0].clientX
          this._lastTouchY = e.touches[0].clientY
        }
      })
      if (this._scrollMax > 0) {
        let startY = 0; let startScroll = 0
        wx.onTouchStart((e: any) => { if (e.touches?.length) { startY = e.touches[0].clientY; startScroll = this._scrollY } })
        wx.onTouchMove((e: any) => {
          if (e.touches?.length && this._scrollCtn) {
            this._scrollY = Math.max(-this._scrollMax, Math.min(0, startScroll + e.touches[0].clientY - startY))
            this._scrollCtn.y = this._scrollY
          }
        })
      }
    }
  }

  private async _loadRealCounts(): Promise<void> {
    try {
      const res = await wx.cloud.callFunction({ name: 'getPondRanking', data: {} })
      const data = (res as any).result
      if (!data?.ok || !data.fatPondRank) return
      for (let i = 0; i < this._pondViews.length; i++) {
        const info = data.fatPondRank.find((d: any) => d.pondId === PONDS[i].id)
        const count = info ? Math.max(3, Math.round(info.dailyClears / 3)) : 5
        this._pondViews[i].spawnFish(count)
        this._pondViews[i].setBadge(info ? `${info.dailyClears}条` : '···')
      }
    } catch {}
  }

  onUpdate(dt: number): void {
    if (this._startHitArea && this._startCallback) this.registerHitArea(this._startHitArea, this._startCallback, 10)
    if (this._shareHitArea && this._shareCallback) this.registerHitArea(this._shareHitArea, this._shareCallback, 12)
    for (const item of this._pondHitAreas) this.registerHitArea(item.rect, item.cb, 10)
    for (const pv of this._pondViews) {
      pv.updateFish(dt)
      const gp = (pv.container as any).getGlobalPosition()
      for (const item of pv.getFishHitAreas(gp.x, gp.y)) this.registerHitArea(item.rect, item.cb, 15)
    }
  }
}
