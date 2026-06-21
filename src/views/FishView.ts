import * as PIXI from 'pixi.js-legacy'

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

const FISH_ORDER = ['xiaojinyu','xianyugan','jinli','hetun','moyu','haima','feiyu','zhangyu','bimuyu','pangxie','jianyu','haitun']

function getFishTex(fishId: string, idx: number): PIXI.Texture | null {
  if (!_fishTexture) return null
  const fishIdx = FISH_ORDER.indexOf(fishId)
  if (fishIdx < 0) return null
  const cols = 4; const CW = _fishTexture.width / cols; const CH = _fishTexture.height / 3
  const col = fishIdx % cols; const row = Math.floor(fishIdx / cols)
  return new PIXI.Texture(_fishTexture, new PIXI.Rectangle(col * CW, row * CH, CW, CH))
}

export class FishView {
  readonly sprite: PIXI.Sprite
  readonly container: PIXI.Container
  vx: number
  vy: number
  private phase: number
  state: string
  stateTimer: number
  private _avatarSprite: PIXI.Sprite | null = null
  private _baseSize: number

  constructor(fishId: string, idx: number, x: number, y: number, size: number) {
    this.container = new PIXI.Container()
    const tex = getFishTex(fishId, idx)
    this._baseSize = size
    if (tex) {
      this.sprite = new PIXI.Sprite(tex)
      this.sprite.anchor.set(0.5)
      this.sprite.width = size; this.sprite.height = size
    } else {
      this.sprite = new PIXI.Text('🐟', { fontFamily: 'sans-serif', fontSize: size, align: 'center' } as any)
      this.sprite.anchor.set(0.5)
    }
    this.sprite.x = 0; this.sprite.y = 0
    this.container.addChild(this.sprite as any)
    this.container.x = x; this.container.y = y
    this.sprite.alpha = 0.85

    this.vx = 0.15 * (Math.random() > 0.5 ? 1 : -1)
    this.vy = 0.06 * (Math.random() > 0.5 ? 1 : -1)
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
        else if (r < 0.55) this.state = 'dash'
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

    this.container.x += this.vx * dt * speedMul
    this.container.y += this.vy * dt * speedMul

    // Bounce + dash when hitting edge (Y dash is gentler to prevent oscillation)
    const bouncedX = this.container.x < bounds.x + 28 || this.container.x > bounds.x + bounds.w - 34
    const bouncedY = this.container.y < bounds.y + 28 || this.container.y > bounds.y + bounds.h - 30
    if (bouncedX || bouncedY) {
      this.state = 'dash'
      this.stateTimer = 20 + Math.random() * 30
    }
    if (this.container.x < bounds.x + 28) { this.vx = Math.abs(this.vx); this.container.x = bounds.x + 29 }
    if (this.container.x > bounds.x + bounds.w - 34) { this.vx = -Math.abs(this.vx); this.container.x = bounds.x + bounds.w - 35 }
    if (this.container.y < bounds.y + 28) { this.vy = Math.abs(this.vy) * 0.3; this.container.y = bounds.y + 29 }
    if (this.container.y > bounds.y + bounds.h - 30) { this.vy = -Math.abs(this.vy) * 0.3; this.container.y = bounds.y + bounds.h - 31 }

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
    img.onload = () => {
      const fishSize = this.sprite.height || 30
      const avatarSize = Math.floor(fishSize * 0.5)
      const canvas = wx.createCanvas()
      canvas.width = avatarSize; canvas.height = avatarSize
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
      ctx.beginPath(); ctx.arc(avatarSize/2, avatarSize/2, avatarSize/2, 0, Math.PI * 2); ctx.clip()
      ctx.drawImage(img, 0, 0, avatarSize, avatarSize)
      const tex = PIXI.Texture.from(canvas)
      this._avatarSprite = new PIXI.Sprite(tex)
      this._avatarSprite.width = avatarSize; this._avatarSprite.height = avatarSize
      this._avatarSprite.anchor.set(0.5)
      this._avatarSprite.x = 0; this._avatarSprite.y = -fishSize * 0.5 - 6
      this.container.addChild(this._avatarSprite)
    }
    img.src = url
  }

  destroy(): void { this.container.destroy({ children: true }) }
}
