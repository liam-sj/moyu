import * as PIXI from 'pixi.js-legacy'

/** Shared base texture for the button icon sprite sheet */
let _btnBaseTex: PIXI.BaseTexture | null = null
let _onReady: (() => void) | null = null

export function onBtnIconsReady(cb: () => void): void {
  if (_btnBaseTex) { cb(); return }
  _onReady = cb
}

export function loadBtnIcons(): void {
  if (typeof wx === 'undefined') return
  const img = wx.createImage()
  img.onload = () => {
    console.log('[IconButtons] img loaded:', img.width, 'x', img.height)
    const canvas = wx.createCanvas()
    canvas.width = img.width; canvas.height = img.height
    console.log('[IconButtons] canvas:', canvas.width, 'x', canvas.height)
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    if (ctx.imageSmoothingQuality) (ctx as any).imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0)
    _btnBaseTex = PIXI.BaseTexture.from(canvas)
    console.log('[IconButtons] tex:', _btnBaseTex.width, 'x', _btnBaseTex.height)
    // Log first icon crop
    const t = getBtnIcon(0)
    if (t) console.log('[IconButtons] icon0 frame:', t.frame.x, t.frame.y, t.frame.width, t.frame.height)
    if (_onReady) { _onReady(); _onReady = null }
  }
  img.onerror = (e: any) => { console.warn('Button icons load failed', e) }
  img.src = 'assets/btn/iconbtns.png'
}

/**
 * Icon indices: 0=undo, 1=shuffle, 2=skill, 3=settings
 * Image: 400×215, 4 icons at ~79×79 in a row, centered.
 */
const ICON_SIZE = 79
const ICON_LEFT = 42
const ICON_TOP = 68

export function getBtnIcon(index: number): PIXI.Texture | null {
  if (!_btnBaseTex) return null
  const x = ICON_LEFT + index * ICON_SIZE
  return new PIXI.Texture(_btnBaseTex, new PIXI.Rectangle(x, ICON_TOP, ICON_SIZE, ICON_SIZE))
}

/** Create an icon button with shadow. If atlas not loaded yet, retries when ready. */
export function createIconButton(index: number, bx: number, by: number, bw: number, bh: number): PIXI.Container {
  const ctn = new PIXI.Container()
  ctn.x = bx; ctn.y = by
  // Shadow
  const shadow = new PIXI.Graphics()
  shadow.beginFill(0x000000, 0.15)
  shadow.drawRoundedRect(2, 2, bw, bh, 10)
  shadow.endFill()
  ctn.addChild(shadow)
  // Icon (may be delayed if atlas not loaded yet)
  const addSprite = () => {
    const tex = getBtnIcon(index)
    if (tex) {
      const sprite = new PIXI.Sprite(tex)
      sprite.width = bw; sprite.height = bh
      ctn.addChild(sprite)
    }
  }
  if (_btnBaseTex) {
    addSprite()
  } else {
    const prev = _onReady
    _onReady = () => { addSprite(); if (prev) prev() }
  }
  return ctn
}
