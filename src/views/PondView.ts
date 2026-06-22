import * as PIXI from 'pixi.js-legacy'
import { FishView } from './FishView'
import type { PondConfig } from '../config/ponds'
import { ALL_FISH_IDS } from '../config/ponds'
import { screenPos, px, getDPR } from '../platform/PixiAdapter'

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
  private _announceIdx = 0
  private _announceTimer = 0

  /** Generate context-aware messages based on current fish count */
  private _getAnnounceTexts(): string[] {
    const n = this._fish.length

    if (n === 0) {
      return [
        '这片鱼塘…就我一个？',
        '🐟 通关第二关加入鱼塘！',
        '🏆 来为鱼塘争光吧！',
        '怎么一条小鱼都没有…',
        '新鱼塘开张，招鱼啦！',
        '再不来鱼我要摸鱼了！',
      ]
    }

    if (n <= 3) {
      return [
        '嘿，新来的！',
        '来这边报到，别乱游！',
        '🐠 点击小鱼会冲刺哦',
        '欢迎新伙伴加入～',
        '队伍越来越壮大了！',
        '🔥 连续通关霸榜吧！',
        '别害羞，游过来点！',
        '新鱼要先熟悉规矩！',
      ]
    }

    if (n <= 8) {
      return [
        '别靠我太近！',
        '都给我老实游！',
        '我是塘管，有事找我！',
        '谁又偷偷摸鱼了？',
        '保持队形，不要掉队！',
        '🐠 鱼多力量大！',
        '今天鱼气不错～',
        '再通关还能加鱼哦！',
      ]
    }

    // Crowded pond (n > 8)
    return [
      '鱼太多了，别挤！',
      '谁再挤我就冲刺了！',
      '保持距离！保持距离！',
      '后面那位别推我！！',
      '我快被挤成鱼干了…',
      '🏆 鱼塘爆满，太强了！',
      '别靠太近，我有脾气！',
      '再挤我要咬鱼了！！',
      '给我让条水路出来！',
      '鲨鱼也是需要空间的！',
      '今天鱼山鱼海啊…',
    ]
  }

  constructor(pond: PondConfig, rank: number, x: number, y: number, w: number, h: number) {
    this._pondConfig = pond
    this._bounds = { x: 4, y: 4, w: w - 8, h: h - 8 }  // full pond area for fish
    this.container.x = x
    this.container.y = y


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
    // 🦈 Shark announcer — bigger than regular fish
    const f = new FishView('__announcer__', 0,
      this._bounds.x + this._bounds.w / 2,
      this._bounds.y + this._bounds.h / 2,
      48  // bigger shark
    )
    f.dashChance = 0.01  // shark rarely dashes
    this._announceFish = f
    this.container.addChild(f.container)

    // Speech bubble text
    const bubbleTxt = new PIXI.Text(this._getAnnounceTexts()[0], {
      fontFamily: 'sans-serif', fontSize: 14, fontWeight: 'bold', fill: '#FFFFFF',
      backgroundColor: '#333333', backgroundAlpha: 0.85,
    } as any)
    bubbleTxt.anchor.set(0.5)
    bubbleTxt.x = 0; bubbleTxt.y = -28
    // Counter-flip: keep text readable regardless of fish direction
    this._announceBubble = bubbleTxt
    f.container.addChild(bubbleTxt)
  }

  /** Keep announcement bubble readable when fish flips direction */
  private _fixBubbleDirection(): void {
    if (this._announceFish && this._announceBubble) {
      const dir = this._announceFish.container.scale.x
      this._announceBubble.scale.x = dir > 0 ? 1 : -1
    }
  }

  /** Spawn fish with given count (deprecated, prefer spawnFromEntries) */
  spawnFish(count: number, contributors?: Array<{ url: string; count: number; fishId?: string }>): void {
    this.clearFish()
    this.fishHitAreas = []
    const max = Math.min(count, 30)
    this._spawnAnnouncer()
    const avatarList: string[] = []
    const fishIdList: string[] = []
    if (contributors) {
      for (const c of contributors) {
        const isValid = c.fishId && ALL_FISH_IDS.indexOf(c.fishId) >= 0
        const cFishId = isValid ? c.fishId! : this._pondConfig.fishId
        for (let j = 0; j < Math.min(c.count, max); j++) {
          avatarList.push(c.url)
          fishIdList.push(cFishId)
        }
      }
    }
    this._spawnFishes(max, fishIdList, avatarList)
  }

  /** Spawn fish from flat entries — each entry is one fish with its own type */
  spawnFromEntries(entries: Array<{ url: string; fishId: string }>): void {
    this.clearFish()
    this.fishHitAreas = []
    const max = Math.min(entries.length, 30)
    this._spawnAnnouncer()
    const fishIdList: string[] = []
    const avatarList: string[] = []
    for (let i = 0; i < max; i++) {
      const e = entries[i]
      const isValid = e.fishId && ALL_FISH_IDS.indexOf(e.fishId) >= 0
      fishIdList.push(isValid ? e.fishId : this._pondConfig.fishId)
      avatarList.push(e.url || '')
    }
    this._spawnFishes(max, fishIdList, avatarList)
  }

  /** Internal: create fish views from prepared lists */
  private _spawnFishes(max: number, fishIdList: string[], avatarList: string[]): void {
    for (let i = 0; i < max; i++) {
      const useFishId = i < fishIdList.length ? fishIdList[i] : this._pondConfig.fishId
      const isCrab = useFishId === 'pangxie'
      // Crab stays at bottom strip, other fish distributed across pond
      const fy = isCrab
        ? this._bounds.y + this._bounds.h * 0.78 + ((i * 23 + 11) % Math.max(1, this._bounds.h * 0.18))
        : this._bounds.y + 14 + ((i * 31 + 7) % Math.max(1, this._bounds.h - 28))
      const f = new FishView(useFishId, i,
        this._bounds.x + 10 + ((i * 47 + 13) % Math.max(1, this._bounds.w - 24)),
        fy,
        isCrab ? 24 : 28 + ((i * 19 + 5) % 10)
      )
      if (i < avatarList.length) f.setAvatar(avatarList[i])
      this._fish.push(f)
      this.container.addChild(f.container)
      this.fishHitAreas.push({
        rect: { x: f.container.x, y: f.container.y, w: 1, h: 1 },
        cb: () => { f.state = 'dash'; f.stateTimer = 30 + Math.random() * 40 }
      })
    }
  }

  /** Update per-fish hit area positions (called each frame, returns logical-pixel rects) */
  getFishHitAreas(): Array<{ rect: { x: number; y: number; w: number; h: number }; cb: () => void }> {
    const result: Array<{ rect: { x: number; y: number; w: number; h: number }; cb: () => void }> = []
    const dpr = (typeof wx !== 'undefined' ? wx.getSystemInfoSync().pixelRatio : 1) || 2
    const size = 36  // logical pixels
    for (let i = 0; i < this._fish.length; i++) {
      const f = this._fish[i]
      const cb = this.fishHitAreas[i]?.cb
      if (cb) {
        const sp = screenPos(f.container)
        result.push({
          rect: { x: sp.x / dpr - size / 2, y: sp.y / dpr - size / 2, w: size, h: size },
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
    const repeller = this._announceFish ? { x: this._announceFish.container.x, y: this._announceFish.container.y } : undefined
    for (const f of this._fish) f.update(dt, this._bounds, repeller)
    // Announcement fish swims and updates bubble
    if (this._announceFish) {
      this._announceFish.update(dt, this._bounds)
      this._fixBubbleDirection()
      this._announceTimer += dt
      if (this._announceTimer > 240) {
        this._announceTimer = 0
        const texts = this._getAnnounceTexts()
        this._announceIdx = (this._announceIdx + 1) % texts.length
        if (this._announceBubble) this._announceBubble.text = texts[this._announceIdx]
      }
    }
  }

  setBadge(text: string): void {
    const b = (this as any)._badgeTxt as PIXI.Text
    if (b) b.text = text
  }

  /** @deprecated Rank is now shown on MenuScene's bulletin board */
  updateRank(_rank: number): void {}

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
        const dpr = getDPR()
        const canvas = wx.createCanvas(); canvas.width = size * dpr; canvas.height = size * dpr
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
        ctx.scale(dpr, dpr)
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
