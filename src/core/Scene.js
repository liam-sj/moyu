export default class Scene {
  constructor(stage) {
    this.stage = stage;
    this.active = false;
  }

  onEnter(params) {}

  update(dt) {}

  render(container) {}

  onExit() {}

  handleTouch(pos, type) {}

  registerHitArea(rect, callback, layer) {
    if (this._eventManager) {
      this._eventManager.registerHitArea(rect, callback, layer);
    }
  }
}
