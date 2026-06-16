// ★ polyfill 必须在最前面
import { installPolyfills, getMainCanvas } from './platform/PixiAdapter'
installPolyfills()

import * as PIXI from 'pixi.js-legacy'

// 安全 eval 补丁 — 必须在 PIXI.Application 创建之前
// pixi.js-legacy 在微信环境会调用 _unsafeEvalCheck 抛异常
PIXI.settings.FAIL_IF_MAJOR_PERFORMANCE_CAVEAT = false
try {
  if ((PIXI as any).Renderer?.prototype) {
    (PIXI as any).Renderer.prototype._unsafeEvalCheck = function _noop() {}
  }
  if ((PIXI as any).CanvasRenderer?.prototype) {
    (PIXI as any).CanvasRenderer.prototype._unsafeEvalCheck = function _noop() {}
  }
} catch (e) {}
// 模拟 unsafeEvalSupported（pixi.js-legacy npm 版可能缺失此方法）
try {
  var _P = PIXI as any
  if (typeof _P.unsafeEvalSupported !== 'function') {
    _P.unsafeEvalSupported = function () { return true }
  }
} catch (e) {}

import { createApp } from './bootstrap'
import { SceneManager } from './engine/SceneManager'
import { MenuScene } from './scenes/MenuScene'

const canvas = getMainCanvas()
const app = createApp(canvas)

const manager = new SceneManager(app.stage)

// 帧循环
app.ticker.add(() => {
  manager.eventManager.clearHitAreas()
  manager.update(app.ticker.deltaMS / (1000 / 60))
})

// 启动
manager.push(new MenuScene())
