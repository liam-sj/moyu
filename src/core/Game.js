// src/core/Game.js

import SceneManager from './SceneManager';
import EventManager from './EventManager';
import MenuScene from '../scenes/MenuScene';
import { log } from '../utils/Logger';

var TAG = 'Game';

export default class Game {
  constructor() {
    var sysInfo = wx.getSystemInfoSync();
    this.width = sysInfo.windowWidth;
    this.height = sysInfo.windowHeight;

    this.app = new PIXI.Application({
      view: globalThis.__pixi_main_canvas || wx.createCanvas(),
      width: this.width,
      height: this.height,
      backgroundColor: 0x2C3E50,
      backgroundAlpha: 1,
      antialias: false,
      resolution: 1,
      autoDensity: false,
      forceCanvas: true
    });

    this.canvas = this.app.view;
    this.eventManager = new EventManager(this.canvas);
    this.sceneManager = new SceneManager(this.app.stage, this.eventManager);
    this.eventManager.start();
  }

  start() {
    var self = this;
    this.app.ticker.add(function (delta) {
      var dt = delta * (1000 / 60);
      self._frame(dt);
    });

    log(TAG, 'Game started, going to menu');
    this.sceneManager.switchTo(MenuScene, {
      onStartGame: function (levelId) { self._switchToGame(levelId); }
    });
  }

  _frame(dt) {
    this.eventManager.clearHitAreas();
    this.sceneManager.update(dt);
    this.sceneManager.render();
    this.app.renderer.render(this.app.stage);
  }

  _switchToGame(levelId) {
    var GameScene = require('../scenes/GameScene').default;
    var self = this;
    this.sceneManager.switchTo(GameScene, {
      levelId: levelId || 'level1',
      onBackToMenu: function () {
        self.sceneManager.switchTo(MenuScene, {
          onStartGame: function (id) { self._switchToGame(id); }
        });
      },
      onGameOver: function (result) { self._switchToResult(result); }
    });
  }

  _switchToResult(result) {
    var ResultScene = require('../scenes/ResultScene').default;
    var self = this;
    this.sceneManager.switchTo(ResultScene, {
      result: result,
      onBackToMenu: function () {
        self.sceneManager.switchTo(MenuScene, {
          onStartGame: function (id) { self._switchToGame(id); }
        });
      },
      onReplay: function () { self._switchToGame(result.levelId || 'level1'); }
    });
  }
}
