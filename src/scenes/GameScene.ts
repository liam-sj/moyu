import * as PIXI from 'pixi.js-legacy'
import { Scene } from '../engine/Scene'
import { GameLogic } from '../core/GameLogic'
import { CardView } from '../views/CardView'
import { Button } from '../views/Button'
import { getLevelConfig } from '../config/levels'
import type {
  BoardCard, GameResult, SkillConfig,
  BoardInitEvent, StepsChangedEvent,
  CardToSlotEvent, BoardChangedEvent,
  EliminatedEvent, SkillTriggeredEvent, GameOverEvent
} from '../core/types'
import { getCardColor } from '../core/Card'
import { log } from '../utils/Logger'

const TAG = 'GameScene'

function hexToInt(hex: string): number {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result) {
    return (parseInt(result[1], 16) << 16) | (parseInt(result[2], 16) << 8) | parseInt(result[3], 16)
  }
  return 0x95A5A6
}

export class GameScene extends Scene {
  private logic!: GameLogic
  private boardLayer = new PIXI.Container()
  private slotLayer = new PIXI.Container()
  private hudLayer = new PIXI.Container()
  private cardViews = new Map<string, CardView>()

  private levelId = 'level1'
  private screenW = 0
  private screenH = 0

  // Pause & skill button hit areas (re-registered every frame)
  private _pauseHitArea: { x: number; y: number; w: number; h: number } | null = null
  private _pauseCallback: (() => void) | null = null
  private _skillHitArea: { x: number; y: number; w: number; h: number } | null = null
  private _skillCallback: (() => void) | null = null
  private _skillBtnContainer: PIXI.Container | null = null
  private _actionHitAreas: Array<{ rect: { x: number; y: number; w: number; h: number }; cb: () => void }> = []

  // Skill popup state
  private pendingSkills: SkillConfig[] | null = null
  private skillHitAreas: Array<{ rect: { x: number; y: number; w: number; h: number }; callback: () => void }> = []
  private skillOverlay: PIXI.Graphics | null = null
  private skillPopupElements: PIXI.Container[] = []

  // Deferred transition (avoid tearing down scene during event processing)
  private _pendingTransition: { levelId: string } | null = null
  private _firstRender = true
  private _flyEffects: Array<{
    view: CardView; uid: string; startX: number; startY: number
    targetX: number; targetY: number; elapsed: number; duration: number
  }> = []
  private _effects: Array<{
    particles: PIXI.Text[]
    elapsed: number
    duration: number
    origins: Array<{ x: number; y: number; angle: number }>
  }> = []

  onEnter(params?: unknown): void {
    this.levelId = (params as any)?.levelId || 'level1'

    const sysInfo = wx.getSystemInfoSync()
    this.screenW = sysInfo.windowWidth
    this.screenH = sysInfo.windowHeight

    this.container.addChild(this.boardLayer)
    this.container.addChild(this.slotLayer)
    this.container.addChild(this.hudLayer)

    // Enable z-index sorting so upper-layer cards render on top of lower ones
    this.boardLayer.sortableChildren = true

    // Subscribe to events
    this.listen<BoardInitEvent>('boardInit', (e) => this.renderBoard(e.cards))
    this.listen<StepsChangedEvent>('stepsChanged', () => this.renderHUD())
    this.listen<CardToSlotEvent>('cardToSlot', () => this.renderSlotBar())
    this.listen<BoardChangedEvent>('boardChanged', (e) => this.syncBlocked(e.cards))
    this.listen<EliminatedEvent>('eliminated', (e) => this.onEliminated(e))
    this.listen<SkillTriggeredEvent>('skillTriggered', (e) => this.showSkillSelection(e.skills))
    this.listen<GameOverEvent>('gameOver', (e) => this.onGameOver(e))
    this.listen('slotChanged', () => this.renderSlotBar())
    this.listen<{ cardTypes: string[] }>('selectCardType', (e) => this.showCardTypeSelection(e.cardTypes))

    // Initialize logic
    const config = getLevelConfig(this.levelId)
    this.logic = new GameLogic(config, this.bus)
    this.logic.init(this.screenW, this.screenH)

    // Buttons below slot bar
    this._actionHitAreas = []
    const slotBarBottom = this.logic.slotBar.startY + this.logic.slotBar.slotHeight
    const btnY = slotBarBottom + 8
    const btnH = 32
    const totalBtnW = this.screenW - 16
    const btnGap = 6
    const btnW = Math.floor((totalBtnW - btnGap * 3) / 4)

    // Eject button: move first 3 cards out of slot
    const ejectX = 8
    const ejectBtn = new Button(ejectX, btnY, btnW, btnH, '📤 移出', {
      bgColor: '#8E44AD', fontSize: 11, radius: 6,
    })
    this.container.addChild(ejectBtn.container)
    this._actionHitAreas.push({ rect: ejectBtn.hitArea, cb: () => { this.logic.ejectSlots(); this.renderSlotBar() } })

    // Undo button
    const undoX = ejectX + btnW + btnGap
    const undoBtn = new Button(undoX, btnY, btnW, btnH, '↩️ 撤回', {
      bgColor: '#2980B9', fontSize: 11, radius: 6,
    })
    this.container.addChild(undoBtn.container)
    this._actionHitAreas.push({ rect: undoBtn.hitArea, cb: () => { this.logic.undoLastAction(); this.renderSlotBar(); this.renderHUD() } })

    // Skill button
    const skillX = undoX + btnW + btnGap
    this._renderSkillButton(skillX, btnY, btnW, btnH)

    // Pause button
    const pauseX = skillX + btnW + btnGap
    const pauseBtn = new Button(pauseX, btnY, btnW, btnH, '⏸ 暂停', {
      bgColor: '#7F8C8D', fontSize: 11, radius: 6,
    })
    this.container.addChild(pauseBtn.container)
    this._pauseHitArea = pauseBtn.hitArea
    this._pauseCallback = () => {
      const { PauseOverlay } = require('./overlays/PauseOverlay')
      this.manager.push(new PauseOverlay())
    }

    // Initial render
    this.renderSlotBar()
    log(TAG, 'GameScene entered, level=' + this.levelId)
  }

  onUpdate(dt: number): void {
    // Drive fly-to-slot animations
    for (let f = this._flyEffects.length - 1; f >= 0; f--) {
      const fly = this._flyEffects[f]
      fly.elapsed += dt
      const progress = Math.min(fly.elapsed / fly.duration, 1)
      const t = 1 - Math.pow(1 - progress, 2)
      if (this.cardViews.has(fly.uid)) {
        fly.view.container.x = fly.startX + (fly.targetX - fly.startX) * t
        fly.view.container.y = fly.startY + (fly.targetY - fly.startY) * t
        fly.view.container.scale.set(1 - progress * 0.5)
        fly.view.container.alpha = 1 - progress * 0.4
      }
      if (progress >= 1) {
        if (this.cardViews.has(fly.uid)) {
          fly.view.destroy()
          this.cardViews.delete(fly.uid)
        }
        this._flyEffects.splice(f, 1)
        this.renderSlotBar()
      }
    }

    // Drive particle effects
    for (let e = this._effects.length - 1; e >= 0; e--) {
      const eff = this._effects[e]
      eff.elapsed += dt
      const progress = Math.min(eff.elapsed / eff.duration, 1)
      const t = progress

      for (let i = 0; i < eff.particles.length; i++) {
        const p = eff.particles[i]
        const o = eff.origins[i]
        const dist = t * 55
        p.x = o.x + Math.cos(o.angle) * dist
        p.y = o.y + Math.sin(o.angle) * dist - t * 25
        p.alpha = 1 - t * t
        p.scale.set(0.4 + t * 0.8)
      }

      if (progress >= 1) {
        for (const p of eff.particles) {
          this.container.removeChild(p)
          p.destroy()
        }
        this._effects.splice(e, 1)
      }
    }

    // Process deferred level transition (avoids tearing down scene during event)
    if (this._pendingTransition) {
      const t = this._pendingTransition
      this._pendingTransition = null
      this.manager.slideReplace(new GameScene(), { levelId: t.levelId }, 65)
      return
    }

    // Re-register buttons every frame
    if (this._pauseHitArea && this._pauseCallback) {
      this.registerHitArea(this._pauseHitArea, this._pauseCallback, 15)
    }
    if (this._skillHitArea && this._skillCallback) {
      this.registerHitArea(this._skillHitArea, this._skillCallback, 15)
    }
    for (const item of this._actionHitAreas) {
      this.registerHitArea(item.rect, item.cb, 12)
    }

    if (this.skillOverlay) {
      // Popup active (skill selection or card-type selection)
      for (const item of this.skillHitAreas) {
        this.registerHitArea(item.rect, item.callback, 20)
      }
    } else {
      this.registerCardHitAreas()
    }
  }

  // ── Skill button ──

  private _skillBtnCharges = -1  // track last rendered charges to avoid rebuild

  private _renderSkillButton(x: number, y: number, w: number, h: number): void {
    if (!this.logic) return
    const charges = this.logic.skillSystem.charges
    if (charges === this._skillBtnCharges && this._skillBtnContainer) return
    this._skillBtnCharges = charges

    if (this._skillBtnContainer) {
      this.container.removeChild(this._skillBtnContainer)
      this._skillBtnContainer.destroy({ children: true })
    }

    const hasCharges = charges > 0
    const ctn = new PIXI.Container()
    const bg = new PIXI.Graphics()
    bg.beginFill(hasCharges ? 0xE67E22 : 0x5A6B7D, 0.85)
    bg.drawRoundedRect(x, y, w, h, 8)
    bg.endFill()
    if (hasCharges) {
      bg.lineStyle(1.5, 0xF39C12, 0.6)
      bg.drawRoundedRect(x, y, w, h, 8)
    }
    ctn.addChild(bg)

    const txt = new PIXI.Text('🃏 ' + charges, {
      fontFamily: 'sans-serif', fontSize: 18, fontWeight: 'bold',
      fill: hasCharges ? '#FFFFFF' : '#8899AA',
    } as any)
    txt.anchor.set(0.5); txt.x = x + w / 2; txt.y = y + h / 2
    ctn.addChild(txt)

    this.container.addChild(ctn)
    this._skillBtnContainer = ctn
    this._skillHitArea = { x, y, w, h }
    this._skillCallback = () => {
      if (this.logic) this.logic.skillSystem.openSkillPanel()
    }
  }

  // ── Board rendering ──

  private renderBoard(cards: BoardCard[]): void {
    this.boardLayer.removeChildren()
    this.cardViews.clear()

    const board = this.logic.board
    // Deck origin: center-top of board area
    const deckX = this.screenW / 2
    const deckY = board.offsetY - 60

    // Sort by layer so bottom layers animate first
    const sorted = [...cards].sort((a, b) => a.layer - b.layer)
    const views: CardView[] = []

    for (const card of sorted) {
      const view = new CardView(
        card, board.cardWidth, board.cardHeight,
        board.layerOffsetX, board.layerOffsetY,
        board.gap, board.offsetX, board.offsetY,
        board.staggerLayers
      )
      view.container.zIndex = card.layer
      this.boardLayer.addChild(view.container)
      this.cardViews.set(card.uid, view)
      views.push(view)
    }
    this.boardLayer.sortChildren()

    // Animate cards in on first render only (re-renders snap to position)
    if (this._firstRender) {
      this._firstRender = false
      for (let i = 0; i < views.length; i++) {
        const view = views[i]
        const layerDelay = view.layer * 280
        const randomDelay = ((i * 37 + 13) % 140)
        view.animateIn(deckX, deckY, layerDelay + randomDelay, 550)
      }
    } else {
      for (const view of views) view.snapToTarget()
    }
  }

  private syncBlocked(cards: Array<{ uid: string; blocked: boolean }>): void {
    // Incremental update: only redraw cards whose covered state actually changed
    for (const { uid, blocked } of cards) {
      const view = this.cardViews.get(uid)
      if (view) view.setCovered(blocked)
    }
  }

  // ── Slot rendering ──

  private renderSlotBar(): void {
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

      // Flight bar background with special styling
      const flightBg = new PIXI.Graphics()
      flightBg.beginFill(0x1A2A3A, 0.65)
      flightBg.drawRoundedRect(barX, flightY, flightW, flightH, 10)
      flightBg.endFill()
      flightBg.lineStyle(1, 0x3498DB, 0.5)
      flightBg.drawRoundedRect(barX, flightY, flightW, flightH, 10)
      this.slotLayer.addChild(flightBg)

      // Flight label
      const flightLabel = new PIXI.Text('📵 飞行模式', {
        fontFamily: 'sans-serif', fontSize: 10, fill: '#3498DB', fontWeight: 'bold',
      } as any)
      flightLabel.x = barX + 8; flightLabel.y = flightY + 3
      this.slotLayer.addChild(flightLabel)

      // 3 flight slots — show cards placed in them
      const fSlotW = bar.slotWidth
      for (let f = 0; f < 3; f++) {
        const fx = bar.startX + f * (fSlotW + bar.gap)
        const fy = flightY + 18
        const fw = fSlotW
        const fh = bar.slotHeight * 0.75
        const flightCard = bar.flightSlots[f]

        const fs = new PIXI.Graphics()
        if (flightCard) {
          // Card in flight slot
          fs.beginFill(0xFFFFFF, 0.9)
          fs.drawRoundedRect(fx, fy, fw, fh, 6)
          fs.endFill()
          fs.lineStyle(1.5, 0x3498DB, 0.7)
          fs.drawRoundedRect(fx, fy, fw, fh, 6)
          this.slotLayer.addChild(fs)

          const iconTxt = new PIXI.Text(flightCard.icon, {
            fontFamily: 'sans-serif', fontSize: Math.max(12, Math.floor(fw * 0.4)), align: 'center',
          } as any)
          iconTxt.anchor.set(0.5); iconTxt.x = fx + fw / 2; iconTxt.y = fy + fh / 2
          this.slotLayer.addChild(iconTxt)
        } else {
          // Empty flight slot — always show ✈️
          fs.lineStyle(1.5, 0x3498DB, 0.45)
          fs.beginFill(0x2C3E50, 0.18)
          fs.drawRoundedRect(fx, fy, fw, fh, 6)
          fs.endFill()
          this.slotLayer.addChild(fs)

          const fTxt = new PIXI.Text('✈️', {
            fontFamily: 'sans-serif', fontSize: 14, fill: '#3498DB',
          } as any)
          fTxt.anchor.set(0.5); fTxt.x = fx + fw / 2; fTxt.y = fy + fh / 2
          this.slotLayer.addChild(fTxt)
        }
      }
    }

    // ── Holding slots (移出 area) ──
    const hasHolding = bar.holdingSlots.some(s => s !== null)
    if (hasHolding) {
      const holdY = freeClicks > 0 || hasFlightCards
        ? bar.startY - bar.slotHeight - 10 - (bar.slotHeight * 0.75 + 20) - 6
        : bar.startY - bar.slotHeight - 14
      const holdH = bar.slotHeight * 0.7

      // Label
      const holdLabel = new PIXI.Text('📤 移出区', {
        fontFamily: 'sans-serif', fontSize: 9, fill: '#8E44AD', fontWeight: 'bold',
      } as any)
      holdLabel.x = bar.startX; holdLabel.y = holdY - 14
      this.slotLayer.addChild(holdLabel)

      for (let h = 0; h < 3; h++) {
        const hx = bar.startX + h * (bar.slotWidth + bar.gap)
        const hy = holdY
        const hw = bar.slotWidth
        const hCard = bar.holdingSlots[h]

        const hs = new PIXI.Graphics()
        if (hCard) {
          hs.beginFill(0xFFFFFF, 0.85)
          hs.drawRoundedRect(hx, hy, hw, holdH, 6)
          hs.endFill()
          hs.lineStyle(1.5, 0x8E44AD, 0.6)
          hs.drawRoundedRect(hx, hy, hw, holdH, 6)
          this.slotLayer.addChild(hs)

          const hIcon = new PIXI.Text(hCard.icon, {
            fontFamily: 'sans-serif', fontSize: Math.max(12, Math.floor(hw * 0.38)), align: 'center',
          } as any)
          hIcon.anchor.set(0.5); hIcon.x = hx + hw / 2; hIcon.y = hy + holdH / 2
          this.slotLayer.addChild(hIcon)
        } else {
          hs.lineStyle(1, 0x8E44AD, 0.25)
          hs.drawRoundedRect(hx, hy, hw, holdH, 6)
          this.slotLayer.addChild(hs)
        }
      }
    }

    // ── Normal slot bar ──
    const barBg = new PIXI.Graphics()
    barBg.beginFill(0x1A252F, 0.75)
    barBg.drawRoundedRect(barX, barY, barW, barH, 10)
    barBg.endFill()
    barBg.lineStyle(1, 0x34495E, 0.6)
    barBg.drawRoundedRect(barX, barY, barW, barH, 10)
    this.slotLayer.addChild(barBg)

    // Count same-type cards to highlight slots nearing elimination
    const counts: Record<string, number[]> = {}
    for (let i = 0; i < bar.maxSlots; i++) {
      const s = bar.slots[i]
      if (!s) continue
      const key = s.cardId
      if (!counts[key]) counts[key] = []
      counts[key].push(i)
    }

    for (let i = 0; i < bar.maxSlots; i++) {
      const slot = bar.slots[i]
      const x = bar.startX + i * (bar.slotWidth + bar.gap)
      const y = bar.startY
      const w = bar.slotWidth; const h = bar.slotHeight

      if (slot) {
        const colorStr = getCardColor(slot)
        const colorInt = hexToInt(colorStr)

        // Check if this slot is part of a near-elimination (2 of same type)
        const sameTypeIndices = counts[slot.cardId] || []
        const nearElim = sameTypeIndices.length >= 2

        const bg = new PIXI.Graphics()
        bg.beginFill(0xFFFFFF, nearElim ? 1 : 0.9)
        bg.drawRoundedRect(x, y, w, h, 6)
        bg.endFill()
        if (nearElim) {
          // Glow effect for cards nearing elimination
          bg.lineStyle(2, 0xF1C40F, 0.8)
        } else {
          bg.lineStyle(1, colorInt, 0.5)
        }
        bg.drawRoundedRect(x, y, w, h, 6)
        this.slotLayer.addChild(bg)

        // Emoji only, centered
        const icon = (slot.type === 'event' && !slot.isRevealed) ? '❓' : slot.icon
        const iconTxt = new PIXI.Text(icon, {
          fontFamily: 'sans-serif', fontSize: Math.max(16, Math.floor(w * 0.45)), align: 'center',
        } as any)
        iconTxt.anchor.set(0.5); iconTxt.x = x + w / 2; iconTxt.y = y + h / 2
        this.slotLayer.addChild(iconTxt)

        // Count badge (tiny "×2" in corner)
        if (sameTypeIndices.length >= 2) {
          const badgeTxt = new PIXI.Text('×' + sameTypeIndices.length, {
            fontFamily: 'sans-serif', fontSize: Math.max(8, Math.floor(w * 0.18)),
            fill: '#F1C40F', fontWeight: 'bold',
          } as any)
          badgeTxt.anchor.set(1, 0); badgeTxt.x = x + w - 3; badgeTxt.y = y + 2
          this.slotLayer.addChild(badgeTxt)
        }
      } else {
        // Empty slot — dashed outline
        const empty = new PIXI.Graphics()
        empty.lineStyle(1, 0x5A6B7D, 0.35)
        empty.drawRoundedRect(x, y, w, h, 6)
        this.slotLayer.addChild(empty)

        // Slot number
        const numTxt = new PIXI.Text(String(i + 1), {
          fontFamily: 'sans-serif', fontSize: Math.max(9, Math.floor(w * 0.2)),
          fill: '#3A4B5D', align: 'center',
        } as any)
        numTxt.anchor.set(0.5); numTxt.x = x + w / 2; numTxt.y = y + h / 2
        this.slotLayer.addChild(numTxt)
      }
    }
  }

  // ── HUD ──

  private renderHUD(): void {
    this.hudLayer.removeChildren()
    const bar = this.logic.stepManager
    const config = getLevelConfig(this.levelId)
    const w = this.screenW

    const levelTxt = new PIXI.Text(config.name, {
      fontFamily: 'sans-serif', fontSize: 13, fill: '#95A5A6',
    } as any)
    levelTxt.x = 10; levelTxt.y = 14
    this.hudLayer.addChild(levelTxt)

    // Steps — moved to left side to avoid notch
    const stepsUnlimited = bar.stepsUnlimited
    const stepsRemain = bar.stepsRemaining
    const stepsWarn = stepsRemain <= 5 && !stepsUnlimited
    const stepsDisplay = stepsUnlimited ? '∞' : String(stepsRemain)

    const stepsBg = new PIXI.Graphics()
    stepsBg.beginFill(stepsWarn ? 0xE74C3C : 0x2C3E50, 0.75)
    stepsBg.drawRoundedRect(8, 40, 66, 28, 14)
    stepsBg.endFill()
    this.hudLayer.addChild(stepsBg)

    const stepsTxt = new PIXI.Text('👣 ' + stepsDisplay, {
      fontFamily: 'sans-serif', fontSize: 14, fontWeight: 'bold',
      fill: stepsWarn ? '#FFFFFF' : '#F1C40F',
    } as any)
    stepsTxt.anchor.set(0.5); stepsTxt.x = 41; stepsTxt.y = 54
    this.hudLayer.addChild(stepsTxt)

    // Happiness — right side
    const happyTxt = new PIXI.Text('😊 ' + this.logic.happyValue, {
      fontFamily: 'sans-serif', fontSize: 14, fontWeight: 'bold', fill: '#F1C40F',
    } as any)
    happyTxt.anchor.set(1, 0); happyTxt.x = w - 10; happyTxt.y = 14
    this.hudLayer.addChild(happyTxt)

    // Refresh skill button
    const slotBarBottom = this.logic.slotBar.startY + this.logic.slotBar.slotHeight
    const btnGap = 6
    const btnW2 = Math.floor((this.screenW - 16 - btnGap * 3) / 4)
    const skillX2 = 8 + (btnW2 + btnGap) * 2
    this._renderSkillButton(skillX2, slotBarBottom + 8, btnW2, 32)

    let slotStatus: string
    if (bar.slotUnlimited) {
      slotStatus = '∞ 槽位（无限制）'
    } else {
      slotStatus = this.logic.slotBar.getVacantCount() + ' 空格'
    }
    if (bar.tempSlotLimit9 > 0) slotStatus += ' | 💤装死×' + bar.tempSlotLimit9
    if (bar.slotOverflowShield) slotStatus += ' | 📊护体'
    const slotTxt = new PIXI.Text(slotStatus, {
      fontFamily: 'sans-serif', fontSize: 13, fill: '#95A5A6', align: 'center',
    } as any)
    slotTxt.anchor.set(0.5); slotTxt.x = w / 2; slotTxt.y = this.logic.slotBar.startY - 25
    this.hudLayer.addChild(slotTxt)
  }

  // ── Hit areas ──

  private registerCardHitAreas(): void {
    const clickable = this.logic.board.getClickableCards()
    const board = this.logic.board
    for (const card of clickable) {
      const view = this.cardViews.get(card.uid)
      if (!view) continue
      const jx = ((parseInt(card.uid.slice(1), 10) || 0) * 7 + 13) % 7 - 3
      const jy = ((parseInt(card.uid.slice(1), 10) || 0) * 13 + 7) % 7 - 3
      const staggerX = (board.staggerLayers && card.layer % 2 === 1) ? Math.floor(board.cardWidth / 2) : 0
      const hx = board.offsetX + card.col * (board.cardWidth + board.gap) + card.layer * board.layerOffsetX + staggerX + jx
      const hy = board.offsetY + card.row * (board.cardHeight + board.gap) - card.layer * board.layerOffsetY + jy
      this.registerHitArea({
        x: hx,
        y: hy,
        w: board.cardWidth,
        h: board.cardHeight,
      }, () => {
        // Vibration feedback
        if (typeof wx !== 'undefined') { wx.vibrateShort({ type: 'light' }) }

        // Get target slot position before the card moves
        const bar = this.logic.slotBar
        let targetX: number, targetY: number
        const freeClicks = this.logic.stepManager.slotFreeClicks
        if (freeClicks > 0) {
          // Flight slot
          const flightY = bar.startY - bar.slotHeight - 10 + 18
          const emptyFlight = bar.flightSlots.findIndex(s => s === null)
          const fIdx = emptyFlight >= 0 ? emptyFlight : 0
          targetX = bar.startX + fIdx * (bar.slotWidth + bar.gap) + bar.slotWidth / 2
          targetY = flightY + bar.slotHeight * 0.75 / 2
        } else {
          // Normal slot
          const emptyNormal = bar.slots.findIndex(s => s === null)
          const nIdx = emptyNormal >= 0 ? emptyNormal : 0
          targetX = bar.startX + nIdx * (bar.slotWidth + bar.gap) + bar.slotWidth / 2
          targetY = bar.startY + bar.slotHeight / 2
        }

        this.logic.onCardClicked(card.uid)

        // Animate card flying to slot (onUpdate-driven, no ticker)
        const cardView = this.cardViews.get(card.uid)
        if (cardView) {
          const startX = cardView.container.x
          const startY = cardView.container.y
          this._flyEffects.push({
            view: cardView, uid: card.uid,
            startX, startY, targetX, targetY,
            elapsed: 0, duration: 24,  // 24 frames ≈ 400ms
          })
        } else {
          this.renderSlotBar()
        }
        this.renderHUD()
      }, card.layer)  // higher layer = tested first, top card wins on overlap
    }
  }

  // ── Events ──

  private onEliminated(e: EliminatedEvent): void {
    for (const uid of e.uids) {
      const view = this.cardViews.get(uid)
      if (view) {
        view.destroy()
        this.cardViews.delete(uid)
      }
    }
    // Render slot first, then play burst on top
    this.renderSlotBar()
    this.renderHUD()

    // Burst at center of slot bar
    const bar = this.logic.slotBar
    const fx = bar.startX + (bar.maxSlots * bar.slotWidth + (bar.maxSlots - 1) * bar.gap) / 2
    const fy = bar.startY + bar.slotHeight / 2
    this._playEliminationEffect(fx, fy)

    this.logic.onEliminate(e.count)
  }

  /** Burst particle effect when cards are eliminated */
  private _playEliminationEffect(x: number, y: number): void {
    const particles: PIXI.Text[] = []
    const origins: Array<{ x: number; y: number; angle: number }> = []
    const emojis = ['✨', '💥', '⭐', '🌟', '💫']

    for (let i = 0; i < 6; i++) {
      const emoji = emojis[i % emojis.length]
      const ox = x + (Math.random() - 0.5) * 40
      const oy = y + (Math.random() - 0.5) * 20
      const p = new PIXI.Text(emoji, {
        fontFamily: 'sans-serif', fontSize: 20 + Math.random() * 16,
      } as any)
      p.anchor.set(0.5)
      p.x = ox
      p.y = oy
      p.alpha = 1
      p.scale.set(0.4)
      this.container.addChild(p)
      particles.push(p)
      origins.push({ x: ox, y: oy, angle: (i / 6) * Math.PI * 2 + (Math.random() - 0.5) * 0.5 })
    }

    this._effects.push({ particles, elapsed: 0, duration: 30, origins })
  }

  // ── Skill popup ──

  private showSkillSelection(skills: SkillConfig[]): void {
    this.pendingSkills = skills
    this.skillHitAreas = []

    const w = this.screenW; const h = this.screenH
    const overlay = new PIXI.Graphics()
    overlay.beginFill(0x000000, 0.65); overlay.drawRect(0, 0, w, h); overlay.endFill()
    this.container.addChild(overlay)
    this.skillOverlay = overlay

    const charges = this.logic.skillSystem.charges
    const canUse = charges > 0
    const titleText = canUse
      ? '🎯 选择技能 (' + skills.length + '个可用, 充能×' + charges + ')'
      : '🎯 技能列表 (消除3组获得充能)'
    const titleTxt = new PIXI.Text(titleText, {
      fontFamily: 'sans-serif', fontSize: 16, fontWeight: 'bold',
      fill: canUse ? '#F39C12' : '#7F8C8D', align: 'center',
    } as any)
    titleTxt.anchor.set(0.5); titleTxt.x = w / 2; titleTxt.y = h * 0.06
    this.container.addChild(titleTxt)
    this.skillPopupElements.push(titleTxt)

    // Compact 2-column grid that fits 10 skills on screen
    const cols = 2
    const margin = 12
    const gap = 10
    const cardW = Math.floor((w - margin * 2 - gap) / cols)
    const cardH = 72
    const startY = h * 0.12
    const self = this

    for (let i = 0; i < skills.length; i++) {
      const skill = skills[i]
      const col = i % cols
      const row = Math.floor(i / cols)
      const cx = margin + col * (cardW + gap)
      const cy = startY + row * (cardH + gap)
      const isLegendary = skill.tag === '传说型'

      const sc = new PIXI.Container()

      const bg = new PIXI.Graphics()
      const alpha = canUse ? 0.95 : 0.55
      if (isLegendary) {
        bg.lineStyle(1.5, 0xF1C40F, canUse ? 0.8 : 0.3)
        bg.beginFill(0x2C1A0A, alpha)
      } else {
        bg.beginFill(0x2C3E50, alpha)
      }
      bg.drawRoundedRect(cx, cy, cardW, cardH, 10)
      bg.endFill()
      if (!isLegendary) {
        bg.lineStyle(1, 0x4A6A8A, 0.3)
        bg.drawRoundedRect(cx, cy, cardW, cardH, 10)
      }
      sc.addChild(bg)

      // Emoji — left side
      const iconTxt = new PIXI.Text(skill.icon, {
        fontFamily: 'sans-serif', fontSize: 26, align: 'center',
      } as any)
      iconTxt.anchor.set(0.5); iconTxt.x = cx + 30; iconTxt.y = cy + cardH / 2
      sc.addChild(iconTxt)

      // Name + desc
      const nameColor = isLegendary ? '#F1C40F' : '#FFFFFF'
      const nameTxt = new PIXI.Text(skill.name, {
        fontFamily: 'sans-serif', fontSize: 14, fontWeight: 'bold', fill: nameColor,
      } as any)
      nameTxt.x = cx + 52; nameTxt.y = cy + 12
      sc.addChild(nameTxt)

      const descTxt = new PIXI.Text(skill.desc, {
        fontFamily: 'sans-serif', fontSize: 10,
        fill: isLegendary ? '#E8C870' : '#95A5A6',
        wordWrap: true, wordWrapWidth: cardW - 60,
      } as any)
      descTxt.x = cx + 52; descTxt.y = cy + 32
      sc.addChild(descTxt)

      // Legendary badge
      if (isLegendary) {
        const badgeTxt = new PIXI.Text('传说', {
          fontFamily: 'sans-serif', fontSize: 9, fontWeight: 'bold', fill: '#F1C40F',
        } as any)
        badgeTxt.anchor.set(1, 0); badgeTxt.x = cx + cardW - 6; badgeTxt.y = cy + 4
        sc.addChild(badgeTxt)
      }

      self.container.addChild(sc)
      self.skillPopupElements.push(sc)

      self.skillHitAreas.push({
        rect: { x: cx, y: cy, w: cardW, h: cardH },
        callback: () => {
          if (self.logic.skillSystem.charges > 0) {
            self.onSkillSelected(skill)
          }
        },
      })
    }

    // Close button at bottom
    const closeY = startY + Math.ceil(skills.length / cols) * (cardH + gap) + 12
    const closeBtnW = 120, closeBtnH = 36
    const closeBg = new PIXI.Graphics()
    closeBg.beginFill(0x7F8C8D, 0.7)
    closeBg.drawRoundedRect((w - closeBtnW) / 2, closeY, closeBtnW, closeBtnH, 8)
    closeBg.endFill()
    self.container.addChild(closeBg)
    self.skillPopupElements.push(closeBg)

    const closeTxt = new PIXI.Text('关闭', {
      fontFamily: 'sans-serif', fontSize: 14, fill: '#FFFFFF',
    } as any)
    closeTxt.anchor.set(0.5); closeTxt.x = w / 2; closeTxt.y = closeY + closeBtnH / 2
    self.container.addChild(closeTxt)
    self.skillPopupElements.push(closeTxt)

    self.skillHitAreas.push({
      rect: { x: (w - closeBtnW) / 2, y: closeY, w: closeBtnW, h: closeBtnH },
      callback: () => self._dismissSkillPanel(),
    })
  }

  private _dismissSkillPanel(): void {
    if (this.skillOverlay) { this.container.removeChild(this.skillOverlay); this.skillOverlay = null }
    for (const el of this.skillPopupElements) { this.container.removeChild(el) }
    this.skillPopupElements = []
    this.skillHitAreas = []
    this.pendingSkills = null
    this.logic.skillSystem.isShowingSelection = false
  }

  // ── S8 card-type selection ──

  private showCardTypeSelection(cardTypes: string[]): void {
    this.skillHitAreas = []
    this.pendingSkills = null

    const w = this.screenW; const h = this.screenH
    const overlay = new PIXI.Graphics()
    overlay.beginFill(0x000000, 0.65); overlay.drawRect(0, 0, w, h); overlay.endFill()
    this.container.addChild(overlay)
    this.skillOverlay = overlay

    const titleTxt = new PIXI.Text('💻 选择要消除的卡片类型', {
      fontFamily: 'sans-serif', fontSize: 20, fontWeight: 'bold',
      fill: '#7FB3D8', align: 'center',
    } as any)
    titleTxt.anchor.set(0.5); titleTxt.x = w / 2; titleTxt.y = h * 0.22
    this.container.addChild(titleTxt)
    this.skillPopupElements.push(titleTxt)

    const cols = 3, btnW = 90, btnH = 80, gap = 16
    const totalW = cols * btnW + (cols - 1) * gap
    const startX = (w - totalW) / 2
    const startY = h * 0.32
    const self = this

    for (let i = 0; i < cardTypes.length; i++) {
      const cardId = cardTypes[i]
      const col = i % cols; const row = Math.floor(i / cols)
      const bx = startX + col * (btnW + gap)
      const by = startY + row * (btnH + gap)

      const bg = new PIXI.Graphics()
      bg.beginFill(0x2C3E50, 0.9)
      bg.drawRoundedRect(bx, by, btnW, btnH, 10)
      bg.endFill()
      bg.lineStyle(1, 0x4A6A8A, 0.4)
      bg.drawRoundedRect(bx, by, btnW, btnH, 10)
      self.container.addChild(bg)
      self.skillPopupElements.push(bg)

      // Find card icon from config
      const { NORMAL_CARDS } = require('../config/cards')
      const cardCfg = NORMAL_CARDS.find((c: any) => c.id === cardId)
      const icon = cardCfg ? cardCfg.icon : '🃏'
      const name = cardCfg ? cardCfg.name : cardId

      const iconTxt = new PIXI.Text(icon, {
        fontFamily: 'sans-serif', fontSize: 30, align: 'center',
      } as any)
      iconTxt.anchor.set(0.5); iconTxt.x = bx + btnW / 2; iconTxt.y = by + btnH * 0.45
      self.container.addChild(iconTxt)
      self.skillPopupElements.push(iconTxt)

      const nameTxt = new PIXI.Text(name, {
        fontFamily: 'sans-serif', fontSize: 10, fill: '#BDC3C7', align: 'center',
      } as any)
      nameTxt.anchor.set(0.5); nameTxt.x = bx + btnW / 2; nameTxt.y = by + btnH * 0.78
      self.container.addChild(nameTxt)
      self.skillPopupElements.push(nameTxt)

      self.skillHitAreas.push({
        rect: { x: bx, y: by, w: btnW, h: btnH },
        callback: () => {
          // Cleanup
          if (self.skillOverlay) { self.container.removeChild(self.skillOverlay); self.skillOverlay = null }
          for (const el of self.skillPopupElements) { self.container.removeChild(el) }
          self.skillPopupElements = []
          self.skillHitAreas = []

          const ctx = self.logic.getSkillContext()
          ctx.selectAndClearTarget = cardId
          self.renderHUD()
        },
      })
    }
  }

  private onSkillSelected(skill: SkillConfig): void {
    this._dismissSkillPanel()
    const ctx = this.logic.getSkillContext()
    this.logic.skillSystem.selectSkill(skill, ctx)
    this.renderHUD()
  }

  private onGameOver(result: GameResult): void {
    // Level 1 auto-advances to Level 2 on win — defer to avoid tearing down during event processing
    if (result.won && result.levelId === 'level1') {
      this._pendingTransition = { levelId: 'level2' }
      return
    }
    const { ResultOverlay } = require('./overlays/ResultOverlay')
    this.manager.push(new ResultOverlay(result, () => {
      // Revive: eject 3 cards, reset game over flag, continue playing
      this.logic.revive()
      this.renderSlotBar()
      this.renderHUD()
    }))
  }
}
