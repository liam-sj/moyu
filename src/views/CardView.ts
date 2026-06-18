import * as PIXI from 'pixi.js-legacy'
import type { BoardCard } from '../core/types'
import { getCardColor } from '../core/Card'

function hexToInt(hex: string): number {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result) {
    return (parseInt(result[1], 16) << 16) | (parseInt(result[2], 16) << 8) | parseInt(result[3], 16)
  }
  return 0xFF8C42
}

export class CardView {
  readonly container = new PIXI.Container()
  readonly uid: string
  readonly layer: number
  private _card: BoardCard
  private _cardWidth: number
  private _cardHeight: number
  private _isCovered: boolean
  private _targetX: number
  private _targetY: number

  constructor(
    card: BoardCard,
    cardWidth: number,
    cardHeight: number,
    layerOffsetX: number,
    layerOffsetY: number,
    gap: number,
    offsetX: number,
    offsetY: number,
    staggerLayers = false
  ) {
    this.uid = card.uid
    this.layer = card.layer
    this._card = card
    this._cardWidth = cardWidth
    this._cardHeight = cardHeight
    this._isCovered = card.isCovered

    // Brick-wall stagger: odd layers offset by half card width
    const staggerX = (staggerLayers && card.layer % 2 === 1) ? Math.floor(cardWidth / 2) : 0

    // Target position from grid + layer offset
    const baseX = offsetX + card.col * (cardWidth + gap) + card.layer * layerOffsetX + staggerX
    const baseY = offsetY + card.row * (cardHeight + gap) - card.layer * layerOffsetY

    // Deterministic jitter (±3px) from uid for organic pile look
    const uidNum = parseInt(card.uid.slice(1), 10) || 0
    const jitterX = ((uidNum * 7 + 13) % 7) - 3
    const jitterY = ((uidNum * 13 + 7) % 7) - 3

    this._targetX = baseX + jitterX
    this._targetY = baseY + jitterY

    this._draw()
  }

  private _animTicker: (() => void) | null = null
  private _destroyed = false

  /** Animate card from a deck position to its target with a staggered delay. */
  animateIn(fromX: number, fromY: number, delay: number, duration = 250): void {
    this.container.x = fromX
    this.container.y = fromY
    this.container.alpha = 0
    this.container.scale.set(0.6)

    const targetX = this._targetX
    const targetY = this._targetY
    const startTime = Date.now() + delay

    const ticker = PIXI.Ticker.shared
    const tick = () => {
      if (this._destroyed) { ticker.remove(tick); return }
      const now = Date.now()
      if (now < startTime) return
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const t = 1 - Math.pow(1 - progress, 3)
      const scale = 0.6 + 0.4 * Math.min(progress * 1.5, 1)

      this.container.x = fromX + (targetX - fromX) * t
      this.container.y = fromY + (targetY - fromY) * t
      this.container.alpha = Math.min(progress * 2, 1)
      this.container.scale.set(scale)

      if (progress >= 1) {
        this.container.x = targetX
        this.container.y = targetY
        this.container.alpha = 1
        this.container.scale.set(1)
        ticker.remove(tick)
        this._animTicker = null
      }
    }
    this._animTicker = tick
    ticker.add(tick)
  }

  /** Skip animation — snap to target position */
  snapToTarget(): void {
    this.container.x = this._targetX
    this.container.y = this._targetY
    this.container.alpha = 1
    this.container.scale.set(1)
  }

  /** Incrementally update covered visual state without full recreation */
  setCovered(covered: boolean): void {
    if (this._isCovered === covered) return
    this._isCovered = covered
    this._card.isCovered = covered
    // Remove all children and redraw — cheap, no PIXI object allocation for the container
    this.container.removeChildren()
    this._draw()
  }

  get isCovered(): boolean { return this._isCovered }

  private _draw(): void {
    const card = this._card
    const w = this._cardWidth
    const h = this._cardHeight
    const covered = this._isCovered

    // Drop shadow — larger and darker for higher layers to create depth
    const shadowOffset = Math.min(2 + this._layer * 1.5, 6)
    const shadowAlpha = Math.min(0.15 + this._layer * 0.08, 0.40)
    const shadowBlur = Math.min(2 + this._layer, 6)

    // Main shadow (bottom-right offset)
    const shadow = new PIXI.Graphics()
    shadow.beginFill(0x000000, shadowAlpha)
    shadow.drawRoundedRect(shadowOffset, shadowOffset + shadowBlur * 0.5, w, h, 6)
    shadow.endFill()
    this.container.addChild(shadow)

    // Secondary lighter shadow for softer depth
    const shadow2 = new PIXI.Graphics()
    shadow2.beginFill(0x000000, shadowAlpha * 0.5)
    shadow2.drawRoundedRect(shadowOffset + 1, shadowOffset + 1, w, h, 6)
    shadow2.endFill()
    this.container.addChild(shadow2)

    const colorStr = getCardColor(card)
    const colorInt = hexToInt(colorStr)

    // Card body.
    // Uncovered  → bright white, full highlight, clearly clickable
    // Covered    → dark grey, heavily obscured "buried" look
    const bg = new PIXI.Graphics()
    bg.beginFill(covered ? 0xB0BCC8 : 0xFFFFFF)
    bg.drawRoundedRect(0, 0, w, h, 6)
    bg.endFill()
    bg.lineStyle(1, covered ? 0x99A4B0 : 0xD0D6DC, 0.8)
    bg.drawRoundedRect(0, 0, w, h, 6)
    bg.lineStyle(2, colorInt, covered ? 0.25 : 0.75)
    bg.drawRoundedRect(1, 1, w - 2, h - 2, 5)
    this.container.addChild(bg)

    // Covered cards get a heavy dark overlay
    if (covered) {
      const coverOverlay = new PIXI.Graphics()
      coverOverlay.beginFill(0x1A252F, 0.32)
      coverOverlay.drawRoundedRect(0, 0, w, h, 6)
      coverOverlay.endFill()
      this.container.addChild(coverOverlay)
    }

    // Emoji-only display — centered in the card
    const displayIcon = (card.type === 'event' && !card.isRevealed) ? '❓' : card.icon
    const iconText = new PIXI.Text(displayIcon, {
      fontFamily: 'sans-serif', fontSize: Math.max(18, Math.floor(w * 0.50)), align: 'center',
    } as any)
    iconText.anchor.set(0.5)
    iconText.x = w / 2
    iconText.y = h / 2
    this.container.addChild(iconText)

    const bar = new PIXI.Graphics()
    bar.beginFill(colorInt, 0.8)
    bar.drawRect(4, h - 5, w - 8, 3)
    bar.endFill()
    this.container.addChild(bar)
  }

  destroy(): void {
    this._destroyed = true
    if (this._animTicker) {
      PIXI.Ticker.shared.remove(this._animTicker)
      this._animTicker = null
    }
    this.container.destroy({ children: true })
  }
}
