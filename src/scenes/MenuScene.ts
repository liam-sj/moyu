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
  private _pondFish: Array<{ sprite: PIXI.Text; vx: number; vy: number; pondX: number; pondY: number; pondW: number; pondH: number }> = []
  private _pondData: Array<{ pondId: string; dailyClears: number; rank: number }> = []
  private _pondAreas: Array<{ px: number; py: number; pondW: number; pondH: number; pondId: string; ctn: PIXI.Container }> = []

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

    // Title
    const title = new PIXI.Text('摸鱼大师', {
      fontFamily: 'sans-serif', fontSize: 36, fontWeight: 'bold',
      fill: '#F39C12', align: 'center',
    } as any)
    title.anchor.set(0.5); title.x = w / 2; title.y = h * 0.04
    this.container.addChild(title)

    const sub = new PIXI.Text('职场摸鱼三消挑战', {
      fontFamily: 'sans-serif', fontSize: 12, fill: '#7FB3D8', align: 'center',
    } as any)
    sub.anchor.set(0.5); sub.x = w / 2; sub.y = h * 0.09
    this.container.addChild(sub)

    // ── My Pond bar ──
    const cachedPond = getCachedPond()
    const pondCfg = cachedPond ? getPondById(cachedPond.pondId) : null
    const barY = h * 0.13

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

    // ── 12 Circular Fish Ponds (top-down view, 3 columns × 4 rows) ──
    const cols = 3; const diameter = Math.floor((w - 40) / cols); const radius = diameter / 2
    const gridY = barY + 36; const gap = 6

    for (let i = 0; i < PONDS.length; i++) {
      const pond = PONDS[i]
      const col = i % cols; const row = Math.floor(i / cols)
      const cx = 12 + col * (diameter + gap) + radius
      const cy = gridY + row * (diameter + gap) + radius

      // Circular pond container (top-down, no perspective tilt)
      const pondCtn = new PIXI.Container()

      // Pond circle — water
      const pondBg = new PIXI.Graphics()
      pondBg.beginFill(0x0A3050, 0.75)
      pondBg.drawCircle(0, 0, radius)
      pondBg.endFill()
      // Water highlight
      pondBg.beginFill(0x1A6090, 0.25)
      pondBg.drawCircle(-radius * 0.2, -radius * 0.3, radius * 0.55)
      pondBg.endFill()
      // Border ring
      pondBg.lineStyle(2, pond.colorInt, 0.6)
      pondBg.drawCircle(0, 0, radius - 1)
      // Inner ripple
      pondBg.lineStyle(1, 0x3A8AC0, 0.2)
      pondBg.drawCircle(0, 0, radius * 0.6)
      pondCtn.addChild(pondBg)

      // Rank badge (top-left of circle)
      const rankStr = i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}`
      const rankTxt = new PIXI.Text(rankStr, {
        fontFamily: 'sans-serif', fontSize: 12, fontWeight: 'bold',
        fill: i < 3 ? '#F1C40F' : '#FFFFFF',
      } as any)
      rankTxt.anchor.set(0.5); rankTxt.x = -radius * 0.5; rankTxt.y = -radius + 8
      pondCtn.addChild(rankTxt)

      // Pond name (below circle)
      const nameTxt = new PIXI.Text(`${pond.emoji} ${pond.name}`, {
        fontFamily: 'sans-serif', fontSize: 10, fontWeight: 'bold', fill: '#FFFFFF', align: 'center',
      } as any)
      nameTxt.anchor.set(0.5, 0); nameTxt.x = 0; nameTxt.y = radius + 2
      pondCtn.addChild(nameTxt)

      pondCtn.x = cx; pondCtn.y = cy
      this.container.addChild(pondCtn)

      // Store pond area
      const areaW = diameter - 4; const areaH = diameter - 4
      this._pondAreas.push({ px: -radius + 2, py: -radius + 2, pondW: areaW, pondH: areaH, pondId: pond.id, ctn: pondCtn })

      // Fish inside circular pond (constrained to circle)
      this._spawnPondFish(pond.id, -radius + 8, -radius + 16, diameter - 20, diameter - 36, 2, pondCtn)

      // Hit area
      this._pondHitAreas.push({
        rect: { x: cx - radius, y: cy - radius, w: diameter, h: diameter },
        cb: () => { const { PondDetailScene } = require('./PondDetailScene'); this.manager.push(new PondDetailScene(pond.id)) }
      })
    }

    // Start button
    const btnW = 200, btnH = 44
    const btnY = gridY + 4 * (diameter + gap) + 10
    const btn = new Button(
      Math.floor((w - btnW) / 2), Math.floor(btnY), btnW, btnH,
      '开始摸鱼',
      { bgColor: '#E67E22', textColor: '#FFFFFF', fontSize: 20, radius: 8, shadow: true }
    )
    this.container.addChild(btn.container)
    this._startHitArea = btn.hitArea
    // Load real fish counts from cloud
    this._loadRealCounts()

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
  }

  private _spawnPondFish(pondId: string, px: number, py: number, pw: number, ph: number, count: number, ctn: PIXI.Container): void {
    const fishEmojis = ['🐟', '🐠', '🐡', '🦐']
    const actualCount = Math.min(count, 10) // cap at 10 fish per pond
    for (let f = 0; f < actualCount; f++) {
      const sprite = new PIXI.Text(fishEmojis[f % fishEmojis.length], {
        fontFamily: 'sans-serif', fontSize: 24 + Math.random() * 16, align: 'center',
      } as any)
      sprite.anchor.set(0.5)
      sprite.x = px + 12 + Math.random() * (pw - 30)
      sprite.y = py + 10 + Math.random() * (ph - 22)
      sprite.alpha = 0.7 + Math.random() * 0.3
      ctn.addChild(sprite)
      this._pondFish.push({
        sprite,
        vx: (0.1 + Math.random() * 0.2) * (Math.random() > 0.5 ? 1 : -1),
        vy: (0.04 + Math.random() * 0.08) * (Math.random() > 0.5 ? 1 : -1),
        pondX: px, pondY: py, pondW: pw, pondH: ph,
      })
    }
  }

  private async _loadRealCounts(): Promise<void> {
    try {
      const res = await wx.cloud.callFunction({ name: 'getPondRanking', data: {} })
      const data = (res as any).result
      if (!data?.ok || !data.fatPondRank) return
      this._pondData = data.fatPondRank

      // Clear placeholder fish
      for (const f of this._pondFish) { f.sprite.parent?.removeChild(f.sprite); f.sprite.destroy() }
      this._pondFish = []

      // Re-spawn fish with real counts
      for (const area of this._pondAreas) {
        const info = this._pondData.find(d => d.pondId === area.pondId)
        const count = info ? Math.max(0, Math.round(info.dailyClears / 5)) : 2
        this._spawnPondFish(area.pondId, area.px + 8, area.py + 16, area.pondW - 20, area.pondH - 36, count || 2, area.ctn)
      }
    } catch {}
  }

  onUpdate(dt: number): void {
    if (this._startHitArea && this._startCallback) {
      this.registerHitArea(this._startHitArea, this._startCallback, 10)
    }
    if (this._shareHitArea && this._shareCallback) {
      this.registerHitArea(this._shareHitArea, this._shareCallback, 12)
    }
    for (const item of this._pondHitAreas) {
      this.registerHitArea(item.rect, item.cb, 10)
    }

    // Animate fish inside each circular pond
    for (const fish of this._pondFish) {
      fish.sprite.x += fish.vx * dt
      fish.sprite.y += fish.vy * dt
      // Constrain to circle: if outside radius, bounce back
      const dx = fish.sprite.x - (fish.pondX + fish.pondW / 2)
      const dy = fish.sprite.y - (fish.pondY + fish.pondH / 2)
      const dist = Math.sqrt(dx * dx + dy * dy)
      const maxDist = fish.pondW / 2 - 8
      if (dist > maxDist) {
        // Bounce: reflect velocity and push back inside
        const nx = dx / dist; const ny = dy / dist
        fish.sprite.x = fish.pondX + fish.pondW / 2 + nx * maxDist
        fish.sprite.y = fish.pondY + fish.pondH / 2 + ny * maxDist
        // Reflect velocity
        const dot = fish.vx * nx + fish.vy * ny
        fish.vx -= 2 * dot * nx
        fish.vy -= 2 * dot * ny
      }
      fish.sprite.scale.x = fish.vx > 0 ? 1 : -1
    }
  }

  // Override onResume to re-render fish sprites (since PIXI can't be easily updated in onUpdate)
  onResume(): void {
    // Re-render animated fish (called when returning from game)
  }
}
