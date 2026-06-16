import { installPolyfills, getMainCanvas } from './platform/PixiAdapter'
installPolyfills()

import * as PIXI from 'pixi.js-legacy'

// ── PixiJS 微信补丁 ──
PIXI.settings.FAIL_IF_MAJOR_PERFORMANCE_CAVEAT = false
try {
  if ((PIXI as any).Renderer?.prototype) {
    (PIXI as any).Renderer.prototype._unsafeEvalCheck = function _noop() {}
  }
  if ((PIXI as any).CanvasRenderer?.prototype) {
    (PIXI as any).CanvasRenderer.prototype._unsafeEvalCheck = function _noop() {}
  }
} catch (e) {}

// ── 创建 PIXI Application ──
const sysInfo = wx.getSystemInfoSync()

const app = new PIXI.Application({
  view: getMainCanvas(),
  width: sysInfo.windowWidth,
  height: sysInfo.windowHeight,
  backgroundColor: 0x2C3E50,
  backgroundAlpha: 1,
  antialias: false,
  resolution: 1,
  autoDensity: false,
  forceCanvas: true,
})

// ── 场景管理 ──
import { SceneManager } from './engine/SceneManager'
import { MenuScene } from './scenes/MenuScene'

const manager = new SceneManager(app.stage)

app.ticker.add(() => {
  manager.eventManager.clearHitAreas()
  manager.update(app.ticker.deltaMS / (1000 / 60))
  app.renderer.render(app.stage)
})

manager.push(new MenuScene())
