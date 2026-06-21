import * as PIXI from 'pixi.js-legacy'

function hexToInt(hex: string): number {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result) {
    return (parseInt(result[1], 16) << 16) | (parseInt(result[2], 16) << 8) | parseInt(result[3], 16)
  }
  return 0xFF8C42
}

export interface ButtonOptions {
  bgColor?: string
  textColor?: string
  fontSize?: number
  radius?: number
  onClick?: (() => void) | null
  shadow?: boolean
  /** Frosted glass style for level UI; default false = solid */
  frosted?: boolean
}

export class Button {
  readonly container = new PIXI.Container()
  readonly hitArea: { x: number; y: number; w: number; h: number }
  onClick: (() => void) | null

  private _bg: PIXI.Graphics
  private _highlight: PIXI.Graphics
  private _label: PIXI.Text
  private _x: number; private _y: number; private _w: number; private _h: number
  private _bgColor: string; private _textColor: string; private _fontSize: number
  private _radius: number; private _shadow: boolean; private _frosted: boolean

  constructor(x: number, y: number, w: number, h: number, text: string, options: ButtonOptions = {}) {
    this._x = x; this._y = y; this._w = w; this._h = h
    this._bgColor = options.bgColor || '#FF8C42'
    this._textColor = options.textColor || '#FFFFFF'
    this._fontSize = options.fontSize || 16
    this._radius = options.radius !== undefined ? options.radius : 8
    this.onClick = options.onClick || null
    this._shadow = options.shadow !== undefined ? options.shadow : true
    this._frosted = options.frosted || false

    this.hitArea = { x, y, w, h }

    this._bg = new PIXI.Graphics()
    this._highlight = new PIXI.Graphics()
    this._label = new PIXI.Text(text, {
      fontFamily: 'sans-serif',
      fontSize: this._fontSize,
      fontWeight: 'bold',
      fill: this._textColor,
      align: 'center',
    } as any)
    this._label.anchor.set(0.5)
    this._label.x = x + w / 2
    this._label.y = y + h / 2

    this.container.addChild(this._bg)
    this.container.addChild(this._highlight)
    this.container.addChild(this._label)
    this._redraw()
  }

  private _redraw(): void {
    const g = this._bg
    const { _x: x, _y: y, _w: w, _h: h, _radius: r } = this
    g.clear()

    if (this._frosted) {
      // ── Frosted glass ──
      g.beginFill(hexToInt(this._bgColor), 0.45)
      g.drawRoundedRect(x, y, w, h, r)
      g.endFill()
      g.lineStyle(1.5, 0xFFFFFF, 0.25)
      g.drawRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, r)

      const hl = this._highlight
      hl.clear()
      hl.beginFill(0xFFFFFF, 0.15)
      hl.drawRoundedRect(x + 2, y + 1, w - 4, Math.floor(h * 0.4), r - 2)
      hl.endFill()
    } else {
      // ── Solid (original style) ──
      if (this._shadow) {
        g.beginFill(0x000000, 0.15)
        g.drawRect(x + 2, y + 2, w, h)
        g.endFill()
      }

      g.beginFill(hexToInt(this._bgColor))
      g.drawRect(x, y, w, h)
      g.endFill()

      g.beginFill(0x000000, 0.18)
      g.drawRect(x, y + h - 2, w, 2)
      g.drawRect(x + w - 2, y, 2, h)
      g.endFill()

      const hl = this._highlight
      hl.clear()
      hl.beginFill(0xFFFFFF, 0.2)
      hl.drawRect(x + 1, y + 1, w - 2, 2)
      hl.drawRect(x + 1, y + 1, 2, h - 2)
      hl.endFill()
    }
  }

  setText(text: string): void {
    this._label.text = text
  }
}
