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
    // Maintain aspect ratio, fit within the target area
    const scale = Math.min(maxW * 0.95 / tex.width, maxH * 0.92 / tex.height)
    sprite.width = tex.width * scale
    sprite.height = tex.height * scale
    sprite.x = -maxW * 0.01
    sprite.y = -maxH * 0.02
    if (covered) sprite.tint = 0x667788
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
    shadow.drawRoundedRect(shadowOffset, shadowOffset + shadowBlur * 0.5, w, h, 8)
    shadow.endFill()
    this.container.addChild(shadow)

    // Secondary lighter shadow for softer depth
    const shadow2 = new PIXI.Graphics()
    shadow2.beginFill(0x000000, shadowAlpha * 0.5)
    shadow2.drawRoundedRect(shadowOffset + 1, shadowOffset + 1, w, h, 8)
    shadow2.endFill()
    this.container.addChild(shadow2)

    const colorStr = getCardColor(card)
    const colorInt = hexToInt(colorStr)

    // ── 3D card body ──
    if (covered) {
      // Covered: flat dark grey, no 3D pop
      const bg = new PIXI.Graphics()
      bg.beginFill(0xB0BCC8)
      bg.drawRoundedRect(0, 0, w, h, 8)
      bg.endFill()
      bg.lineStyle(1, 0x99A4B0, 0.8)
      bg.drawRoundedRect(0, 0, w, h, 8)
      this.container.addChild(bg)

      const overlay = new PIXI.Graphics()
      overlay.beginFill(0x1A252F, 0.32)
      overlay.drawRoundedRect(0, 0, w, h, 8)
      overlay.endFill()
      this.container.addChild(overlay)
    } else {
      // Uncovered: 3D raised look with highlights
      // Main body
      const body = new PIXI.Graphics()
      body.beginFill(0xFFFFFF)
      body.drawRoundedRect(0, 0, w, h, 8)
      body.endFill()
      // Left + top highlight (lighter)
      body.beginFill(0xFAFBFC, 0.6)
      body.drawRoundedRect(1, 1, w - 2, Math.floor(h * 0.55), 5)
      body.endFill()
      this.container.addChild(body)

      // Bottom edge shadow (darker strip for depth)
      const botShadow = new PIXI.Graphics()
      botShadow.beginFill(0xE0E4E8, 0.7)
      botShadow.drawRoundedRect(2, h - 6, w - 4, 4, 2)
      botShadow.endFill()
      this.container.addChild(botShadow)

      // Right edge shadow
      const rightShadow = new PIXI.Graphics()
      rightShadow.beginFill(0xE8ECF0, 0.5)
      rightShadow.drawRoundedRect(w - 4, 4, 3, h - 8, 2)
      rightShadow.endFill()
      this.container.addChild(rightShadow)

      // Subtle outer border
      const border = new PIXI.Graphics()
      border.lineStyle(1, colorInt, 0.25)
      border.drawRoundedRect(0.5, 0.5, w - 1, h - 1, 6)
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
