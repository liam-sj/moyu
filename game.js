// game.js — 摸鱼大师入口

import PixiAdapter from './src/wechat/PixiAdapter';

// 安装 DOM shim（必须在 PixiJS 之前）
PixiAdapter.install();

// 加载 PixiJS（作为全局 PIXI）
import './libs/pixi-legacy.min';
import './libs/pixi-unsafe-eval-v7';

// 优先 Canvas 渲染
PIXI.settings.FAIL_IF_MAJOR_PERFORMANCE_CAVEAT = false;

import Game from './src/core/Game';

var game = new Game();
game.start();
