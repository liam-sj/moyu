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
}
