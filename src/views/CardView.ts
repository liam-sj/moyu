import * as PIXI from 'pixi.js-legacy'
import type { BoardCard } from '../core/types'
import { getCardColor } from '../core/Card'
import { ATLAS, atlasKey, ATLAS_PATH, buildAtlas } from '../config/atlas'

function hexToInt(hex: string): number {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result) {
    return (parseInt(result[1], 16) << 16) | (parseInt(result[2], 16) << 8) | parseInt(result[3], 16)
  }
  return 0xFF8C42
}

/** Shared base texture — loaded once via wx.createImage, shared by all CardViews */
let _baseTexture: PIXI.BaseTexture | null = null

let _onAtlasLoaded: (() => void) | null = null

export function onAtlasReady(cb: () => void): void {
  if (_baseTexture) { cb(); return }
  _onAtlasLoaded = cb
}

export function loadCardAtlas(): void {
  if (typeof wx === 'undefined') return
  const img = wx.createImage()
  img.onload = () => {
    buildAtlas(img.width, img.height)
    const canvas = wx.createCanvas()
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    if (ctx.imageSmoothingQuality) (ctx as any).imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0)
    _baseTexture = PIXI.BaseTexture.from(canvas)
    if (_onAtlasLoaded) { _onAtlasLoaded(); _onAtlasLoaded = null }
  }
  img.onerror = (e: any) => { console.warn('Card atlas load failed', e) }
  img.src = ATLAS_PATH
}

/** Create a card sprite (or emoji text fallback) for use in slots and board */
export function createCardImage(
  cardId: string, icon: string, isEvent: boolean, isRevealed: boolean,
  maxW: number, maxH: number, covered = false
): PIXI.Container {
  const ctn = new PIXI.Container()
  const tex = getTexture(cardId, isEvent, isRevealed)
  if (tex) {
    const sprite = new PIXI.Sprite(tex)
    sprite.anchor.set(0.5)
    // Scale to fit within card, preserving aspect ratio
    const padding = maxW * 0.12
    const scale = Math.min((maxW - padding) / tex.width, (maxH - padding) / tex.height)
    sprite.width = tex.width * scale
    sprite.height = tex.height * scale
    sprite.x = 0
    sprite.y = 0
    if (covered) sprite.tint = 0x556677
    ctn.addChild(sprite)
  } else {
    const displayIcon = (isEvent && !isRevealed) ? '❓' : icon
    const txt = new PIXI.Text(displayIcon, {
      fontFamily: 'sans-serif', fontSize: Math.max(12, Math.floor(maxW * 0.45)), align: 'center',
    } as any)
    txt.anchor.set(0.5)
    ctn.addChild(txt)
  }
  return ctn
}

/** Texture cache — key → PIXI.Texture, reused across all CardViews */
const _texCache: Record<string, PIXI.Texture> = {}

function getTexture(cardId: string, isEvent: boolean, isRevealed: boolean): PIXI.Texture | null {
  if (!_baseTexture) return null
  const key = atlasKey(cardId, isEvent, isRevealed)
  if (_texCache[key]) return _texCache[key]
  const cell = ATLAS[key]
  if (!cell) return null
  _texCache[key] = new PIXI.Texture(_baseTexture, new PIXI.Rectangle(cell.x, cell.y, cell.w, cell.h))
  return _texCache[key]
}

export class CardView {
  readonly container = new PIXI.Container()
  readonly uid: string
  readonly layer: number
  private _card: BoardCard
  private _cardWidth: number
  private _cardHeight: number
  private _isCovered: boolean
  /** Exposed for batch animation */
  readonly targetX: number
  readonly targetY: number

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

    this.targetX = baseX + jitterX
    this.targetY = baseY + jitterY

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

    const targetX = this.targetX
    const targetY = this.targetY
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

  /** Animate from current position to target (for shuffle) */
  animateInToTarget(delay: number, duration = 500): void {
    const fromX = this.container.x
    const fromY = this.container.y
    const targetX = this.targetX
    const targetY = this.targetY
    const startTime = Date.now() + delay

    const ticker = PIXI.Ticker.shared
    const tick = () => {
      if (this._destroyed) { ticker.remove(tick); return }
      const now = Date.now()
      if (now < startTime) return
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const t = 1 - Math.pow(1 - progress, 2)
      this.container.x = fromX + (targetX - fromX) * t
      this.container.y = fromY + (targetY - fromY) * t
      if (progress >= 1) {
        this.container.x = targetX
        this.container.y = targetY
        ticker.remove(tick)
      }
    }
    ticker.add(tick)
  }

  /** Skip animation — snap to target position */
  snapToTarget(): void {
    this.container.x = this.targetX
    this.container.y = this.targetY
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

  /** Redraw card face (used for event card flip reveal mid-animation) */
  redrawFace(): void {
    this.container.removeChildren()
    this._draw()
  }

  private _draw(): void {
    const card = this._card
    const w = this._cardWidth
    const h = this._cardHeight
    const covered = this._isCovered

    const colorStr = getCardColor(card)
    const colorInt = hexToInt(colorStr)

    // ── Card body ──
    if (covered) {
      // Covered: dark overlay with subtle border
      const overlay = new PIXI.Graphics()
      overlay.beginFill(0x111820, 0.82)
      overlay.drawRoundedRect(0, 0, w, h, 8)
      overlay.endFill()
      this.container.addChild(overlay)
      const border = new PIXI.Graphics()
      border.lineStyle(1.5, 0x667788, 0.5)
      border.drawRoundedRect(1, 1, w - 2, h - 2, 6)
      this.container.addChild(border)
    } else {
      // Uncovered: subtle fill + bold border for contrast against bright bg
      const bg = new PIXI.Graphics()
      bg.beginFill(0x000000, 0.12)
      bg.drawRoundedRect(2, 2, w - 4, h - 4, 6)
      bg.endFill()
      this.container.addChild(bg)
      const border = new PIXI.Graphics()
      border.lineStyle(2.5, colorInt, 0.75)
      border.drawRoundedRect(1, 1, w - 2, h - 2, 6)
      this.container.addChild(border)
    }

    // Card image from texture atlas, with emoji fallback
    const img = createCardImage(card.cardId, card.icon,
      card.type === 'event', card.isRevealed, w, h, covered)
    img.x = w / 2; img.y = h / 2
    this.container.addChild(img)
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
