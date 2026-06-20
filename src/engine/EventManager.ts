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
    if (typeof wx !== 'undefined') {
      wx.offTouchStart(this._boundOnTouch)
    }
  }

  /**
   * 注册触摸命中区域。
   * 注意：hit area 会在每帧开始前由主循环通过 clearHitAreas() 统一清空，
   * 因此每个场景（或帧）都需要重新注册自己的区域。这是继承自原始 JS 代码的设计模式。
   */
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

  /** 每帧开始前由主循环清空 — hit area 的生命周期仅限当前帧，场景切换时无需额外清理 */
  clearHitAreas(): void {
    this._hitAreas.length = 0
  }

  /**
   * 按回调函数取消注册某个 hit area。
   * 安全用途：scene._teardown 时可通过此方法清理本 scene 注册的 hit area，
   * 但注意 Scene 基类使用了匿名回调，因此不会直接调用；
   * hit area 的清除依赖每帧开始前主循环调用的 clearHitAreas()。
   */
  unregisterByCallback(callback: () => void): void {
    this._hitAreas = this._hitAreas.filter(a => a.callback !== callback)
  }

  private _onTouch(e: any): void {
    if (!e.touches || e.touches.length === 0) return

    const touch = e.touches[0]
    const pos = { x: touch.x || touch.clientX || 0, y: touch.y || touch.clientY || 0 }

    const sorted = this._hitAreas.slice().sort((a, b) => b.layer - a.layer)

    for (let i = 0; i < sorted.length; i++) {
      if (this._contains(pos, sorted[i])) {
        try { sorted[i].callback() } catch (e) { console.warn('[EventManager] callback error', e) }
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
