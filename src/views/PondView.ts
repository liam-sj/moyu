import * as PIXI from 'pixi.js-legacy'
import { FishView } from './FishView'
import type { PondConfig } from '../config/ponds'

export class PondView {
  readonly container = new PIXI.Container()
  private _fish: FishView[] = []
  private _bounds: { x: number; y: number; w: number; h: number }
  private _pondConfig: PondConfig
  /** Register per-fish hit areas for tap-to-dash */
  fishHitAreas: Array<{ rect: { x: number; y: number; w: number; h: number }; cb: () => void }> = []
  private _avatarSprites: PIXI.Container[] = []
  private _announceFish: FishView | null = null
  private _announceBubble: PIXI.Text | null = null
  private _announceTexts = [
    '🐟 通关第二关加入鱼塘！',
    '🏆 为你的鱼塘争光！',
    '🐠 点击小鱼会冲刺哦',
    '🔥 连续通关霸榜吧！',
  ]
  private _announceIdx = 0
  private _announceTimer = 0

  constructor(pond: PondConfig, rank: number, x: number, y: number, w: number, h: number) {
    this._pondConfig = pond
    this._bounds = { x: 8, y: Math.floor(h * 0.67), w: w - 20, h: Math.floor(h * 0.33) - 8 }
    this.container.x = x
    this.container.y = y

    // Pond background (transparent — home page bg handles the visuals)
    const pondBg = new PIXI.Graphics()
    pondBg.beginFill(0x000000, 0.10)
    pondBg.drawRoundedRect(0, 0, w, h, 10)
    pondBg.endFill()
    this.container.addChildAt(pondBg, 0)

    // Clip mask so fish stay within water area
    const mask = new PIXI.Graphics()
    mask.beginFill(0xFFFFFF)
    mask.drawRect(0, 0, w, h)
    mask.endFill()
    this.container.addChild(mask)
    this.container.mask = mask

    // Rank badge
    const medals = ['🥇', '🥈', '🥉']
    const rankStr = rank < 3 ? medals[rank] : `${rank + 1}`
    const rankTxt = new PIXI.Text(rankStr, {
      fontFamily: 'sans-serif', fontSize: 12, fontWeight: 'bold',
      fill: rank < 3 ? '#F1C40F' : '#FFFFFF',
    } as any)
    rankTxt.x = 4; rankTxt.y = 3
    this.container.addChild(rankTxt)
    ;(this as any)._rankTxt = rankTxt

    // Pond name
    const nameTxt = new PIXI.Text(`${pond.emoji} ${pond.name}`, {
      fontFamily: 'sans-serif', fontSize: 10, fontWeight: 'bold', fill: '#FFFFFF',
    } as any)
    nameTxt.x = 28; nameTxt.y = 4
    this.container.addChild(nameTxt)

    // Fish count badge
    const badgeTxt = new PIXI.Text('···', {
      fontFamily: 'sans-serif', fontSize: 9, fill: '#7FB3D8',
    } as any)
    badgeTxt.anchor.set(1, 0); badgeTxt.x = w - 6; badgeTxt.y = 5
    this.container.addChild(badgeTxt)
    ;(this as any)._badgeTxt = badgeTxt
  }

  /** Create the announcement fish with speech bubble */
  private _spawnAnnouncer(): void {
    if (this._announceFish) return
    // Special fish emoji (gold)
    const f = new FishView('jianyu', 0,  // 剑鱼=鲨鱼造型
      this._bounds.x + this._bounds.w / 2,
      this._bounds.y + this._bounds.h / 2,
      24
    )
    this._announceFish = f
    this.container.addChild(f.container)

    // Speech bubble text
    const bubbleTxt = new PIXI.Text(this._announceTexts[0], {
      fontFamily: 'sans-serif', fontSize: 10, fill: '#FFFFFF',
      backgroundColor: '#333333', backgroundAlpha: 0.75,
    } as any)
    bubbleTxt.anchor.set(0.5)
    bubbleTxt.x = 0; bubbleTxt.y = -28
    f.container.addChild(bubbleTxt)
    this._announceBubble = bubbleTxt
  }

  /** Spawn fish with given count */
  spawnFish(count: number, contributors?: Array<{ url: string; count: number }>): void {
    this._spawnAnnouncer()
    this.clearFish()
    this.fishHitAreas = []
    const max = Math.min(count, 30)
    const avatarList: string[] = []
    if (contributors) {
      for (const c of contributors) for (let j = 0; j < Math.min(c.count, max); j++) avatarList.push(c.url)
    }
    for (let i = 0; i < max; i++) {
      const f = new FishView(this._pondConfig.fishId, i,
        this._bounds.x + 10 + ((i * 47 + 13) % Math.max(1, this._bounds.w - 24)),
        this._bounds.y + 14 + ((i * 31 + 7) % Math.max(1, this._bounds.h - 28)),
        28 + ((i * 19 + 5) % 10)
      )
      if (i < avatarList.length) f.setAvatar(avatarList[i])
      this._fish.push(f)
      this.container.addChild(f.container)
      // Per-fish tap: dash away (coordinates relative to pond container)
      this.fishHitAreas.push({
        rect: { x: f.container.x, y: f.container.y, w: 1, h: 1 },
        cb: () => { f.state = 'dash'; f.stateTimer = 30 + Math.random() * 40 }
      })
    }
  }

  /** Update per-fish hit area positions (called each frame, returns screen-space rects) */
  getFishHitAreas(ox: number, oy: number): Array<{ rect: { x: number; y: number; w: number; h: number }; cb: () => void }> {
    const result: Array<{ rect: { x: number; y: number; w: number; h: number }; cb: () => void }> = []
    for (let i = 0; i < this._fish.length; i++) {
      const f = this._fish[i]
      const cb = this.fishHitAreas[i]?.cb
      if (cb) {
        result.push({
          rect: { x: ox + f.container.x - 18, y: oy + f.container.y - 18, w: 36, h: 36 },
          cb
        })
      }
    }
    return result
  }

  /** Dash fish near a point (local coordinates, radius in px) */
  dashNear(lx: number, ly: number, radius: number): void {
    for (const f of this._fish) {
      const dx = f.container.x - lx
      const dy = f.container.y - ly
      if (Math.sqrt(dx * dx + dy * dy) < radius) {
        f.state = 'dash'
        f.stateTimer = 30 + Math.random() * 40
        const angle = Math.random() * Math.PI * 2
        const spd = 0.4 + Math.random() * 0.5
        f.vx = Math.cos(angle) * spd
        f.vy = Math.sin(angle) * spd
      }
    }
  }

  /** Make every fish in this pond dash */
  dashAll(): void {
    for (const f of this._fish) {
      f.state = 'dash'
      f.stateTimer = 25 + Math.random() * 35
    }
  }

  clearFish(): void {
    for (const f of this._fish) f.destroy()
    this._fish = []
  }

  updateFish(dt: number): void {
    for (const f of this._fish) f.update(dt, this._bounds)
    // Announcement fish swims and updates bubble
    if (this._announceFish) {
      this._announceFish.update(dt, this._bounds)
      this._announceTimer += dt
      if (this._announceTimer > 240) {
        this._announceTimer = 0
        this._announceIdx = (this._announceIdx + 1) % this._announceTexts.length
        if (this._announceBubble) this._announceBubble.text = this._announceTexts[this._announceIdx]
      }
    }
  }

  setBadge(text: string): void {
    const b = (this as any)._badgeTxt as PIXI.Text
    if (b) b.text = text
  }

  updateRank(rank: number): void {
    const rt = (this as any)._rankTxt as PIXI.Text
    if (!rt) return
    const medals = ['🥇', '🥈', '🥉']
    rt.text = rank < 3 ? medals[rank] : `${rank + 1}`
    rt.style.fill = rank < 3 ? '#F1C40F' : '#FFFFFF'
  }

  /** Show contributor avatars above fish area */
  showContributors(contributors: Array<{ url: string; count: number }>): void {
    for (const s of this._avatarSprites) { this.container.removeChild(s); s.destroy({ children: true }) }
    this._avatarSprites = []
    const max = Math.min(contributors.length, 8)
    const startX = 4; const y = 18; const size = 16
    for (let i = 0; i < max; i++) {
      const c = contributors[i]
      const ctn = new PIXI.Container()
      const img = wx.createImage()
      img.onload = () => {
        const canvas = wx.createCanvas(); canvas.width = size; canvas.height = size
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
        ctx.beginPath(); ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2); ctx.clip()
        ctx.drawImage(img, 0, 0, size, size)
        const tex = PIXI.Texture.from(canvas)
        const sp = new PIXI.Sprite(tex); sp.width = size; sp.height = size
        ctn.addChild(sp)
        if (c.count > 1) {
          const badge = new PIXI.Text(`×${c.count}`, {
            fontFamily: 'sans-serif', fontSize: 8, fill: '#F1C40F', fontWeight: 'bold',
          } as any)
          badge.x = size - 2; badge.y = size - 2
          ctn.addChild(badge)
        }
      }
      img.src = c.url
      ctn.x = startX + i * (size + 4); ctn.y = y
      this.container.addChild(ctn)
      this._avatarSprites.push(ctn)
    }
  }

  destroy(): void {
    this.clearFish()
    this.container.destroy({ children: true })
  }
}
