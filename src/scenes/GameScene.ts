import * as PIXI from 'pixi.js-legacy'
import { Scene } from '../engine/Scene'
import { GameLogic } from '../core/GameLogic'
import { CardView, createCardImage } from '../views/CardView'
import { Button } from '../views/Button'
import { getLevelConfig } from '../config/levels'
import type {
  BoardCard, GameResult, SkillConfig,
  BoardInitEvent, StepsChangedEvent,
  CardToSlotEvent, BoardChangedEvent,
  EliminatedEvent, SkillTriggeredEvent, GameOverEvent
} from '../core/types'
import { getCardColor } from '../core/Card'
import { getCachedPond, setCachedPond } from '../config/ponds'
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
  private _bottomBtnContainers: PIXI.Container[] = []

  // Skill popup state
  private pendingSkills: SkillConfig[] | null = null
  private skillHitAreas: Array<{ rect: { x: number; y: number; w: number; h: number }; callback: () => void }> = []
  private skillOverlay: PIXI.Graphics | null = null
  private skillPopupElements: PIXI.Container[] = []

  // Deferred transition (avoid tearing down scene during event processing)
  private _pendingTransition: { levelId: string } | null = null
  private _firstRender = true
  private _shuffleOldPositions: Record<string, { x: number; y: number }> | null = null
  // Batch animations driven by onUpdate (no ticker per card)
  private _dealingCards: Array<{
    view: CardView; uid: string; targetX: number; targetY: number
    _fromX: number; _fromY: number; _startTime: number; _animMs: number
  }> = []
  private _shuffleCards: Array<{
    view: CardView; uid: string; fromX: number; fromY: number
    targetX: number; targetY: number; _startTime: number; _animMs: number
  }> = []
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

    // Background image
    const bgImg = wx.createImage()
    bgImg.onload = () => {
      const canvas = wx.createCanvas()
      canvas.width = bgImg.width; canvas.height = bgImg.height
      canvas.getContext('2d').drawImage(bgImg, 0, 0)
      const tex = PIXI.Texture.from(canvas)
      const bg = new PIXI.Sprite(tex)
      bg.width = this.screenW; bg.height = this.screenH
      bg.alpha = 0.65
      this.container.addChildAt(bg, 0)
    }
    bgImg.src = 'assets/cards/background.png'

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
    this._bottomBtnContainers = []
    const slotBarBottom = this.logic.slotBar.startY + this.logic.slotBar.slotHeight
    const btnY = slotBarBottom + 8
    const btnH = 32
    const totalBtnW = this.screenW - 16
    const btnGap = 6
    const btnW = Math.floor((totalBtnW - btnGap * 3) / 4)

    let bx = 8
    // Undo
    const undoBtn = new Button(bx, btnY, btnW, btnH, '↩️ 撤回', {
      bgColor: '#2980B9', fontSize: 11, radius: 6,
    })
    this.container.addChild(undoBtn.container)
    this._bottomBtnContainers.push(undoBtn.container)
    this._actionHitAreas.push({ rect: undoBtn.hitArea, cb: () => { this.logic.undoLastAction(); this.renderSlotBar(); this.renderHUD() } })

    // Shuffle
    bx += btnW + btnGap
    const shuffleBtn = new Button(bx, btnY, btnW, btnH, '🔀 洗牌', {
      bgColor: '#16A085', fontSize: 11, radius: 6,
    })
    this.container.addChild(shuffleBtn.container)
    this._bottomBtnContainers.push(shuffleBtn.container)
    this._actionHitAreas.push({ rect: shuffleBtn.hitArea, cb: () => {
      const oldPos: Record<string, { x: number; y: number }> = {}
      for (const [uid, view] of this.cardViews) {
        oldPos[uid] = { x: view.container.x, y: view.container.y }
      }
      this._shuffleOldPositions = oldPos
      this.logic.shuffleBoard()
      this.renderSlotBar()
    } })

    // Skill
    bx += btnW + btnGap
    this._renderSkillButton(bx, btnY, btnW, btnH)

    // Pause
    bx += btnW + btnGap
    const pauseBtn = new Button(bx, btnY, btnW, btnH, '⏸ 暂停', {
      bgColor: '#7F8C8D', fontSize: 11, radius: 6,
    })
    this.container.addChild(pauseBtn.container)
    this._bottomBtnContainers.push(pauseBtn.container)
    this._pauseHitArea = pauseBtn.hitArea
    this._pauseCallback = () => {
      const { PauseOverlay } = require('./overlays/PauseOverlay')
      this.manager.push(new PauseOverlay())
    }

    // Initial render
    this.renderSlotBar()

    // Level 2 difficulty warning popup
    if (this.levelId === 'level2') {
      this._showDifficultyWarning()
    }

    log(TAG, 'GameScene entered, level=' + this.levelId)
  }

  onUpdate(dt: number): void {
    // Cap dt to avoid huge jumps after lag spikes
    const frameDt = Math.min(dt, 3)

    // Drive dealing animations (batch, real-time based)
    const now = Date.now()
    for (let d = this._dealingCards.length - 1; d >= 0; d--) {
      const dc = this._dealingCards[d]
      const elapsed = now - dc._startTime
      if (elapsed < 0) continue  // still in delay
      const p = Math.min(elapsed / dc._animMs, 1)
      const t = 1 - Math.pow(1 - p, 3)
      dc.view.container.x = dc._fromX + (dc.targetX - dc._fromX) * t
      dc.view.container.y = dc._fromY + (dc.targetY - dc._fromY) * t
      dc.view.container.alpha = Math.min(p * 2, 1)
      dc.view.container.scale.set(0.6 + 0.4 * Math.min(p * 1.5, 1))
      if (p >= 1) {
        dc.view.snapToTarget()
        this._dealingCards.splice(d, 1)
      }
    }

    // Drive shuffle animations (real-time based)
    for (let s = this._shuffleCards.length - 1; s >= 0; s--) {
      const sc = this._shuffleCards[s]
      const elapsed = now - sc._startTime
      if (elapsed < 0) continue
      const p = Math.min(elapsed / sc._animMs, 1)
      const t = 1 - Math.pow(1 - p, 2)
      sc.view.container.x = sc.fromX + (sc.targetX - sc.fromX) * t
      sc.view.container.y = sc.fromY + (sc.targetY - sc.fromY) * t
      if (p >= 1) {
        sc.view.container.x = sc.targetX
        sc.view.container.y = sc.targetY
        this._shuffleCards.splice(s, 1)
      }
    }

    // Drive fly-to-slot animations
    for (let f = this._flyEffects.length - 1; f >= 0; f--) {
      const fly = this._flyEffects[f]
      fly.elapsed += dt
      const progress = Math.min(fly.elapsed / fly.duration, 1)
      // Smooth ease-in-out: gentle start, cruise, gentle landing
      const t = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2
      if (this.cardViews.has(fly.uid)) {
        const t = 1 - Math.pow(1 - progress, 2)
        fly.view.container.x = fly.startX + (fly.targetX - fly.startX) * t
        fly.view.container.y = fly.startY + (fly.targetY - fly.startY) * t
        fly.view.container.scale.set(1 - progress * 0.5)
        fly.view.container.alpha = 1 - progress * 0.3
      }
      if (progress >= 1) {
        if (this.cardViews.has(fly.uid)) {
          fly.view.destroy()
          this.cardViews.delete(fly.uid)
        }
        this._flyEffects.splice(f, 1)
        // Render slot bar now that card has landed
        this.logic.slotBar.notifySlotChanged()
        const sbar = this.logic.slotBar
        for (let i = 0; i < sbar.maxSlots; i++) {
          if (sbar.slots[i] && sbar.slots[i]!.uid === fly.uid) {
            sbar.checkMatch(sbar.slots[i]!.cardId)
            break
          }
        }
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
      this._resetLevel(t.levelId)
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
    bg.beginFill(hasCharges ? 0xE67E22 : 0x7A6B5D, 0.85)
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

  /** Level 2 difficulty spike warning — slide in from right, hold, slide out left */
  private _showDifficultyWarning(): void {
    const w = this.screenW; const h = this.screenH
    const panelW = 260; const panelH = 120
    const px = (w - panelW) / 2; const py = h * 0.35

    const panel = new PIXI.Container()
    panel.x = w  // start off-screen right
    panel.y = py

    const bg = new PIXI.Graphics()
    bg.beginFill(0x1A0A0A, 0.95)
    bg.drawRoundedRect(0, 0, panelW, panelH, 16)
    bg.endFill()
    bg.lineStyle(2, 0xE74C3C, 0.8)
    bg.drawRoundedRect(0, 0, panelW, panelH, 16)
    panel.addChild(bg)

    const icon = new PIXI.Text('⚠️', {
      fontFamily: 'sans-serif', fontSize: 32, align: 'center',
    } as any)
    icon.anchor.set(0.5); icon.x = panelW / 2; icon.y = 28
    panel.addChild(icon)

    const title = new PIXI.Text('难度飙升！', {
      fontFamily: 'sans-serif', fontSize: 20, fontWeight: 'bold', fill: '#E74C3C',
    } as any)
    title.anchor.set(0.5); title.x = panelW / 2; title.y = 58
    panel.addChild(title)

    const desc = new PIXI.Text('10层金字塔 · 84张卡 · 地狱挑战', {
      fontFamily: 'sans-serif', fontSize: 12, fill: '#E8A0A0',
    } as any)
    desc.anchor.set(0.5); desc.x = panelW / 2; desc.y = 84
    panel.addChild(desc)

    this.container.addChild(panel)

    const startTime = Date.now()
    const slideInDur = 500; const holdDur = 2000; const slideOutDur = 500
    const totalDur = slideInDur + holdDur + slideOutDur

    const ticker = PIXI.Ticker.shared
    const tick = () => {
      const elapsed = Date.now() - startTime
      if (elapsed < slideInDur) {
        const t = 1 - Math.pow(1 - elapsed / slideInDur, 2)
        panel.x = px + (w - px) * (1 - t)
      } else if (elapsed < slideInDur + holdDur) {
        panel.x = px
      } else if (elapsed < totalDur) {
        const t = Math.pow((elapsed - slideInDur - holdDur) / slideOutDur, 2)
        panel.x = px - (px + panelW) * t
        panel.alpha = 1 - t
      } else {
        ticker.remove(tick)
        this.container.removeChild(panel)
        panel.destroy({ children: true })
      }
    }
    ticker.add(tick)
  }

  /** Reset game to a new level in-place — no scene swap, just cards regenerate */
  private _resetLevel(levelId: string): void {
    this.levelId = levelId
    // Destroy all current card views
    for (const [_, view] of this.cardViews) view.destroy()
    this.cardViews.clear()
    // Clean up active animation objects
    for (const eff of this._effects) {
      for (const p of eff.particles) { this.container.removeChild(p); p.destroy() }
    }
    this._flyEffects.length = 0
    this._effects.length = 0
    this._dealingCards.length = 0
    this._shuffleCards.length = 0
    this._firstRender = true

    // Clear board and slot layers
    this.boardLayer.removeChildren()
    this.slotLayer.removeChildren()
    this.hudLayer.removeChildren()

    // Clean up old logic
    this.logic.skillSystem.reset()

    // Init new level
    const config = getLevelConfig(levelId)
    this.logic = new GameLogic(config, this.bus)
    this.logic.init(this.screenW, this.screenH)

    // Remove old buttons (keep background at index 0)
    for (const c of this._bottomBtnContainers) {
      this.container.removeChild(c); c.destroy({ children: true })
    }
    this._bottomBtnContainers = []
    if (this._skillBtnContainer) { this.container.removeChild(this._skillBtnContainer); this._skillBtnContainer.destroy({ children: true }); this._skillBtnContainer = null }
    this._skillBtnCharges = -1
    this._actionHitAreas = []
    const slotBarBottom = this.logic.slotBar.startY + this.logic.slotBar.slotHeight
    const btnY2 = slotBarBottom + 8
    const btnH2 = 32
    const totalBtnW2 = this.screenW - 16
    const btnGap2 = 6
    const btnW2 = Math.floor((totalBtnW2 - btnGap2 * 3) / 4)
    let bx2 = 8
    // Undo
    const undoBtn2 = new Button(bx2, btnY2, btnW2, btnH2, '↩️ 撤回', { bgColor: '#2980B9', fontSize: 11, radius: 6 })
    this.container.addChild(undoBtn2.container)
    this._bottomBtnContainers.push(undoBtn2.container)
    this._actionHitAreas.push({ rect: undoBtn2.hitArea, cb: () => { this.logic.undoLastAction(); this.renderSlotBar(); this.renderHUD() } })
    bx2 += btnW2 + btnGap2
    // Shuffle
    const shuffleBtn2 = new Button(bx2, btnY2, btnW2, btnH2, '🔀 洗牌', { bgColor: '#16A085', fontSize: 11, radius: 6 })
    this.container.addChild(shuffleBtn2.container)
    this._bottomBtnContainers.push(shuffleBtn2.container)
    this._actionHitAreas.push({ rect: shuffleBtn2.hitArea, cb: () => {
      const oldPos: Record<string, { x: number; y: number }> = {}
      for (const [uid, view] of this.cardViews) oldPos[uid] = { x: view.container.x, y: view.container.y }
      this._shuffleOldPositions = oldPos
      this.logic.shuffleBoard()
      this.renderSlotBar()
    } })
    bx2 += btnW2 + btnGap2
    // Skill
    this._renderSkillButton(bx2, btnY2, btnW2, btnH2)
    bx2 += btnW2 + btnGap2
    // Pause
    const pauseBtn2 = new Button(bx2, btnY2, btnW2, btnH2, '⏸ 暂停', { bgColor: '#7F8C8D', fontSize: 11, radius: 6 })
    this.container.addChild(pauseBtn2.container)
    this._bottomBtnContainers.push(pauseBtn2.container)
    this._pauseHitArea = pauseBtn2.hitArea

    // Initial render
    this.renderSlotBar()
    if (levelId === 'level2') this._showDifficultyWarning()
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

    // Shuffle: batch animation (onUpdate-driven)
    if (this._shuffleOldPositions) {
      const oldPos = this._shuffleOldPositions
      this._shuffleOldPositions = null
      for (const view of views) {
        const op = oldPos[view.uid]
        if (op) {
          view.container.x = op.x; view.container.y = op.y
          this._shuffleCards.push({
            view, uid: view.uid,
            fromX: op.x, fromY: op.y,
            targetX: view.targetX, targetY: view.targetY,
            _startTime: Date.now() + 50 + Math.random() * 150,
            _animMs: 400,
          })
        } else { view.snapToTarget() }
      }
    } else if (this._firstRender) {
      this._firstRender = false
      for (let i = 0; i < views.length; i++) {
        const view = views[i]
        ;(view as any)._deckFromX = deckX; (view as any)._deckFromY = deckY
        view.container.x = deckX; view.container.y = deckY
        view.container.alpha = 0; view.container.scale.set(0.6)
        this._dealingCards.push({
          view, uid: view.uid,
          targetX: view.targetX, targetY: view.targetY,
          _fromX: deckX, _fromY: deckY,
          _startTime: Date.now() + view.layer * 60 + i * 5,
          _animMs: 350,
        })
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

          const img = createCardImage(flightCard.cardId, flightCard.icon,
            flightCard.type === 'event', flightCard.isRevealed, fw, fh)
          img.x = fx + fw / 2; img.y = fy + fh / 2
          this.slotLayer.addChild(img)
        } else {
          // Empty flight slot — always show ✈️
          fs.lineStyle(1.5, 0x3498DB, 0.45)
          fs.beginFill(0x5C4033, 0.18)
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
      // Position above normal bar (and above flight bar if present)
      const flightBarH = (freeClicks > 0 || hasFlightCards) ? bar.slotHeight * 0.75 + 30 : 0
      const holdH = bar.slotHeight  // same size as normal slots
      const holdY = bar.startY - holdH - 10 - flightBarH

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

          const hImg = createCardImage(hCard.cardId, hCard.icon,
            hCard.type === 'event', hCard.isRevealed, hw, holdH)
          hImg.x = hx + hw / 2; hImg.y = hy + holdH / 2
          this.slotLayer.addChild(hImg)
        } else {
          hs.lineStyle(1, 0x8E44AD, 0.25)
          hs.drawRoundedRect(hx, hy, hw, holdH, 6)
          this.slotLayer.addChild(hs)
        }
      }
    }

    // ── Normal slot bar ──
    const barBg = new PIXI.Graphics()
    barBg.beginFill(0x3C2820, 0.75)
    barBg.drawRoundedRect(barX, barY, barW, barH, 10)
    barBg.endFill()
    barBg.lineStyle(1, 0x6B5344, 0.6)
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
        const slotImg = createCardImage(slot.cardId, slot.icon,
          slot.type === 'event', slot.isRevealed, w, h)
        slotImg.x = x + w / 2; slotImg.y = y + h / 2
        this.slotLayer.addChild(slotImg)

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
        empty.lineStyle(1, 0x7A6B5D, 0.35)
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
      fontFamily: 'sans-serif', fontSize: 13, fill: '#9B8B7A',
    } as any)
    levelTxt.x = 10; levelTxt.y = 14
    this.hudLayer.addChild(levelTxt)

    // Steps — moved to left side to avoid notch
    const stepsUnlimited = bar.stepsUnlimited
    const stepsRemain = bar.stepsRemaining
    const stepsWarn = stepsRemain <= 5 && !stepsUnlimited
    const stepsDisplay = stepsUnlimited ? '∞' : String(stepsRemain)

    const stepsBg = new PIXI.Graphics()
    stepsBg.beginFill(stepsWarn ? 0xE74C3C : 0x5C4033, 0.75)
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
    const slotBarBtm = this.logic.slotBar.startY + this.logic.slotBar.slotHeight
    const bGap = 6; const bW = Math.floor((this.screenW - 16 - bGap * 3) / 4)
    this._renderSkillButton(8 + (bW + bGap) * 2, slotBarBtm + 8, bW, 32)

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
        if (typeof wx !== 'undefined') { wx.vibrateShort({ type: 'light' }) }

        // Calculate where the card will land in the slot bar
        const bar = this.logic.slotBar
        this.logic.onCardClicked(card.uid)

        // Find the slot index where the card was just placed
        let slotIdx = -1; let isFlight = false
        for (let i = 0; i < bar.maxSlots; i++) {
          if (bar.slots[i] && bar.slots[i]!.uid === card.uid) { slotIdx = i; break }
        }
        if (slotIdx === -1) {
          for (let i = 0; i < 3; i++) {
            if (bar.flightSlots[i] && bar.flightSlots[i]!.uid === card.uid) { slotIdx = i; isFlight = true; break }
          }
        }
        const targetX = isFlight
          ? bar.startX + slotIdx * (bar.slotWidth + bar.gap) + bar.slotWidth / 2
          : bar.startX + slotIdx * (bar.slotWidth + bar.gap) + bar.slotWidth / 2
        const targetY = isFlight
          ? bar.startY - bar.slotHeight - 10 + 18 + bar.slotHeight * 0.75 / 2
          : bar.startY + bar.slotHeight / 2

        // Fly card from board to slot, render slot bar after landing
        const cardView = this.cardViews.get(card.uid)
        if (cardView) {
          const startX = cardView.container.x
          const startY = cardView.container.y
          this._flyEffects.push({
            view: cardView, uid: card.uid,
            startX, startY, targetX, targetY,
            elapsed: 0, duration: 24,  // 24 frames ≈ 400ms
          })
        }
        if (!cardView) this.logic.slotBar.notifySlotChanged()
        this.renderHUD()
      }, card.layer)
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
        bg.beginFill(0x5C4033, alpha)
      }
      bg.drawRoundedRect(cx, cy, cardW, cardH, 10)
      bg.endFill()
      if (!isLegendary) {
        bg.lineStyle(1, 0xA08060, 0.3)
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
        fill: isLegendary ? '#E8C870' : '#9B8B7A',
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
    closeBg.beginFill(0x8B7355, 0.7)
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
      bg.beginFill(0x5C4033, 0.9)
      bg.drawRoundedRect(bx, by, btnW, btnH, 10)
      bg.endFill()
      bg.lineStyle(1, 0xA08060, 0.4)
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
        fontFamily: 'sans-serif', fontSize: 10, fill: '#A09080', align: 'center',
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
    if (result.won) {
      // Check if player needs to select fish after clearing Level 2
      if (this.levelId === 'level2' && !getCachedPond()) {
        wx.setStorageSync('fish_selection_shown', true)
        const { SelectFishScene } = require('./SelectFishScene')
        this.manager.replace(new SelectFishScene())
        return
      }

      // Set cleared level 2 flag
      if (this.levelId === 'level2') {
        wx.setStorageSync('cleared_level2', true)
      }

      // Report contribution (only for Level 2 clears)
      const cachedPond = getCachedPond()
      if (cachedPond && this.levelId === 'level2') {
        const avatarUrl = wx.getStorageSync('user_avatar') || ''
        console.log('[GameScene] 贡献: level2通关, avatarUrl=', avatarUrl)
        wx.cloud.callFunction({
          name: 'contribute',
          data: { avatarUrl }
        }).then((res: any) => {
          const d = (res as any).result
          console.log('[GameScene] contribute返回', JSON.stringify(d))
          if (d && d.ok) {
            setCachedPond({ ...cachedPond, todayContribution: d.todayContribution })
            wx.showToast({ title: `🐟 你为${d.pondName}+1条鱼！`, icon: 'none', duration: 2000 })
          }
        }).catch((e: any) => console.log('[GameScene] contribute失败', e))
      }

      // Check achievements
      wx.cloud.callFunction({ name: 'checkAchievements', data: {} }).then((res: any) => {
        if (res.result?.ok && res.result.newAchievements?.length > 0) {
          for (const ach of res.result.newAchievements) {
            wx.showToast({ title: `${ach.emoji} 获得称号：${ach.name}！`, icon: 'none', duration: 3000 })
          }
        }
      }).catch(() => {})

      // Level 1 auto-advances to Level 2 on win
      if (result.levelId === 'level1') {
        this._pendingTransition = { levelId: 'level2' }
        return
      }
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
