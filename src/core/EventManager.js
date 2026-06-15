export default class EventManager {
  constructor(canvas) {
    this._canvas = canvas;
    this._hitAreas = [];
    this._boundOnTouch = this._onTouch.bind(this);
  }

  start() {
    wx.onTouchStart(this._boundOnTouch);
  }

  stop() {
    wx.offTouchStart(this._boundOnTouch);
  }

  registerHitArea(rect, callback, layer = 0) {
    this._hitAreas.push({
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h,
      callback,
      layer
    });
  }

  clearHitAreas() {
    this._hitAreas.length = 0;
  }

  _onTouch(e) {
    if (!e.touches || e.touches.length === 0) return;

    var touch = e.touches[0];
    var pos = { x: touch.x || touch.clientX || 0, y: touch.y || touch.clientY || 0 };

    var sorted = this._hitAreas.slice().sort(function (a, b) { return b.layer - a.layer; });

    for (var i = 0; i < sorted.length; i++) {
      if (this._contains(pos, sorted[i])) {
        sorted[i].callback(pos);
        return;
      }
    }
  }

  _contains(pos, area) {
    return pos.x >= area.x &&
           pos.x <= area.x + area.w &&
           pos.y >= area.y &&
           pos.y <= area.y + area.h;
  }
}
