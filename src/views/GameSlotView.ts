import * as PIXI from 'pixi.js-legacy'
import type { GameLogic } from '../core/GameLogic'
import { CardView, createCardImage } from './CardView'
import { getCardColor } from '../core/Card'
import { getLevelConfig } from '../config/levels'
import { getBtnIcon } from './IconButtons'

function hexToInt(hex: string): number {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result) {
    return (parseInt(result[1], 16) << 16) | (parseInt(result[2], 16) << 8) | parseInt(result[3], 16)
  }
  return 0x95A5A6
}

export class GameSlotView {
  container: PIXI.Container
  slotLayer: PIXI.Container
  hudLayer: PIXI.Container

  logic!: GameLogic
  screenW = 0; screenH = 0
  levelId = 'level1'

  // Skill button state
  skillBtnCharges = -1
  skillBtnContainer: PIXI.Container | null = null
  skillHitArea: { x: number; y: number; w: number; h: number } | null = null
  skillCallback: (() => void) | null = null

  // Cards currently flying to slot — skip rendering them in the bar
  flyingUids: Set<string> = new Set()

  // Settings button
  settingsHitArea: { x: number; y: number; w: number; h: number } | null = null
  settingsCallback: (() => void) | null = null

  constructor(container: PIXI.Container, slotLayer: PIXI.Container, hudLayer: PIXI.Container) {
    this.container = container
    this.slotLayer = slotLayer
    this.hudLayer = hudLayer
  }

  // ── Slot bar rendering ──

  renderSlotBar(): void {
    this.slotLayer.removeChildren()

    const bar = this.logic.slotBar
    const stepMgr = this.logic.stepManager
    const freeClicks = stepMgr.slotFreeClicks
    const padding = 10
    const barW = bar.maxSlots * bar.slotWidth + (bar.maxSlots - 1) * bar.gap + padding * 2
    const barH = bar.slotHeight + padding * 2
    const barX = bar.startX - padding
    const barY = bar.startY - padding

    // ── Flight mode extra slots ──
    const hasFlightCards = bar.flightSlots.some(s => s !== null)
    if (freeClicks > 0 || hasFlightCards) {
      const flightY = barY - bar.slotHeight - 10
      const flightW = barW
      const flightH = bar.slotHeight + 16

      const flightBg = new PIXI.Graphics()
      flightBg.beginFill(0x1A3040, 0.30)
      flightBg.drawRoundedRect(barX, flightY, flightW, flightH, 10)
      flightBg.endFill()
      flightBg.lineStyle(1, 0xFFFFFF, 0.15)
      flightBg.drawRoundedRect(barX + 0.5, flightY + 0.5, flightW - 1, flightH - 1, 10)
      this.slotLayer.addChild(flightBg)

      const flightLabel = new PIXI.Text('📵 飞行模式', {
        fontFamily: 'sans-serif', fontSize: 10, fill: '#3498DB', fontWeight: 'bold',
      } as any)
      flightLabel.x = barX + 8; flightLabel.y = flightY + 3
      this.slotLayer.addChild(flightLabel)

      const fSlotW = bar.slotWidth
      for (let f = 0; f < 3; f++) {
        const fx = bar.startX + f * (fSlotW + bar.gap)
        const fy = flightY + 18
        const fw = fSlotW
        const fh = bar.slotHeight * 0.75
        const flightCard = bar.flightSlots[f]

        const fs = new PIXI.Graphics()
        if (flightCard) {
          fs.beginFill(0xFFFFFF, 0.12)
          fs.drawRoundedRect(fx, fy, fw, fh, 6)
          fs.endFill()
          fs.lineStyle(1.5, 0x3498DB, 0.7)
          fs.drawRoundedRect(fx, fy, fw, fh, 6)
          this.slotLayer.addChild(fs)

          const img = createCardImage(flightCard.cardId, flightCard.icon,
            flightCard.type === 'event', flightCard.isRevealed, fw, fh)
          img.x = fx + fw / 2; img.y = fy + fh / 2
          this.slotLayer.addChild(img)
        } else {
          fs.beginFill(0xFFFFFF, 0.05)
          fs.drawRoundedRect(fx, fy, fw, fh, 6)
          fs.endFill()
          fs.lineStyle(1, 0xFFFFFF, 0.12)
          fs.drawRoundedRect(fx + 0.5, fy + 0.5, fw - 1, fh - 1, 6)
          this.slotLayer.addChild(fs)

          const fTxt = new PIXI.Text('✈️', {
            fontFamily: 'sans-serif', fontSize: 14, fill: '#3498DB',
          } as any)
          fTxt.anchor.set(0.5); fTxt.x = fx + fw / 2; fTxt.y = fy + fh / 2
          this.slotLayer.addChild(fTxt)
        }
      }
    }

    // ── Holding slots ──
    const hasHolding = bar.holdingSlots.some(s => s !== null)
    if (hasHolding) {
      const flightBarH = (freeClicks > 0 || hasFlightCards) ? bar.slotHeight * 0.75 + 30 : 0
      const holdY = bar.startY - bar.slotHeight - 16 - flightBarH
      const holdStartX = bar.startX

      for (let h = 0; h < 3; h++) {
        const hx = holdStartX + h * (bar.slotWidth + bar.gap)
        const hy = holdY
        const hw = bar.slotWidth
        const hCard = bar.holdingSlots[h]

        const hs = new PIXI.Graphics()
        if (hCard) {
          hs.beginFill(0xFFFFFF, 0.20)
          hs.drawRoundedRect(hx, hy, hw, bar.slotHeight, 6)
          hs.endFill()
          hs.lineStyle(1.5, 0xF1C40F, 0.6)
          hs.drawRoundedRect(hx, hy, hw, bar.slotHeight, 6)
          this.slotLayer.addChild(hs)

          const hImg = createCardImage(hCard.cardId, hCard.icon,
            hCard.type === 'event', hCard.isRevealed, hw, bar.slotHeight)
          hImg.x = hx + hw / 2; hImg.y = hy + bar.slotHeight / 2
          this.slotLayer.addChild(hImg)
        } else {
          hs.beginFill(0xFFFFFF, 0.06)
          hs.drawRoundedRect(hx, hy, hw, bar.slotHeight, 6)
          hs.endFill()
          hs.lineStyle(1, 0xFFFFFF, 0.10)
          hs.drawRoundedRect(hx + 0.5, hy + 0.5, hw - 1, bar.slotHeight - 1, 6)
          this.slotLayer.addChild(hs)
        }
      }
    }

    // ── Normal slot bar ──
    const barBg = new PIXI.Graphics()
    barBg.beginFill(0x1A3040, 0.35)
    barBg.drawRoundedRect(barX, barY, barW, barH, 10)
    barBg.endFill()
    barBg.lineStyle(1.5, 0xFFFFFF, 0.15)
    barBg.drawRoundedRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1, 10)
    this.slotLayer.addChild(barBg)

    for (let i = 0; i < bar.maxSlots; i++) {
      const slot = bar.slots[i]
      const x = bar.startX + i * (bar.slotWidth + bar.gap)
      const y = bar.startY
      const w = bar.slotWidth; const h = bar.slotHeight

      if (slot && !this.flyingUids.has(slot.uid)) {
        const colorStr = getCardColor(slot)
        const colorInt = hexToInt(colorStr)

        const bg = new PIXI.Graphics()
        bg.beginFill(0xFFFFFF, 0.22)
        bg.drawRoundedRect(x, y, w, h, 6)
        bg.endFill()
        bg.lineStyle(2, 0xF1C40F, 0.5)
        bg.drawRoundedRect(x, y, w, h, 6)
        this.slotLayer.addChild(bg)

        const slotImg = createCardImage(slot.cardId, slot.icon,
          slot.type === 'event', slot.isRevealed, w, h)
        slotImg.x = x + w / 2; slotImg.y = y + h / 2
        this.slotLayer.addChild(slotImg)
      } else {
        const empty = new PIXI.Graphics()
        empty.beginFill(0xFFFFFF, 0.06)
        empty.drawRoundedRect(x, y, w, h, 6)
        empty.endFill()
        empty.lineStyle(1, 0xFFFFFF, 0.12)
        empty.drawRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, 6)
        this.slotLayer.addChild(empty)

        const numTxt = new PIXI.Text(String(i + 1), {
          fontFamily: 'sans-serif', fontSize: Math.max(9, Math.floor(w * 0.2)),
          fill: '#3A4B5D', align: 'center',
        } as any)
        numTxt.anchor.set(0.5); numTxt.x = x + w / 2; numTxt.y = y + h / 2
        this.slotLayer.addChild(numTxt)
      }
    }

    // ── Bonus slot ──
    if (bar.bonusSlotCount > 0) {
      const x = bar.startX + (bar.maxSlots - 1) * (bar.slotWidth + bar.gap)
      const y = bar.startY - bar.slotHeight - 18
      const w = bar.slotWidth; const h = bar.slotHeight

      const bg = new PIXI.Graphics()
      if (bar.bonusSlot) {
        bg.beginFill(0xFFFFFF, 0.22)
        bg.drawRoundedRect(x, y, w, h, 6)
        bg.endFill()
        bg.lineStyle(2, 0x2ECC71, 0.7)
        bg.drawRoundedRect(x, y, w, h, 6)
        this.slotLayer.addChild(bg)

        const slotImg = createCardImage(bar.bonusSlot.cardId, bar.bonusSlot.icon,
          bar.bonusSlot.type === 'event', bar.bonusSlot.isRevealed, w, h)
        slotImg.x = x + w / 2; slotImg.y = y + h / 2
        this.slotLayer.addChild(slotImg)
      } else {
        bg.beginFill(0x1A3040, 0.30)
        bg.drawRoundedRect(x, y, w, h, 6)
        bg.endFill()
        bg.lineStyle(1.5, 0x2ECC71, 0.5)
        bg.drawRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, 6)
        this.slotLayer.addChild(bg)

        const plusTxt = new PIXI.Text('+', {
          fontFamily: 'sans-serif', fontSize: 20, fill: '#2ECC71', fontWeight: 'bold',
        } as any)
        plusTxt.anchor.set(0.5); plusTxt.x = x + w / 2; plusTxt.y = y + h / 2
        this.slotLayer.addChild(plusTxt)
      }
    }
  }

  // ── HUD ──

  renderHUD(): void {
    this.hudLayer.removeChildren()
    const bar = this.logic.stepManager
    const config = getLevelConfig(this.levelId)
    const w = this.screenW

    const levelTxt = new PIXI.Text(config.name, {
      fontFamily: 'sans-serif', fontSize: 13, fill: '#9B8B7A',
    } as any)
    levelTxt.x = 10; levelTxt.y = 14
    this.hudLayer.addChild(levelTxt)

    // Settings button (icon index 3)
    const sTex = getBtnIcon(3)
    if (sTex) {
      const sSprite = new PIXI.Sprite(sTex)
      const maxSize = 26
      const ratio = sTex.width / sTex.height
      if (ratio > 1) { sSprite.width = maxSize; sSprite.height = maxSize / ratio }
      else { sSprite.height = maxSize; sSprite.width = maxSize * ratio }
      sSprite.x = 6 + (28 - sSprite.width) / 2
      sSprite.y = 64 + (28 - sSprite.height) / 2
      this.hudLayer.addChild(sSprite)
    }
    this.settingsHitArea = { x: 4, y: 60, w: 34, h: 34 }

    // Happiness
    const happyTxt = new PIXI.Text('😊 ' + this.logic.happyValue, {
      fontFamily: 'sans-serif', fontSize: 14, fontWeight: 'bold', fill: '#F1C40F',
    } as any)
    happyTxt.anchor.set(1, 0); happyTxt.x = w - 10; happyTxt.y = 14
    this.hudLayer.addChild(happyTxt)

    // Refresh skill button — evenly spaced, same row as undo/shuffle
    const slotBarBtm = this.logic.slotBar.startY + this.logic.slotBar.slotHeight
    const iconSize = 50
    const totalIconW = iconSize * 3
    const gap = Math.floor((this.screenW - totalIconW) / 4)
    const sx = gap + 2 * (iconSize + gap)  // skill is 3rd button
    this._renderSkillButton(sx, slotBarBtm + 13, iconSize, iconSize)
  }

  // ── Skill button ──

  private _renderSkillButton(x: number, y: number, w: number, h: number): void {
    if (!this.logic) return
    const charges = this.logic.skillSystem.charges
    if (charges === this.skillBtnCharges && this.skillBtnContainer) return
    this.skillBtnCharges = charges

    if (this.skillBtnContainer) {
      this.container.removeChild(this.skillBtnContainer)
      this.skillBtnContainer.destroy({ children: true })
    }

    const hasCharges = charges > 0
    const ctn = new PIXI.Container()
    ctn.x = x; ctn.y = y
    const sTex = getBtnIcon(2)
    if (sTex) {
      const sprite = new PIXI.Sprite(sTex)
      sprite.width = w; sprite.height = h
      if (!hasCharges) sprite.tint = 0x8899AA
      ctn.addChild(sprite)
    }
    // Charge badge
    if (charges > 0) {
      const badge = new PIXI.Text(String(charges), {
        fontFamily: 'sans-serif', fontSize: 14, fontWeight: 'bold', fill: '#F39C12',
      } as any)
      badge.anchor.set(1, 0); badge.x = w - 2; badge.y = 2
      ctn.addChild(badge)
    }

    this.container.addChild(ctn)
    this.skillBtnContainer = ctn
    this.skillHitArea = { x, y, w, h }
    this.skillCallback = () => {
      if (this.logic) this.logic.skillSystem.openSkillPanel()
    }
  }

  /** Clear skill button (for level reset) */
  clearSkillButton(): void {
    if (this.skillBtnContainer) {
      this.container.removeChild(this.skillBtnContainer)
      this.skillBtnContainer.destroy({ children: true })
      this.skillBtnContainer = null
    }
    this.skillBtnCharges = -1
    this.skillHitArea = null
    this.skillCallback = null
  }
}
