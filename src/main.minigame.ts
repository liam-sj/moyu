// ★ polyfill 必须在最前面
import { installPolyfills, getMainCanvas } from './platform/PixiAdapter'
installPolyfills()

import * as PIXI from 'pixi.js-legacy'
// ★ 必须加载 unsafe-eval 补丁，替换 ShaderSystem.syncUniforms（微信禁用 new Function）
import '../libs/pixi-unsafe-eval-v7'

// 安全 eval 补丁
PIXI.settings.FAIL_IF_MAJOR_PERFORMANCE_CAVEAT = false
try {
  if ((PIXI as any).Renderer?.prototype) {
    (PIXI as any).Renderer.prototype._unsafeEvalCheck = function _noop() {}
  }
  if ((PIXI as any).CanvasRenderer?.prototype) {
    (PIXI as any).CanvasRenderer.prototype._unsafeEvalCheck = function _noop() {}
  }
} catch (e) {}
try {
  var _PIXI = PIXI as any
  _PIXI.unsafeEvalSupported = function () { return true }
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
