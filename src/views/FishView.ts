import * as PIXI from 'pixi.js-legacy'

/** Single swimming fish with state-machine animation */
export class FishView {
  readonly sprite: PIXI.Text
  vx: number
  vy: number
  private phase: number
  state: string
  stateTimer: number

  constructor(emoji: string, x: number, y: number, size: number) {
    this.sprite = new PIXI.Text(emoji, {
      fontFamily: 'sans-serif', fontSize: size, align: 'center',
    } as any)
    this.sprite.anchor.set(0.5)
    this.sprite.x = x
    this.sprite.y = y
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

    this.sprite.x += this.vx * dt * speedMul
    this.sprite.y += this.vy * dt * speedMul

    // Bounce + dash when hitting edge
    const bounced = this.sprite.x < bounds.x + 18 || this.sprite.x > bounds.x + bounds.w - 24 ||
                    this.sprite.y < bounds.y + 14 || this.sprite.y > bounds.y + bounds.h - 18
    if (bounced) {
      this.state = 'dash'
      this.stateTimer = 20 + Math.random() * 30
    }
    if (this.sprite.x < bounds.x + 18) { this.vx = Math.abs(this.vx); this.sprite.x = bounds.x + 19 }
    if (this.sprite.x > bounds.x + bounds.w - 24) { this.vx = -Math.abs(this.vx); this.sprite.x = bounds.x + bounds.w - 25 }
    if (this.sprite.y < bounds.y + 14) { this.vy = Math.abs(this.vy); this.sprite.y = bounds.y + 15 }
    if (this.sprite.y > bounds.y + bounds.h - 18) { this.vy = -Math.abs(this.vy); this.sprite.y = bounds.y + bounds.h - 19 }

    // Body animation
    const animMul = this.state === 'dash' ? 3 : this.state === 'pause' ? 0.2 : 1
    const dir = this.vx > 0 ? -1 : 1
    const wiggle = 1 + Math.sin(now * 0.002 + this.phase) * 0.04 * animMul
    const wag = Math.sin(now * 0.003 + this.phase) * 0.03 * animMul
    this.sprite.scale.x = dir * wiggle
    this.sprite.scale.y = 1 / wiggle
    this.sprite.rotation = wag
  }

  destroy(): void { this.sprite.destroy() }
}
