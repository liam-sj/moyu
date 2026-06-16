import * as PIXI from 'pixi.js-legacy'

export const GAME_WIDTH = 750
export const GAME_HEIGHT = 1334

export function createApp(canvas?: HTMLCanvasElement): PIXI.Application {
  return new PIXI.Application({
    view: canvas || undefined,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: 0x2C3E50,
    backgroundAlpha: 1,
    antialias: false,
    resolution: 1,
    autoDensity: false,
    forceCanvas: true,
  })
}
