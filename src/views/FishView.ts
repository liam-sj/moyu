import * as PIXI from 'pixi.js-legacy'

/** Single swimming fish with state-machine animation */
export class FishView {
  readonly sprite: PIXI.Text
  readonly container: PIXI.Container
  vx: number
  vy: number
  private phase: number
  state: string
  stateTimer: number
  private _avatarSprite: PIXI.Sprite | null = null

  constructor(emoji: string, x: number, y: number, size: number) {
    this.container = new PIXI.Container()
    this.sprite = new PIXI.Text(emoji, {
      fontFamily: 'sans-serif', fontSize: Math.min(size * 1.5, size * 3.0), align: 'center',
    } as any)
    this.sprite.anchor.set(0.5)
    this.sprite.x = 0; this.sprite.y = 0
    this.container.addChild(this.sprite)
    this.container.x = x; this.container.y = y
    this.sprite.alpha = 0.7 + Math.random() * 0.3

    this.vx = 0.15 * (Math.random() > 0.5 ? 1 : -1)
    this.vy = 0.06 * (Math.random() > 0.5 ? 1 : -1)
    this.phase = Math.random() * Math.PI * 2
    this.state = 'cruise'
    this.stateTimer = 60 + Math.random() * 120
  }

  update(dt: number, bounds: { x: number; y: number; w: number; h: number }): void {
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

    // Bounce + dash when hitting edge
    const bounced = this.container.x < bounds.x + 28 || this.container.x > bounds.x + bounds.w - 34 ||
                    this.container.y < bounds.y + 28 || this.container.y > bounds.y + bounds.h - 30
    if (bounced) {
      this.state = 'dash'
      this.stateTimer = 20 + Math.random() * 30
    }
    if (this.container.x < bounds.x + 28) { this.vx = Math.abs(this.vx); this.container.x = bounds.x + 29 }
    if (this.container.x > bounds.x + bounds.w - 34) { this.vx = -Math.abs(this.vx); this.container.x = bounds.x + bounds.w - 35 }
    if (this.container.y < bounds.y + 28) { this.vy = Math.abs(this.vy); this.container.y = bounds.y + 29 }
    if (this.container.y > bounds.y + bounds.h - 30) { this.vy = -Math.abs(this.vy); this.container.y = bounds.y + bounds.h - 31 }

    // Body animation
    const animMul = this.state === 'dash' ? 3 : this.state === 'pause' ? 0.2 : 1
    const dir = this.vx > 0 ? -1 : 1
    const wiggle = 1 + Math.sin(now * 0.002 + this.phase) * 0.04 * animMul
    const wag = Math.sin(now * 0.003 + this.phase) * 0.03 * animMul
    this.sprite.scale.x = dir * wiggle
    this.sprite.scale.y = 1 / wiggle
    this.sprite.rotation = wag
  }

  /** Show avatar above the fish */
  setAvatar(url: string): void {
    if (!url || this._avatarSprite) return
    const img = wx.createImage()
    img.onload = () => {
      const canvas = wx.createCanvas(); const s = 16
      canvas.width = s; canvas.height = s
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
      ctx.beginPath(); ctx.arc(s/2, s/2, s/2, 0, Math.PI * 2); ctx.clip()
      ctx.drawImage(img, 0, 0, s, s)
      const tex = PIXI.Texture.from(canvas)
      this._avatarSprite = new PIXI.Sprite(tex)
      this._avatarSprite.anchor.set(0.5)
      this._avatarSprite.x = 0; this._avatarSprite.y = -this.sprite.height * 0.5 - 10
      this.container.addChild(this._avatarSprite)
    }
    img.src = url
  }

  destroy(): void { this.container.destroy({ children: true }) }
}
