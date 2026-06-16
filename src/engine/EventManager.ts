interface HitArea {
  x: number
  y: number
  w: number
  h: number
  callback: () => void
  layer: number
}

export class EventManager {
  private _canvas: any
  private _hitAreas: HitArea[] = []
  private _boundOnTouch: (e: any) => void

  constructor(canvas: any) {
    this._canvas = canvas
    this._boundOnTouch = this._onTouch.bind(this)
  }

  start(): void {
    wx.onTouchStart(this._boundOnTouch)
  }

  stop(): void {
    wx.offTouchStart(this._boundOnTouch)
  }

  registerHitArea(rect: { x: number; y: number; w: number; h: number }, callback: () => void, layer = 0): void {
    this._hitAreas.push({
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h,
      callback,
      layer,
    })
  }

  clearHitAreas(): void {
    this._hitAreas.length = 0
  }

  private _onTouch(e: any): void {
    if (!e.touches || e.touches.length === 0) return

    const touch = e.touches[0]
    const pos = { x: touch.x || touch.clientX || 0, y: touch.y || touch.clientY || 0 }

    const sorted = this._hitAreas.slice().sort((a, b) => b.layer - a.layer)

    for (let i = 0; i < sorted.length; i++) {
      if (this._contains(pos, sorted[i])) {
        sorted[i].callback()
        return
      }
    }
  }

  private _contains(pos: { x: number; y: number }, area: HitArea): boolean {
    return pos.x >= area.x &&
           pos.x <= area.x + area.w &&
           pos.y >= area.y &&
           pos.y <= area.y + area.h
  }
}
