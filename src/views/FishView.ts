import * as PIXI from 'pixi.js-legacy'
import { getDPR } from '../platform/PixiAdapter'

/** Single swimming fish with state-machine animation */
/** Load fish sprite sheet once */
let _fishTexture: PIXI.BaseTexture | null = null

export function loadFishAtlas(url: string): void {
  const img = wx.createImage()
  img.onload = () => {
    const canvas = wx.createCanvas(); canvas.width = img.width; canvas.height = img.height
    canvas.getContext('2d').drawImage(img, 0, 0)
    _fishTexture = PIXI.BaseTexture.from(canvas)
  }
  img.src = url
}

const FISH_ORDER = ['xiaojinyu','xianyugan','jinli','hetun','moyu','haima','feiyu','zhangyu','bimuyu','pangxie','jianyu','haitun','__announcer__']

export function getFishTex(fishId: string, idx: number = 0): PIXI.Texture | null {
  if (!_fishTexture) return null
  const fishIdx = FISH_ORDER.indexOf(fishId)
  if (fishIdx < 0) return null
  const cols = 4; const CW = _fishTexture.width / cols; const CH = _fishTexture.height / 4
  const col = fishIdx % cols; const row = Math.floor(fishIdx / cols)
  const isShark = fishId === '__announcer__'
  const w = isShark ? CW * 2 : CW
  return new PIXI.Texture(_fishTexture, new PIXI.Rectangle(col * CW, row * CH, w, CH))
}

export class FishView {
  readonly sprite: PIXI.Sprite
  readonly container: PIXI.Container
  vx: number
  vy: number
  private phase: number
  state: string
  stateTimer: number
  dashChance = 0.05
  private _avatarSprite: PIXI.Sprite | null = null
  private _baseSize: number
  /** Crab lives at the bottom — restricted vertical movement */
  readonly bottomDweller: boolean

  constructor(fishId: string, idx: number, x: number, y: number, size: number) {
    this.bottomDweller = fishId === 'pangxie'
    this.container = new PIXI.Container()
    const tex = getFishTex(fishId, idx)
    this._baseSize = size
    if (tex) {
      this.sprite = new PIXI.Sprite(tex)
      this.sprite.anchor.set(0.5)
      // Maintain aspect ratio: height = size, width proportional
      this.sprite.height = size
      this.sprite.width = tex.width * (size / tex.height)
    } else {
      const emoji = fishId === '__announcer__' ? '🦈' : '🐟'
      this.sprite = new PIXI.Text(emoji, { fontFamily: 'sans-serif', fontSize: size, align: 'center' } as any)
      this.sprite.anchor.set(0.5)
    }
    this.sprite.x = 0; this.sprite.y = 0
    this.container.addChild(this.sprite as any)
    this.container.x = x; this.container.y = y
    this.sprite.alpha = 0.85

    if (this.bottomDweller) {
      // Crab: slow horizontal scuttle, no vertical drifting
      this.vx = 0.08 * (Math.random() > 0.5 ? 1 : -1)
      this.vy = 0
    } else {
      this.vx = 0.15 * (Math.random() > 0.5 ? 1 : -1)
      this.vy = 0.06 * (Math.random() > 0.5 ? 1 : -1)
    }
    this.phase = Math.random() * Math.PI * 2
    this.state = 'cruise'
    this.stateTimer = 60 + Math.random() * 120
  }

  update(dt: number, bounds: { x: number; y: number; w: number; h: number }, repeller?: { x: number; y: number }): void {
    const now = Date.now()

    // ── State machine ──
    this.stateTimer -= dt
    if (this.stateTimer <= 0) {
      const r = Math.random()
      if (this.state === 'cruise') {
        if (r < 0.3) this.state = 'turn'
        else if (r < 0.5) this.state = 'pause'
        else if (r < 0.50 + this.dashChance) this.state = 'dash'
        else this.state = 'cruise'
      } else if (this.state === 'turn') {
        this.state = 'cruise'; this.vx *= -1
      } else {
        this.state = 'cruise'
      }
      this.stateTimer = this.state === 'pause' ? 60 + Math.random() * 80 :
                       this.state === 'dash' ? 30 + Math.random() * 50 :
                       this.state === 'turn' ? 10 : 60 + Math.random() * 120
    }

    let speedMul = 1
    if (this.state === 'pause') speedMul = 0
    else if (this.state === 'dash') speedMul = 6
    else if (this.state === 'turn') speedMul = 0.3

    // Repulsion from announcer fish
    if (repeller) {
      const dx = this.container.x - repeller.x
      const dy = this.container.y - repeller.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 50 && dist > 0) {
        const force = (50 - dist) / 50 * 0.8
        this.container.x += (dx / dist) * force * dt
        this.container.y += (dy / dist) * force * dt
      }
    }

    this.container.x += this.vx * dt * speedMul
    this.container.y += this.vy * dt * speedMul

    // ── Boundary handling ──
    const margin = 28
    const bottomMargin = this.bottomDweller ? 8 : 150  // crab hugs bottom, fish keep 150px away

    if (this.bottomDweller) {
      // Crab: confined to bottom strip (bottom 30% of pond)
      const crabTop = bounds.y + bounds.h * 0.7
      const crabBottom = bounds.y + bounds.h - bottomMargin
      if (this.container.y < crabTop) { this.vy = Math.abs(this.vy); this.container.y = crabTop + 1 }
      if (this.container.y > crabBottom) { this.vy = -Math.abs(this.vy) * 0.3; this.container.y = crabBottom - 1 }
      // Crab still bounces at horizontal edges
      if (this.container.x < bounds.x + margin) { this.vx = Math.abs(this.vx); this.container.x = bounds.x + margin + 1 }
      if (this.container.x > bounds.x + bounds.w - margin - 6) { this.vx = -Math.abs(this.vx); this.container.x = bounds.x + bounds.w - margin - 7 }
    } else {
      // ── Wrap-around on horizontal edges ──
      const wrapBuffer = 40  // how far off-screen before wrapping
      if (this.container.x < bounds.x - wrapBuffer && this.vx < 0) {
        this.container.x = bounds.x + bounds.w + wrapBuffer
      }
      if (this.container.x > bounds.x + bounds.w + wrapBuffer && this.vx > 0) {
        this.container.x = bounds.x - wrapBuffer
      }

      // Vertical bounce stays as-is
      const bouncedY = this.container.y < bounds.y + margin || this.container.y > bounds.y + bounds.h - bottomMargin
      if (bouncedY) {
        this.state = 'dash'
        this.stateTimer = 20 + Math.random() * 30
      }
      if (this.container.y < bounds.y + margin) { this.vy = Math.abs(this.vy) * 0.3; this.container.y = bounds.y + margin + 1 }
      if (this.container.y > bounds.y + bounds.h - bottomMargin) { this.vy = -Math.abs(this.vy) * 0.3; this.container.y = bounds.y + bounds.h - bottomMargin - 1 }
    }

    // Body animation
    const animMul = this.state === 'dash' ? 3 : this.state === 'pause' ? 0.2 : 1
    const dir = this.vx > 0 ? -1 : 1
    const wag = Math.sin(now * 0.003 + this.phase) * 0.03 * animMul
    this.container.scale.x = dir
    this.sprite.rotation = wag
  }

  /** Show avatar above the fish */
  setAvatar(url: string): void {
    if (!url || this._avatarSprite) return
    const img = wx.createImage()
    const self = this
    img.onload = () => {
      if (!self.sprite || !self.container || self._destroyed) return
      const fishSize = self.sprite.height || 30
      const avatarSize = Math.floor(fishSize * 0.5)
      const dpr = getDPR()
      const canvas = wx.createCanvas()
      canvas.width = avatarSize * dpr; canvas.height = avatarSize * dpr
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
      ctx.scale(dpr, dpr)
      ctx.beginPath(); ctx.arc(avatarSize/2, avatarSize/2, avatarSize/2, 0, Math.PI * 2); ctx.clip()
      ctx.drawImage(img, 0, 0, avatarSize, avatarSize)
      const tex = PIXI.Texture.from(canvas)
      self._avatarSprite = new PIXI.Sprite(tex)
      self._avatarSprite.width = avatarSize; self._avatarSprite.height = avatarSize
      self._avatarSprite.anchor.set(0.5)
      self._avatarSprite.x = 0; self._avatarSprite.y = -fishSize * 0.5 - 6
      self.container.addChild(self._avatarSprite)
    }
    img.src = url
  }

  destroy(): void { this.container.destroy({ children: true }) }
}
