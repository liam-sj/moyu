import * as PIXI from 'pixi.js-legacy'
import type { GameLogic } from '../core/GameLogic'
import { CardView, createCardImage } from './CardView'
import { getCardColor } from '../core/Card'
import { getLevelConfig } from '../config/levels'

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

    // ── Normal slot bar (water ripple style) ──
    const barBg = new PIXI.Graphics()
    barBg.beginFill(0x1A3A4A, 0.30)
    barBg.drawRoundedRect(barX, barY, barW, barH, 12)
    barBg.endFill()
    barBg.lineStyle(1, 0x5BA0C0, 0.25)
    barBg.drawRoundedRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1, 12)
    this.slotLayer.addChild(barBg)

    for (let i = 0; i < bar.maxSlots; i++) {
      const slot = bar.slots[i]
      const x = bar.startX + i * (bar.slotWidth + bar.gap)
      const y = bar.startY
      const w = bar.slotWidth; const h = bar.slotHeight

      if (slot && !this.flyingUids.has(slot.uid)) {
        const bg = new PIXI.Graphics()
        bg.beginFill(0x5BA0C0, 0.15)
        bg.drawRoundedRect(x, y, w, h, 8)
        bg.endFill()
        bg.lineStyle(1, 0x8CD0E8, 0.35)
        bg.drawRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, 8)
        this.slotLayer.addChild(bg)

        const slotImg = createCardImage(slot.cardId, slot.icon,
          slot.type === 'event', slot.isRevealed, w, h)
        slotImg.x = x + w / 2; slotImg.y = y + h / 2
        this.slotLayer.addChild(slotImg)
        // Ink puddle — organic spilled-ink effect
        if ((slot as any).inked) {
          const ink = new PIXI.Graphics()
          const cx = x + w / 2; const cy = y + h / 2
          const s = w * 0.52
          // Main puddle with more irregular vertices
          ink.beginFill(0x080C14, 0.85)
          const vs = [
            [-0.85, -0.15], [-0.6, -0.3], [-0.45, -0.65], [-0.15, -0.55],
            [0.15, -0.7], [0.4, -0.5], [0.65, -0.35], [0.8, -0.05],
            [0.7, 0.25], [0.5, 0.45], [0.25, 0.65], [-0.05, 0.55],
            [-0.3, 0.6], [-0.55, 0.4], [-0.7, 0.15],
          ]
          ink.moveTo(cx + s * vs[0][0], cy + s * vs[0][1])
          for (let j = 1; j < vs.length; j++) {
            ink.lineTo(cx + s * vs[j][0], cy + s * vs[j][1])
          }
          ink.closePath()
          ink.endFill()
          // Inner lighter layer for depth
          ink.beginFill(0x101820, 0.5)
          const vs2 = [
            [-0.55, -0.05], [-0.35, -0.35], [0.0, -0.4], [0.35, -0.2],
            [0.45, 0.05], [0.25, 0.3], [-0.05, 0.35], [-0.35, 0.15],
          ]
          ink.moveTo(cx + s * vs2[0][0], cy + s * vs2[0][1])
          for (let j = 1; j < vs2.length; j++) {
            ink.lineTo(cx + s * vs2[j][0], cy + s * vs2[j][1])
          }
          ink.closePath()
          ink.endFill()
          // Splatter droplets around edges
          const splatters = [
            [0.9, -0.2, 0.07], [0.75, -0.5, 0.05], [0.5, -0.75, 0.04],
            [-0.1, -0.7, 0.05], [-0.6, -0.55, 0.06], [-0.8, -0.2, 0.04],
            [-0.7, 0.3, 0.05], [-0.4, 0.65, 0.04], [0.1, 0.7, 0.05],
            [0.55, 0.55, 0.06], [0.75, 0.35, 0.04], [0.85, 0.05, 0.03],
            [-0.3, -0.1, 0.03], [0.2, 0.15, 0.04],
          ]
          for (const [dx, dy, dr] of splatters) {
            const ds = s * dr
            ink.beginFill(0x080C14, 0.65)
            ink.drawEllipse(cx + s * dx - ds, cy + s * dy - ds * 0.6, ds * 2, ds * 1.2)
            ink.endFill()
          }
          this.slotLayer.addChild(ink)
        }
      } else {
        const empty = new PIXI.Graphics()
        empty.beginFill(0x5BA0C0, 0.06)
        empty.drawRoundedRect(x, y, w, h, 8)
        empty.endFill()
        empty.lineStyle(1, 0x5BA0C0, 0.12)
        empty.drawRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, 8)
        this.slotLayer.addChild(empty)

        const numTxt = new PIXI.Text(String(i + 1), {
          fontFamily: 'sans-serif', fontSize: Math.max(9, Math.floor(w * 0.2)),
          fill: '#4A7080', align: 'center',
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
        bg.beginFill(0x5BA0C0, 0.15)
        bg.drawRoundedRect(x, y, w, h, 8)
        bg.endFill()
        bg.lineStyle(1, 0x8CD0E8, 0.35)
        bg.drawRoundedRect(x, y, w, h, 8)
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

    // Settings button — bubbles left→right decreasing
    const sCtn = new PIXI.Container()
    const sy = 70; const sizes = [6, 4.5, 3]
    for (let i = 0; i < 3; i++) {
      const r = sizes[i]
      const bubble = new PIXI.Graphics()
      bubble.beginFill(0x7BC8E0, 0.5)
      bubble.drawCircle(0, 0, r)
      bubble.endFill()
      bubble.lineStyle(1, 0xFFFFFF, 0.3)
      bubble.drawCircle(0, 0, r)
      bubble.x = 10 + i * 12 + (6 - r); bubble.y = sy
      sCtn.addChild(bubble)
    }
    this.hudLayer.addChild(sCtn)
    this.settingsHitArea = { x: 4, y: 60, w: 34, h: 22 }



  }

  // ── Skill button ──

  private _renderSkillButton(x: number, y: number, w: number, h: number): void {
    if (!this.logic) return
    const sys = this.logic.skillSystem
    const charges = sys.charges
    const ratio = sys.chargeProgress

    if (this.skillBtnContainer) {
      this.container.removeChild(this.skillBtnContainer)
      this.skillBtnContainer.destroy({ children: true })
    }

    const hasCharges = charges > 0
    const ctn = new PIXI.Container()
    ctn.x = x; ctn.y = y

    // Background — warm glow when charged, water-blue otherwise
    const bg = new PIXI.Graphics()
    bg.beginFill(hasCharges ? 0xF39C12 : 0x4A90B8, hasCharges ? 0.25 : 0.30)
    bg.drawRoundedRect(0, 0, w, h, 8)
    bg.endFill()
    // Glow border
    bg.lineStyle(1.5, hasCharges ? 0xF39C12 : 0x6BB5D8, 0.50)
    bg.drawRoundedRect(0.5, 0.5, w - 1, h - 1, 7)
    ctn.addChild(bg)

    // Border progress — bright and prominent
    const bWidth = 3
    const pad = 0
    const drawSeg = (g: PIXI.Graphics, x1: number, y1: number, x2: number, y2: number, t: number) => {
      if (t <= 0) return
      g.lineStyle(bWidth, 0xFFA500, 0.85)
      const lx = x1 + (x2 - x1) * Math.min(t, 1)
      const ly = y1 + (y2 - y1) * Math.min(t, 1)
      g.moveTo(x1, y1)
      g.lineTo(lx, ly)
    }
    const g = new PIXI.Graphics()
    const l = pad; const t = pad; const r = w - pad; const b = h - pad
    if (ratio > 0.01) {
      drawSeg(g, l, t, r, t, ratio / 0.25)
      drawSeg(g, r, t, r, b, (ratio - 0.25) / 0.25)
      drawSeg(g, r, b, l, b, (ratio - 0.5) / 0.25)
      drawSeg(g, l, b, l, t, (ratio - 0.75) / 0.25)
    }
    ctn.addChild(g)

    // Text
    const txt = new PIXI.Text('涟漪', {
      fontFamily: 'sans-serif', fontSize: 14, fontWeight: 'bold',
      fill: hasCharges ? '#F39C12' : '#CCCCCC',
    } as any)
    txt.anchor.set(0.5); txt.x = w / 2; txt.y = h / 2
    ctn.addChild(txt)

    // Charge badge
    if (charges > 0) {
      const bb = new PIXI.Graphics()
      bb.beginFill(0xE74C3C, 0.9)
      bb.drawCircle(w + 2, 0, 8)
      bb.endFill()
      ctn.addChild(bb)
      const badge = new PIXI.Text(String(charges), {
        fontFamily: 'sans-serif', fontSize: 11, fontWeight: 'bold', fill: '#FFFFFF',
      } as any)
      badge.anchor.set(0.5); badge.x = w + 2; badge.y = -2
      ctn.addChild(badge)
    }

    this.container.addChild(ctn)
    this.skillBtnContainer = ctn
    this.skillHitArea = { x, y, w, h }
    this.skillCallback = () => {
      if (this.logic) this.logic.skillSystem.openSkillPanel()
    }
  }

  /** Lightweight skill button refresh (called every frame) */
  refreshSkillBtn(): void {
    if (!this.logic) return
    const bar = this.logic.slotBar
    const slotBarBtm = bar.startY + bar.slotHeight
    const btnW = 60; const btnH = 32
    const btnGap = Math.floor((this.screenW - btnW * 3) / 4)
    const sx = btnGap + 2 * (btnW + btnGap)
    this._renderSkillButton(sx, slotBarBtm + 12, btnW, btnH)
  }

  /** Clear skill button (for level reset) */
  clearSkillButton(): void {
    if (this.skillBtnContainer) {
      this.container.removeChild(this.skillBtnContainer)
      this.skillBtnContainer.destroy({ children: true })
      this.skillBtnContainer = null
    }
    this.skillHitArea = null
    this.skillCallback = null
  }
}
