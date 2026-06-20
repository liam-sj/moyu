import * as PIXI from 'pixi.js-legacy'
import { FishView } from './FishView'
import type { PondConfig } from '../config/ponds'

export class PondView {
  readonly container = new PIXI.Container()
  private _fish: FishView[] = []
  private _bounds: { x: number; y: number; w: number; h: number }

  constructor(pond: PondConfig, rank: number, x: number, y: number, w: number, h: number) {
    this._bounds = { x: 8, y: 18, w: w - 20, h: h - 38 }
    this.container.x = x
    this.container.y = y

    // Pond background
    const bg = new PIXI.Graphics()
    bg.beginFill(pond.colorInt, 0.20)
    bg.drawRoundedRect(0, 0, w, h, 10)
    bg.endFill()
    bg.lineStyle(1.5, pond.colorInt, 0.4)
    bg.drawRoundedRect(0, 0, w, h, 10)
    this.container.addChild(bg)

    // Clip mask so fish can't render outside pond
    const mask = new PIXI.Graphics()
    mask.beginFill(0xFFFFFF)
    mask.drawRoundedRect(0, 0, w, h, 10)
    mask.endFill()
    this.container.addChild(mask)
    this.container.mask = mask

    // Rank badge
    const medals = ['🥇', '🥈', '🥉']
    const rankStr = rank < 3 ? medals[rank] : `${rank + 1}`
    const rankTxt = new PIXI.Text(rankStr, {
      fontFamily: 'sans-serif', fontSize: 12, fontWeight: 'bold',
      fill: rank < 3 ? '#F1C40F' : '#FFFFFF',
    } as any)
    rankTxt.x = 4; rankTxt.y = 3
    this.container.addChild(rankTxt)

    // Pond name
    const nameTxt = new PIXI.Text(`${pond.emoji} ${pond.name}`, {
      fontFamily: 'sans-serif', fontSize: 10, fontWeight: 'bold', fill: '#FFFFFF',
    } as any)
    nameTxt.x = 28; nameTxt.y = 4
    this.container.addChild(nameTxt)

    // Fish count badge
    const badgeTxt = new PIXI.Text('···', {
      fontFamily: 'sans-serif', fontSize: 9, fill: '#7FB3D8',
    } as any)
    badgeTxt.anchor.set(1, 0); badgeTxt.x = w - 6; badgeTxt.y = 5
    this.container.addChild(badgeTxt)
    ;(this as any)._badgeTxt = badgeTxt
  }

  /** Spawn fish with given count */
  spawnFish(count: number): void {
    this.clearFish()
    const max = Math.min(count, 20)
    const emojis = ['🐟', '🐠', '🐡', '🦐']
    for (let i = 0; i < max; i++) {
      const emoji = emojis[i % emojis.length]
      const f = new FishView(emoji,
        this._bounds.x + 10 + Math.random() * (this._bounds.w - 24),
        this._bounds.y + 4 + Math.random() * (this._bounds.h - 14),
        18 + Math.random() * 12
      )
      this._fish.push(f)
      this.container.addChild(f.sprite)
    }
  }

  clearFish(): void {
    for (const f of this._fish) f.destroy()
    this._fish = []
  }

  updateFish(dt: number): void {
    for (const f of this._fish) f.update(dt, this._bounds)
  }

  setBadge(text: string): void {
    const b = (this as any)._badgeTxt as PIXI.Text
    if (b) b.text = text
  }

  destroy(): void {
    this.clearFish()
    this.container.destroy({ children: true })
  }
}
