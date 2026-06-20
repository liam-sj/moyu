import { installPolyfills, getMainCanvas } from './platform/PixiAdapter'
installPolyfills()

import * as PIXI from 'pixi.js-legacy'

// ── PixiJS 微信补丁 ──
PIXI.settings.FAIL_IF_MAJOR_PERFORMANCE_CAVEAT = false
PIXI.BaseTexture.defaultOptions.scaleMode = PIXI.SCALE_MODES.LINEAR  // smooth texture scaling
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
  backgroundColor: 0x000000,
  backgroundAlpha: 0,
  antialias: true,
  resolution: 1,
  autoDensity: false,
  forceCanvas: true,
})

// ── 加载卡片合图纹理 ──
import { loadCardAtlas } from './views/CardView'
loadCardAtlas()

// ── 场景管理 ──
import { SceneManager } from './engine/SceneManager'
import { MenuScene } from './scenes/MenuScene'

const manager = new SceneManager(app.stage)

app.ticker.add(() => {
  manager.eventManager.clearHitAreas()
  manager.update(app.ticker.deltaMS / (1000 / 60))
  app.renderer.render(app.stage)
})

// ── 云开发初始化（延迟到 app 创建后，避免阻塞启动）──
try {
  if (typeof wx !== 'undefined' && wx.cloud) {
    wx.cloud.init({ env: 'cloud1-d5gtuwnx0aacd8adb' })
  }
} catch (e) { console.warn('[cloud] init failed', e) }

manager.push(new MenuScene())
