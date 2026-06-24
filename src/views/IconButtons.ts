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
    const canvas = wx.createCanvas()
    canvas.width = img.width; canvas.height = img.height
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    ctx.drawImage(img, 0, 0)
    _btnBaseTex = PIXI.BaseTexture.from(canvas)
    if (_onReady) { _onReady(); _onReady = null }
  }
  img.onerror = () => { console.warn('Button icons load failed') }
  img.src = 'assets/btn/iconbtns.png'
}

/** Icon indices: 0=undo, 1=shuffle, 2=skill, 3=settings */
export function getBtnIcon(index: number): PIXI.Texture | null {
  if (!_btnBaseTex) return null
  const cols = 4
  const cw = Math.floor(_btnBaseTex.width / cols)
  const ch = _btnBaseTex.height
  const x = index * cw
  return new PIXI.Texture(_btnBaseTex, new PIXI.Rectangle(x, 0, cw, ch))
}

/** Create a sprite button from the icon sheet */
export function createIconButton(index: number, x: number, y: number, size: number): PIXI.Container {
  const ctn = new PIXI.Container()
  ctn.x = x; ctn.y = y
  const tex = getBtnIcon(index)
  if (tex) {
    const sprite = new PIXI.Sprite(tex)
    sprite.width = size; sprite.height = size
    sprite.x = 0; sprite.y = 0
    ctn.addChild(sprite)
  }
  return ctn
}
