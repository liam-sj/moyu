import * as PIXI from 'pixi.js-legacy'

/** 用微信窗口实际尺寸创建 PixiJS Application */
export function createApp(canvas?: HTMLCanvasElement): PIXI.Application {
  // 优先从 canvas 获取尺寸，fallback 到系统信息
  let width = 750
  let height = 1334
  try {
    const sysInfo = wx.getSystemInfoSync()
    width = sysInfo.windowWidth || 750
    height = sysInfo.windowHeight || 1334
  } catch (e) {
    // 浏览器环境 fallback
    width = 750
    height = 1334
  }

  return new PIXI.Application({
    view: canvas || undefined,
    width,
    height,
    backgroundColor: 0x2C3E50,
    backgroundAlpha: 1,
    antialias: false,
    resolution: 1,
    autoDensity: false,
    forceCanvas: true,
  })
}
