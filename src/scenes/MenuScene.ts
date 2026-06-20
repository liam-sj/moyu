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

    // ── 12 Fish Ponds (3 columns × 4 rows grid) ──
    const cols = 3; const pondW = Math.floor((w - 32) / cols); const pondH = 95
    const gridY = barY + 40; const gap = 6

    for (let i = 0; i < PONDS.length; i++) {
      const pond = PONDS[i]
      const col = i % cols; const row = Math.floor(i / cols)
      const px = 8 + col * pondW + (col > 0 ? gap : 0)
      const py = gridY + row * (pondH + gap)

      // Pond background (water color)
      const pondBg = new PIXI.Graphics()
      pondBg.beginFill(pond.colorInt, 0.20)
      pondBg.drawRoundedRect(px, py, pondW - 4, pondH, 10)
      pondBg.endFill()
      pondBg.lineStyle(1.5, pond.colorInt, 0.4)
      pondBg.drawRoundedRect(px, py, pondW - 4, pondH, 10)
      this.container.addChild(pondBg)

      // Pond name
      const nameTxt = new PIXI.Text(`${pond.emoji} ${pond.name}`, {
        fontFamily: 'sans-serif', fontSize: 10, fontWeight: 'bold', fill: '#FFFFFF',
      } as any)
      nameTxt.x = px + 4; nameTxt.y = py + 3
      this.container.addChild(nameTxt)

      // Fish count badge
      const badgeTxt = new PIXI.Text('···', {
        fontFamily: 'sans-serif', fontSize: 9, fill: '#7FB3D8',
      } as any)
      badgeTxt.anchor.set(1, 0); badgeTxt.x = px + pondW - 8; badgeTxt.y = py + 4
      this.container.addChild(badgeTxt)

      // Create swimming fish inside pond
      const fishCount = 2 + (i % 4) // 2-5 fish per pond
      const fishEmojis = ['🐟', '🐠', '🐡', '🦐']
      for (let f = 0; f < fishCount; f++) {
        const sprite = new PIXI.Text(fishEmojis[f % fishEmojis.length], {
          fontFamily: 'sans-serif', fontSize: 12 + Math.random() * 8, align: 'center',
        } as any)
        sprite.anchor.set(0.5)
        sprite.x = px + 10 + Math.random() * (pondW - 30)
        sprite.y = py + 18 + Math.random() * (pondH - 28)
        sprite.alpha = 0.7 + Math.random() * 0.3
        this.container.addChild(sprite)
        this._pondFish.push({
          sprite,
          vx: (0.1 + Math.random() * 0.2) * (Math.random() > 0.5 ? 1 : -1),
          vy: (0.04 + Math.random() * 0.08) * (Math.random() > 0.5 ? 1 : -1),
          pondX: px, pondY: py + 16, pondW: pondW - 4, pondH: pondH - 18,
        })
      }

      // Hit area
      this._pondHitAreas.push({
        rect: { x: px, y: py, w: pondW - 4, h: pondH },
        cb: () => { const { PondDetailScene } = require('./PondDetailScene'); this.manager.push(new PondDetailScene(pond.id)) }
      })
    }

    // Start button
    const btnW = 200, btnH = 44
    const btnY = gridY + 4 * (pondH + gap) + 12
    const btn = new Button(
      Math.floor((w - btnW) / 2), Math.floor(btnY), btnW, btnH,
      '开始摸鱼',
      { bgColor: '#E67E22', textColor: '#FFFFFF', fontSize: 20, radius: 8, shadow: true }
    )
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

    // Animate fish inside each pond
    for (const fish of this._pondFish) {
      fish.sprite.x += fish.vx * dt
      fish.sprite.y += fish.vy * dt
      // Bounce off pond edges
      if (fish.sprite.x < fish.pondX + 6 || fish.sprite.x > fish.pondX + fish.pondW - 10) fish.vx *= -1
      if (fish.sprite.y < fish.pondY + 4 || fish.sprite.y > fish.pondY + fish.pondH - 6) fish.vy *= -1
      // Flip sprite based on direction
      fish.sprite.scale.x = fish.vx > 0 ? 1 : -1
    }
  }

  // Override onResume to re-render fish sprites (since PIXI can't be easily updated in onUpdate)
  onResume(): void {
    // Re-render animated fish (called when returning from game)
  }
}
