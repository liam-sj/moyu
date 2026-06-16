import * as PIXI from 'pixi.js-legacy'

/**
 * 创建设备自适应的 PixiJS Application。
 * 使用微信窗口的实际尺寸，保证全屏无变形。
 */
export function createApp(canvas?: HTMLCanvasElement): PIXI.Application {
  const sysInfo = wx.getSystemInfoSync()
  return new PIXI.Application({
    view: canvas || undefined,
    width: sysInfo.windowWidth,
    height: sysInfo.windowHeight,
    backgroundColor: 0x2C3E50,
    backgroundAlpha: 1,
    antialias: false,
    resolution: 1,
    autoDensity: false,
    forceCanvas: true,
  })
}

/** 获取微信窗口尺寸（供场景布局使用） */
export function getScreenSize(): { width: number; height: number } {
  const sysInfo = wx.getSystemInfoSync()
  return { width: sysInfo.windowWidth, height: sysInfo.windowHeight }
}
