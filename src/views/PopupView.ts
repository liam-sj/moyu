import * as PIXI from 'pixi.js-legacy'

export interface PopupOptions {
  title?: string
  width?: number
  closable?: boolean
  onClose?: () => void
  backdropAlpha?: number
  closeOnBackdrop?: boolean
}

/**
 * Unified frosted-glass popup shell.
 * - Creates backdrop + card + optional title + close button.
 * - Exposes `content` container positioned at card's content area (local coords).
 * - Caller builds everything inside `content` at local coordinates.
 * - Use `addHitArea(x, y, w, h, cb)` with local coords for touch.
 */
export class PopupView {
  readonly container = new PIXI.Container()
  /** Build your content here using local coordinates (0,0 = top-left of card content area) */
  readonly content = new PIXI.Container()
  readonly cardX: number
  readonly cardY: number
  readonly cardW: number
  readonly cardH: number
  /** Offset from card top to content area top */
  readonly contentTop: number

  private _onClose?: () => void
  hitAreas: Array<{ rect: { x: number; y: number; w: number; h: number }; cb: () => void }> = []

  constructor(screenW: number, screenH: number, cardH: number, opts: PopupOptions = {}) {
    const w = screenW; const h = screenH
    const cardW = opts.width || (w - 48)
    const cardX = Math.floor((w - cardW) / 2)
    const cardY = Math.floor(h * 0.08)
    this.cardW = cardW; this.cardH = cardH
    this.cardX = cardX; this.cardY = cardY
    this._onClose = opts.onClose
    this.contentTop = opts.title ? 44 : 10

    // Dim backdrop
    const dim = new PIXI.Graphics()
    dim.beginFill(0x000000, opts.backdropAlpha ?? 0.35)
    dim.drawRect(0, 0, w, h)
    dim.endFill()
    this.container.addChild(dim)

    // Tap outside card → close (4 regions: top, bottom, left of card, right of card)
    if (opts.closeOnBackdrop !== false) {
      // Top strip
      if (cardY > 0) this.hitAreas.push({ rect: { x: 0, y: 0, w, h: cardY }, cb: () => this.close() })
      // Bottom strip
      const cardBottom = cardY + cardH
      if (cardBottom < h) this.hitAreas.push({ rect: { x: 0, y: cardBottom, w, h: h - cardBottom }, cb: () => this.close() })
      // Left strip
      if (cardX > 0) this.hitAreas.push({ rect: { x: 0, y: cardY, w: cardX, h: cardH }, cb: () => this.close() })
      // Right strip
      const cardRight = cardX + cardW
      if (cardRight < w) this.hitAreas.push({ rect: { x: cardRight, y: cardY, w: w - cardRight, h: cardH }, cb: () => this.close() })
    }

    // Frosted card
    const card = new PIXI.Graphics()
    card.beginFill(0x1A2A3A, 0.85)
    card.drawRoundedRect(cardX, cardY, cardW, cardH, 16)
    card.endFill()
    card.lineStyle(1.5, 0xFFFFFF, 0.15)
    card.drawRoundedRect(cardX + 0.5, cardY + 0.5, cardW - 1, cardH - 1, 16)
    this.container.addChild(card)

    // Title
    if (opts.title) {
      const titleTxt = new PIXI.Text(opts.title, {
        fontFamily: 'sans-serif', fontSize: 18, fontWeight: 'bold', fill: '#FFFFFF',
      } as any)
      titleTxt.anchor.set(0.5)
      titleTxt.x = cardX + cardW / 2
      titleTxt.y = cardY + 22
      this.container.addChild(titleTxt)
    }

    // Close button
    if (opts.closable !== false) {
      const cx = cardX + cardW - 30; const cy = cardY + 8
      const cb = new PIXI.Text('✕', { fontFamily: 'sans-serif', fontSize: 16, fill: '#8899AA' } as any)
      cb.x = cx; cb.y = cy
      this.container.addChild(cb)
      this.hitAreas.push({ rect: { x: cx - 6, y: cy - 4, w: 28, h: 28 }, cb: () => this.close() })
    }

    // Content container — local coordinates, inside card content area
    this.content.x = cardX + 16
    this.content.y = cardY + this.contentTop
    this.container.addChild(this.content)
  }

  /** Register a hit area using local content coordinates */
  addHitArea(x: number, y: number, w: number, h: number, cb: () => void): void {
    this.hitAreas.push({
      rect: { x: this.content.x + x, y: this.content.y + y, w, h },
      cb
    })
  }

  close(): void {
    if (this._onClose) this._onClose()
    this.container.destroy({ children: true })
    this.hitAreas = []
  }
}
