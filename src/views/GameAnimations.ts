import * as PIXI from 'pixi.js-legacy'
import type { CardView } from './CardView'
import type { SlotBar } from '../core/SlotBar'
import { speedUp } from '../config/animation'

export interface FlyEffect {
  view: CardView; uid: string; startX: number; startY: number
  targetX: number; targetY: number; targetScale: number; elapsed: number; duration: number
  flipElapsed: number; flipDuration: number; holdDuration: number
  flipDone: boolean; holdDone: boolean; flipFaceRedrawn: boolean
}

export class GameAnimations {
  container: PIXI.Container

  dealingCards: Array<{
    view: CardView; uid: string; targetX: number; targetY: number
    _fromX: number; _fromY: number; _startTime: number; _animMs: number
    _arcHeight: number
  }> = []

  shuffleCards: Array<{
    view: CardView; uid: string; fromX: number; fromY: number
    targetX: number; targetY: number; _startTime: number; _animMs: number
  }> = []

  flyEffects: FlyEffect[] = []

  effects: Array<{
    particles: PIXI.Text[]
    elapsed: number
    duration: number
    origins: Array<{ x: number; y: number; angle: number }>
  }> = []

  /** Cards that landed in slot — wait N frames before checking match */
  private pendingMatches: Array<{ slotBar: SlotBar; uid: string; delay: number }> = []

  /** Called when a card finishes flying and lands in the slot */
  onFlyLanded: ((uid: string) => void) | null = null
  /** Called when all cards in a layer have finished their dealing animation */
  onLayerDealt: ((layer: number) => void) | null = null

  private _dealtLayerTotal: Map<number, number> = new Map()
  private _dealtLayerArrived: Map<number, number> = new Map()

  constructor(container: PIXI.Container) {
    this.container = container
  }

  update(dt: number, cardViews: Map<string, CardView>, slotBar: SlotBar): void {
    const frameDt = Math.min(dt, 3)

    // Drive dealing animations (batch, real-time based) — fish swimming up arc
    // Lazy-init per-layer counts on first frame
    if (this._dealtLayerTotal.size === 0 && this.dealingCards.length > 0) {
      for (const dc of this.dealingCards) {
        const l = dc.view.layer
        this._dealtLayerTotal.set(l, (this._dealtLayerTotal.get(l) || 0) + 1)
        this._dealtLayerArrived.set(l, 0)
      }
    }
    const now = Date.now()
    for (let d = this.dealingCards.length - 1; d >= 0; d--) {
      const dc = this.dealingCards[d]
      if (!dc.view || (dc.view as any)._destroyed) { this.dealingCards.splice(d, 1); continue }
      const elapsed = now - dc._startTime
      if (elapsed < 0) continue
      const p = Math.min(elapsed / dc._animMs, 1)
      // ease-in-out: slow start → fast middle → slow settle
      const t = p < 0.5
        ? 4 * p * p * p
        : 1 - Math.pow(-2 * p + 2, 3) / 2
      // Arc path: fish leap upward then glide down into position
      const arcY = -dc._arcHeight * 3 * p * (1 - p)
      dc.view.container.x = dc._fromX + (dc.targetX - dc._fromX) * t
      dc.view.container.y = dc._fromY + (dc.targetY - dc._fromY) * t + arcY
      dc.view.container.alpha = Math.min(p * 2, 1)
      dc.view.container.scale.set(0.2 + 0.8 * Math.min(p * 1.6, 1))
      if (p >= 1) {
        const layer = dc.view.layer
        dc.view.snapToTarget()
        this.dealingCards.splice(d, 1)
        // Track per-layer completion — trigger when ~30% of layer has arrived
        const arrived = (this._dealtLayerArrived.get(layer) || 0) + 1
        this._dealtLayerArrived.set(layer, arrived)
        const total = this._dealtLayerTotal.get(layer) || 1
        if (arrived === Math.max(1, Math.ceil(total * 0.3))) {
          if (this.onLayerDealt) this.onLayerDealt(layer)
        }
      }
    }

    // Drive shuffle animations (real-time based)
    for (let s = this.shuffleCards.length - 1; s >= 0; s--) {
      const sc = this.shuffleCards[s]
      if (!sc.view || (sc.view as any)._destroyed) { this.shuffleCards.splice(s, 1); continue }
      const elapsed = now - sc._startTime
      if (elapsed < 0) continue
      const p = Math.min(elapsed / sc._animMs, 1)
      const t = 1 - Math.pow(1 - p, 2)
      sc.view.container.x = sc.fromX + (sc.targetX - sc.fromX) * t
      sc.view.container.y = sc.fromY + (sc.targetY - sc.fromY) * t
      if (p >= 1) {
        sc.view.container.x = sc.targetX
        sc.view.container.y = sc.targetY
        this.shuffleCards.splice(s, 1)
      }
    }

    // Drive fly-to-slot animations (with optional flip phase for event cards)
    for (let f = this.flyEffects.length - 1; f >= 0; f--) {
      const fly = this.flyEffects[f]
      if (!fly.view || (fly.view as any)._destroyed) { this.flyEffects.splice(f, 1); continue }

      // Phase 1: Flip reveal (event cards only)
      if (!fly.flipDone && fly.flipDuration > 0) {
        fly.flipElapsed += frameDt
        const half = fly.flipDuration / 2
        const flipProgress = Math.min(fly.flipElapsed / fly.flipDuration, 1)
        const view = fly.view

        if (fly.flipElapsed < half) {
          view.container.scale.x = 1 - (fly.flipElapsed / half)
        }
        if (fly.flipElapsed >= half && !fly.flipFaceRedrawn) {
          fly.flipFaceRedrawn = true
          view.redrawFace()
          view.container.scale.x = 0
        }
        if (fly.flipElapsed >= half) {
          view.container.scale.x = Math.min(1, (fly.flipElapsed - half) / half)
        }
        const pop = flipProgress < 0.5
          ? 1 + flipProgress * 0.3
          : 1 + (1 - flipProgress) * 0.3
        view.container.scale.y = pop

        if (fly.flipElapsed >= fly.flipDuration) {
          view.container.scale.set(1)
          fly.flipDone = true
        }
        continue
      }

      // Phase 2: Hold
      if (fly.flipDone && !fly.holdDone && fly.holdDuration > 0) {
        fly.flipElapsed += frameDt
        if (fly.flipElapsed >= fly.flipDuration + fly.holdDuration) {
          fly.holdDone = true
        }
        continue
      }

      // Phase 3: Fly to slot
      fly.elapsed += frameDt
      const progress = Math.min(fly.elapsed / fly.duration, 1)
      const t2 = 1 - Math.pow(1 - progress, 2)
      fly.view.container.x = fly.startX + (fly.targetX - fly.startX) * t2
      fly.view.container.y = fly.startY + (fly.targetY - fly.startY) * t2
      const scale = 1 - progress * (1 - fly.targetScale)
      fly.view.container.scale.set(scale)
      fly.view.container.alpha = 1 - progress * 0.3
      if (progress >= 1) {
        fly.view.destroy()
        cardViews.delete(fly.uid)
        this.flyEffects.splice(f, 1)
        if (this.onFlyLanded) this.onFlyLanded(fly.uid)
        slotBar.notifySlotChanged()
        // Delay match check so player sees card settle in slot first
        this.pendingMatches.push({ slotBar, uid: fly.uid, delay: speedUp(12) })
      }
    }

    // Drive particle effects
    for (let e = this.effects.length - 1; e >= 0; e--) {
      const eff = this.effects[e]
      eff.elapsed += frameDt
      const progress = Math.min(eff.elapsed / eff.duration, 1)
      const t = progress
      for (let i = 0; i < eff.particles.length; i++) {
        const p = eff.particles[i]
        const o = eff.origins[i]
        const dist = t * 55
        p.x = o.x + Math.cos(o.angle) * dist
        p.y = o.y + Math.sin(o.angle) * dist - t * 25
        p.alpha = 1 - t * t
        p.scale.set(0.4 + t * 0.8)
      }
      if (progress >= 1) {
        for (const p of eff.particles) {
          this.container.removeChild(p)
          p.destroy()
        }
        this.effects.splice(e, 1)
      }
    }

    // Delayed match checks — wait for card to visually settle in slot
    for (let m = this.pendingMatches.length - 1; m >= 0; m--) {
      const pm = this.pendingMatches[m]
      pm.delay -= frameDt
      if (pm.delay <= 0) {
        this.pendingMatches.splice(m, 1)
        for (let i = 0; i < pm.slotBar.maxSlots; i++) {
          if (pm.slotBar.slots[i] && pm.slotBar.slots[i]!.uid === pm.uid) {
            pm.slotBar.checkMatch(pm.slotBar.slots[i]!.cardId)
            break
          }
        }
        if (pm.slotBar.bonusSlot && pm.slotBar.bonusSlot.uid === pm.uid) {
          pm.slotBar.checkMatch(pm.slotBar.bonusSlot.cardId)
        }
      }
    }
  }

  /** Burst particle effect when cards are eliminated */
  playEliminationEffect(x: number, y: number): void {
    const particles: PIXI.Text[] = []
    const origins: Array<{ x: number; y: number; angle: number }> = []
    const emojis = ['✨', '💥', '⭐', '🌟', '💫']
    for (let i = 0; i < 6; i++) {
      const emoji = emojis[i % emojis.length]
      const ox = x + (Math.random() - 0.5) * 40
      const oy = y + (Math.random() - 0.5) * 20
      const p = new PIXI.Text(emoji, {
        fontFamily: 'sans-serif', fontSize: 20 + Math.random() * 16,
      } as any)
      p.anchor.set(0.5)
      p.x = ox; p.y = oy
      p.alpha = 1; p.scale.set(0.4)
      this.container.addChild(p)
      particles.push(p)
      origins.push({ x: ox, y: oy, angle: (i / 6) * Math.PI * 2 + (Math.random() - 0.5) * 0.5 })
    }
    this.effects.push({ particles, elapsed: 0, duration: speedUp(30), origins })
  }

  /** Sparkle particles around the revealed fish */
  playFishSparkles(x: number, y: number): void {
    const particles: PIXI.Text[] = []
    const origins: Array<{ x: number; y: number; angle: number }> = []
    const emojis = ['✨', '⭐', '🌟', '💫', '✨', '💛']
    for (let i = 0; i < 10; i++) {
      const ox = x + (Math.random() - 0.5) * 120
      const oy = y + (Math.random() - 0.5) * 80
      const p = new PIXI.Text(emojis[i % emojis.length], {
        fontFamily: 'sans-serif', fontSize: 16 + Math.random() * 20,
      } as any)
      p.anchor.set(0.5)
      p.x = ox; p.y = oy
      p.alpha = 0.9; p.scale.set(0.3)
      this.container.addChild(p)
      particles.push(p)
      origins.push({ x: ox, y: oy, angle: (i / 10) * Math.PI * 2 + Math.random() * 0.5 })
    }
    this.effects.push({ particles, elapsed: 0, duration: speedUp(50), origins })
  }

  reset(): void {
    for (const eff of this.effects) {
      for (const p of eff.particles) { this.container.removeChild(p); p.destroy() }
    }
    this.flyEffects.length = 0
    this.effects.length = 0
    this.dealingCards.length = 0
    this.shuffleCards.length = 0
    this.pendingMatches.length = 0
  }
}
