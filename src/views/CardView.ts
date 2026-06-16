import * as PIXI from 'pixi.js-legacy'
import type { BoardCard } from '../core/types'
import { getCardColor } from '../core/Card'

function hexToInt(hex: string): number {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result) {
    return (parseInt(result[1], 16) << 16) | (parseInt(result[2], 16) << 8) | parseInt(result[3], 16)
  }
  return 0xFF8C42
}

export class CardView {
  readonly container = new PIXI.Container()
  readonly uid: string

  constructor(
    card: BoardCard,
    cardWidth: number,
    cardHeight: number,
    layerOffsetX: number,
    layerOffsetY: number,
    gap: number,
    offsetX: number,
    offsetY: number
  ) {
    this.uid = card.uid

    const x = offsetX + card.col * (cardWidth + gap) + card.layer * layerOffsetX
    const y = offsetY + card.row * (cardHeight + gap) - card.layer * layerOffsetY
    this.container.x = x
    this.container.y = y

    this._draw(card, cardWidth, cardHeight)
  }

  private _draw(card: BoardCard, w: number, h: number): void {
    const colorStr = getCardColor(card)
    const colorInt = hexToInt(colorStr)

    const bg = new PIXI.Graphics()
    if (card.isCovered) {
      bg.beginFill(0xBDC3C7)
    } else {
      bg.beginFill(0xFFFFFF)
    }
    bg.drawRoundedRect(0, 0, w, h, 6)
    bg.endFill()
    bg.lineStyle(1.5, colorInt, card.isCovered ? 0.3 : 0.8)
    bg.drawRoundedRect(0, 0, w, h, 6)
    this.container.addChild(bg)

    if (card.isCovered) {
      const mask = new PIXI.Graphics()
      mask.beginFill(0x000000, 0.3)
      mask.drawRoundedRect(0, 0, w, h, 6)
      mask.endFill()
      this.container.addChild(mask)
    }

    const displayIcon = (card.type === 'event' && !card.isRevealed) ? '❓' : card.icon
    const iconText = new PIXI.Text(displayIcon, {
      fontFamily: 'sans-serif', fontSize: 28, align: 'center',
    } as any)
    iconText.anchor.set(0.5)
    iconText.x = w / 2
    iconText.y = h * 0.35
    this.container.addChild(iconText)

    const displayName = (card.type === 'event' && !card.isRevealed) ? '事件' : card.name
    const nameText = new PIXI.Text(displayName, {
      fontFamily: 'sans-serif', fontSize: 13,
      fill: card.isCovered ? '#999999' : '#333333', align: 'center',
    } as any)
    nameText.anchor.set(0.5)
    nameText.x = w / 2
    nameText.y = h * 0.7
    this.container.addChild(nameText)

    const bar = new PIXI.Graphics()
    bar.beginFill(colorInt, card.isCovered ? 0.4 : 0.9)
    bar.drawRect(4, h - 6, w - 8, 4)
    bar.endFill()
    this.container.addChild(bar)
  }

  destroy(): void {
    this.container.destroy({ children: true })
  }
}
