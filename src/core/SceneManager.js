export default class SceneManager {
  constructor(stage, eventManager) {
    this._stage = stage;
    this._eventManager = eventManager;
    this._currentScene = null;
    this._nextScene = null;
    this._nextParams = null;
  }

  get currentScene() {
    return this._currentScene;
  }

  switchTo(SceneClass, params = {}) {
    this._nextScene = new SceneClass(this._stage);
    this._nextParams = params;
  }

  update(dt) {
    this._applyPendingSwitch();
    if (this._currentScene) {
      this._currentScene.update(dt);
    }
  }

  render() {
    if (this._currentScene) {
      this._stage.removeChildren();
      this._currentScene.render(this._stage);
    }
  }

  _applyPendingSwitch() {
    if (!this._nextScene) return;

    if (this._currentScene) {
      this._currentScene.onExit();
    }

    this._eventManager.clearHitAreas();

    this._currentScene = this._nextScene;
    this._currentScene._sceneManager = this;
    this._currentScene._eventManager = this._eventManager;
    this._currentScene.onEnter(this._nextParams);

    this._nextScene = null;
    this._nextParams = null;
  }
}
