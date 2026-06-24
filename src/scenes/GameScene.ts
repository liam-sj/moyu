import * as PIXI from 'pixi.js-legacy'
import { Scene } from '../engine/Scene'
import { GameLogic } from '../core/GameLogic'
import { CardView, createCardImage } from '../views/CardView'
import { getLevelConfig } from '../config/levels'
import type {
  BoardCard, GameResult, SkillConfig,
  BoardInitEvent, StepsChangedEvent,
  CardToSlotEvent, BoardChangedEvent,
  EliminatedEvent, SkillTriggeredEvent, GameOverEvent
} from '../core/types'
import { getRandomFishId, FISH_TYPES } from '../config/waters'
import logger from '../utils/Logger'
import { AudioManager } from '../utils/AudioManager'
import { GameOverlayView } from './overlays/GameOverlayView'
import { GameAnimations } from '../views/GameAnimations'
import { GameSlotView } from '../views/GameSlotView'
import { createIconButton } from '../views/IconButtons'

export class GameScene extends Scene {
  private logic!: GameLogic
  private overlayView!: GameOverlayView
  private animations!: GameAnimations
  private slotView!: GameSlotView
  private boardLayer = new PIXI.Container()
  private slotLayer = new PIXI.Container()
  private hudLayer = new PIXI.Container()
  cardViews = new Map<string, CardView>()

  private levelId = 'level1'
  screenW = 0
  screenH = 0

  private _settingsOverlay: PIXI.Container | null = null
  _settingsAreas: Array<{ rect: { x: number; y: number; w: number; h: number }; cb: () => void }> = []
  _musicOn = true
  _vibrateOn = true

  _loadSettings(): void {
    try {
      if (typeof wx !== 'undefined') {
        this._musicOn = wx.getStorageSync('settings_music') !== false
        this._vibrateOn = wx.getStorageSync('settings_vibrate') !== false
      }
    } catch { /* use defaults */ }
  }
  _saveSettings(): void {
    try {
      if (typeof wx !== 'undefined') {
        wx.setStorageSync('settings_music', this._musicOn)
        wx.setStorageSync('settings_vibrate', this._vibrateOn)
      }
    } catch { /* ignore */ }
  }
  private _actionHitAreas: Array<{ rect: { x: number; y: number; w: number; h: number }; cb: () => void }> = []
  private _bottomBtnContainers: PIXI.Container[] = []

  // Skill popup state (used by GameOverlayView via OverlayHost)
  pendingSkills: SkillConfig[] | null = null
  skillHitAreas: Array<{ rect: { x: number; y: number; w: number; h: number }; callback: () => void }> = []
  skillOverlay: PIXI.Graphics | null = null
  skillPopupElements: PIXI.Container[] = []

  // Board state
  private _pendingTransition: { levelId: string } | null = null
  _firstRender = true
  _shuffleOldPositions: Record<string, { x: number; y: number }> | null = null

  // Func card reveal state
  _funcCardRevealOverlay: PIXI.Container | null = null
  _funcCardRevealPanel: PIXI.Container | null = null
  _funcCardRevealHitRect: { x: number; y: number; w: number; h: number } | null = null
  _funcCardRevealCallback: (() => void) | null = null

  // Result / pond picker state (used by GameOverlayView)
  _resultArea: Array<{ rect: { x: number; y: number; w: number; h: number }; cb: () => void }> = []
  _pondPickerAreas: Array<{ rect: { x: number; y: number; w: number; h: number }; cb: () => void }> = []
  _celebrationAreas: Array<{ rect: { x: number; y: number; w: number; h: number }; cb: () => void }> = []
  _joiningPond = false

  onEnter(params?: unknown): void {
    this.levelId = (params as any)?.levelId || 'level1'

    const sysInfo = wx.getSystemInfoSync()
    this.screenW = sysInfo.windowWidth
    this.screenH = sysInfo.windowHeight

    this.slotView = new GameSlotView(this.container, this.slotLayer, this.hudLayer)
    this.animations = new GameAnimations(this.container)
    this.animations.onFlyLanded = (uid) => { this.slotView.flyingUids.delete(uid) }
    this.overlayView = new GameOverlayView(this as any)

    this._loadSettings()
    if (!this._musicOn) AudioManager.pause()

    this.container.addChild(this.boardLayer)
    this.container.addChild(this.slotLayer)
    this.container.addChild(this.hudLayer)
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
      bg.alpha = 0.9
      this.container.addChildAt(bg, 0)
    }
    bgImg.src = 'assets/guanqia4.jpg'

    // Subscribe to events
    this.listen<BoardInitEvent>('boardInit', (e) => this.renderBoard(e.cards))
    this.listen<StepsChangedEvent>('stepsChanged', () => this.slotView.renderHUD())
    this.listen<CardToSlotEvent>('cardToSlot', () => this.slotView.renderSlotBar())
    this.listen<BoardChangedEvent>('boardChanged', (e) => this.syncBlocked(e.cards))
    this.listen<EliminatedEvent>('eliminated', (e) => this.onEliminated(e))
    this.listen<SkillTriggeredEvent>('skillTriggered', (e) => this.showSkillSelection(e.skills))
    this.listen<GameOverEvent>('gameOver', (e) => this.onGameOver(e))
    this.listen('slotChanged', () => this.slotView.renderSlotBar())
    this.listen<{ cardTypes: string[] }>('selectCardType', (e) => this.showCardTypeSelection(e.cardTypes))

    // Initialize logic
    const config = getLevelConfig(this.levelId)
    this.logic = new GameLogic(config, this.bus)

    // Sync views BEFORE init (init emits events that need slotView.logic)
    this.slotView.logic = this.logic
    this.slotView.screenW = this.screenW
    this.slotView.screenH = this.screenH
    this.slotView.levelId = this.levelId
    this.slotView.settingsCallback = () => { this._showSettingsPopup() }

    this.logic.init(this.screenW, this.screenH)

    // Buttons below slot bar
    this._actionHitAreas = []
    this._bottomBtnContainers = []
    const slotBarBottom = this.logic.slotBar.startY + this.logic.slotBar.slotHeight
    const btnY = slotBarBottom + 8
    const btnH = 32
    const totalBtnW = this.screenW - 16
    const btnGap = 8
    const btnW = Math.floor((totalBtnW - btnGap * 2) / 3)

    const iconSize = Math.min(btnH - 4, 28)
    let bx = 8
    // Undo (icon index 0)
    const undoIcon = createIconButton(0, bx + (btnW - iconSize) / 2, btnY + (btnH - iconSize) / 2, iconSize)
    this.container.addChild(undoIcon)
    this._bottomBtnContainers.push(undoIcon)
    this._actionHitAreas.push({ rect: { x: bx, y: btnY, w: btnW, h: btnH }, cb: () => { this.logic.undoLastAction(); this.slotView.renderSlotBar(); this.slotView.renderHUD() } })

    bx += btnW + btnGap
    // Shuffle (icon index 1)
    const shuffleIcon = createIconButton(1, bx + (btnW - iconSize) / 2, btnY + (btnH - iconSize) / 2, iconSize)
    this.container.addChild(shuffleIcon)
    this._bottomBtnContainers.push(shuffleIcon)
    this._actionHitAreas.push({ rect: { x: bx, y: btnY, w: btnW, h: btnH }, cb: () => {
      const oldPos: Record<string, { x: number; y: number }> = {}
      for (const [uid, view] of this.cardViews) oldPos[uid] = { x: view.container.x, y: view.container.y }
      this._shuffleOldPositions = oldPos
      this.logic.shuffleBoard()
      this.slotView.renderSlotBar()
    } })

    // Initial render
    this.slotView.renderHUD()
    this.slotView.renderSlotBar()

    if (this.levelId === 'level2') {
      this.overlayView.showDifficultyWarning()
    }

    logger.info('GameScene', 'entered, level=' + this.levelId)
  }

  onUpdate(dt: number): void {
    this.animations.update(dt, this.cardViews, this.logic.slotBar)

    if (this._pendingTransition) {
      const t = this._pendingTransition
      this._pendingTransition = null
      this._resetLevel(t.levelId)
      return
    }

    // Re-register hit areas every frame
    if (this.slotView.skillHitArea && this.slotView.skillCallback) {
      this.registerHitArea(this.slotView.skillHitArea, this.slotView.skillCallback, 15)
    }
    if (this.slotView.settingsHitArea && this.slotView.settingsCallback) {
      this.registerHitArea(this.slotView.settingsHitArea, this.slotView.settingsCallback, 16)
    }
    for (const item of this._settingsAreas) {
      this.registerHitArea(item.rect, item.cb, 30)
    }
    for (const item of this._actionHitAreas) {
      this.registerHitArea(item.rect, item.cb, 12)
    }

    // Func card reveal popup — tap anywhere or auto-dismiss
    if (this._funcCardRevealCallback) {
      const rect = (this as any)._funcCardRevealFullScreen
        ? { x: 0, y: 0, w: this.screenW, h: this.screenH }
        : (this._funcCardRevealHitRect || { x: 0, y: 0, w: this.screenW, h: this.screenH })
      this.registerHitArea(rect, () => {
        const cb = this._funcCardRevealCallback!
        if (this._funcCardRevealOverlay) { this.container.removeChild(this._funcCardRevealOverlay); this._funcCardRevealOverlay.destroy() }
        if (this._funcCardRevealPanel) { this.container.removeChild(this._funcCardRevealPanel); this._funcCardRevealPanel.destroy({ children: true }) }
        this._funcCardRevealOverlay = null
        this._funcCardRevealPanel = null
        this._funcCardRevealHitRect = null
        this._funcCardRevealCallback = null
        ;(this as any)._funcCardRevealFullScreen = false
        cb()
      }, 35)
    }

    if (this._resultArea.length > 0) {
      for (const item of this._resultArea) this.registerHitArea(item.rect, item.cb, 30)
      return
    }
    if (this._pondPickerAreas.length > 0) {
      for (const item of this._pondPickerAreas) this.registerHitArea(item.rect, item.cb, 25)
      return
    }
    if (this._celebrationAreas.length > 0) {
      for (const item of this._celebrationAreas) this.registerHitArea(item.rect, item.cb, 30)
      return
    }
    if (this.skillOverlay) {
      for (const item of this.skillHitAreas) {
        this.registerHitArea(item.rect, item.callback, 20)
      }
    } else {
      this.registerCardHitAreas()
    }
  }

  // ── Delegations to extracted views ──

  renderSlotBar(): void { this.slotView.renderSlotBar() }
  renderHUD(): void { this.slotView.renderHUD() }
  private _showDifficultyWarning(): void { this.overlayView.showDifficultyWarning() }
  private showSkillSelection(skills: SkillConfig[]): void { this.overlayView.showSkillSelection(skills) }
  _dismissSkillPanel(): void {
    if (this.skillOverlay) { this.container.removeChild(this.skillOverlay); this.skillOverlay = null }
    for (const el of this.skillPopupElements) { this.container.removeChild(el) }
    this.skillPopupElements = []
    this.skillHitAreas = []
    this.pendingSkills = null
    this.logic.skillSystem.isShowingSelection = false
  }
  private showCardTypeSelection(cardTypes: string[]): void { this.overlayView.showCardTypeSelection(cardTypes) }
  private _showFishResult(fishId: string, fishInfo: { name: string; emoji: string }): void { this.overlayView.showFishResult(fishId, fishInfo) }

  // _playFishSparkles delegated to animations (called by GameOverlayView via OverlayHost)
  _playFishSparkles(x: number, y: number): void { this.animations.playFishSparkles(x, y) }

  onDestroy(): void {
    this.animations.reset()
    this.boardLayer.removeChildren()
    this.slotLayer.removeChildren()
    this.hudLayer.removeChildren()
    for (const [_, view] of this.cardViews) view.destroy()
    this.cardViews.clear()
  }

  // ── Level management ──

  private _resetLevel(levelId: string): void {
    this.levelId = levelId
    for (const [_, view] of this.cardViews) view.destroy()
    this.cardViews.clear()

    this.animations.reset()

    this._firstRender = true
    this.boardLayer.removeChildren()
    this.slotLayer.removeChildren()
    this.hudLayer.removeChildren()

    this.logic.skillSystem.destroy()
    this.logic.skillSystem.reset()

    this._resultArea = []
    this._pondPickerAreas = []
    this._celebrationAreas = []
    this._joiningPond = false
    this._funcCardRevealOverlay = null
    this._funcCardRevealPanel = null
    this._funcCardRevealHitRect = null
    this._funcCardRevealCallback = null
    ;(this as any)._funcCardRevealFullScreen = false
    this._closeSettingsPopup()

    const config = getLevelConfig(levelId)
    this.logic = new GameLogic(config, this.bus)

    // Sync views BEFORE init (init emits events that need slotView.logic)
    this.slotView.logic = this.logic
    this.slotView.screenW = this.screenW
    this.slotView.screenH = this.screenH
    this.slotView.levelId = levelId
    this.slotView.settingsCallback = () => { this._showSettingsPopup() }
    this.slotView.clearSkillButton()

    this.logic.init(this.screenW, this.screenH)

    for (const c of this._bottomBtnContainers) {
      this.container.removeChild(c); c.destroy({ children: true })
    }
    this._bottomBtnContainers = []
    this._actionHitAreas = []
    this._debugHitRect = null
    this._debugHitCb = null

    const slotBarBottom = this.logic.slotBar.startY + this.logic.slotBar.slotHeight
    const btnY2 = slotBarBottom + 8
    const btnH2 = 32
    const totalBtnW2 = this.screenW - 16
    const btnGap2 = 8
    const btnW2 = Math.floor((totalBtnW2 - btnGap2 * 2) / 3)
    let bx2 = 8

    const iconSize2 = Math.min(btnH2 - 4, 28)
    const uIcon2 = createIconButton(0, bx2 + (btnW2 - iconSize2) / 2, btnY2 + (btnH2 - iconSize2) / 2, iconSize2)
    this.container.addChild(uIcon2)
    this._bottomBtnContainers.push(uIcon2)
    this._actionHitAreas.push({ rect: { x: bx2, y: btnY2, w: btnW2, h: btnH2 }, cb: () => { this.logic.undoLastAction(); this.slotView.renderSlotBar(); this.slotView.renderHUD() } })

    bx2 += btnW2 + btnGap2
    const sIcon2 = createIconButton(1, bx2 + (btnW2 - iconSize2) / 2, btnY2 + (btnH2 - iconSize2) / 2, iconSize2)
    this.container.addChild(sIcon2)
    this._bottomBtnContainers.push(sIcon2)
    this._actionHitAreas.push({ rect: { x: bx2, y: btnY2, w: btnW2, h: btnH2 }, cb: () => {
      const oldPos: Record<string, { x: number; y: number }> = {}
      for (const [uid, view] of this.cardViews) oldPos[uid] = { x: view.container.x, y: view.container.y }
      this._shuffleOldPositions = oldPos
      this.logic.shuffleBoard()
      this.slotView.renderSlotBar()
    } })

    this.slotView.renderHUD()
    this.slotView.renderSlotBar()

    if (levelId === 'level2') this.overlayView.showDifficultyWarning()
  }

  // ── Board rendering ──

  private renderBoard(cards: BoardCard[]): void {
    this.boardLayer.removeChildren()
    this.cardViews.clear()

    const board = this.logic.board
    const deckX = this.screenW / 2
    const deckY = board.offsetY - 60

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

    if (this._shuffleOldPositions) {
      const oldPos = this._shuffleOldPositions
      this._shuffleOldPositions = null
      for (const view of views) {
        const op = oldPos[view.uid]
        if (op) {
          view.container.x = op.x; view.container.y = op.y
          this.animations.shuffleCards.push({
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
      const isDeep = this.levelId !== 'level1'
      const layerDelay = isDeep ? 80 : 60
      const cardDelay = isDeep ? 8 : 5
      const animMs = isDeep ? 500 : 350
      for (let i = 0; i < views.length; i++) {
        const view = views[i]
        view.container.x = deckX; view.container.y = deckY
        view.container.alpha = 0; view.container.scale.set(0.4)
        this.animations.dealingCards.push({
          view, uid: view.uid,
          targetX: view.targetX, targetY: view.targetY,
          _fromX: deckX, _fromY: deckY,
          _startTime: Date.now() + view.layer * layerDelay + i * cardDelay,
          _animMs: animMs,
        })
      }
    } else {
      for (const view of views) view.snapToTarget()
    }
  }

  private syncBlocked(cards: Array<{ uid: string; blocked: boolean }>): void {
    for (const { uid, blocked } of cards) {
      const view = this.cardViews.get(uid)
      if (view) view.setCovered(blocked)
    }
  }

  // ── Card hit areas ──

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
        x: hx, y: hy, w: board.cardWidth, h: board.cardHeight,
      }, () => {
        if (typeof wx !== 'undefined' && this._vibrateOn) { wx.vibrateShort({ type: 'light' }) }

        const isEvent = card.type === 'event'

        // Event cards: show reveal popup first, then process
        if (isEvent) {
          this.overlayView.showFuncCardReveal(card, () => {
            this._processCardClick(card, board)
          })
          return
        }

        this._processCardClick(card, board)
      }, card.layer)
    }
  }

  /** Process card click: detach from board, call logic, create fly animation */
  private _processCardClick(card: BoardCard, board: { cardWidth: number; staggerLayers: boolean }): void {
    const cardView = this.cardViews.get(card.uid)
    const startX = cardView ? cardView.container.x : 0
    const startY = cardView ? cardView.container.y : 0
    const isEvent = card.type === 'event'

    if (cardView) {
      this.boardLayer.removeChild(cardView.container)
      this.container.addChild(cardView.container)
    }

    const bar = this.logic.slotBar
    this.logic.onCardClicked(card.uid)

    let slotIdx = -1; let isFlight = false
    for (let i = 0; i < bar.maxSlots; i++) {
      if (bar.slots[i] && bar.slots[i]!.uid === card.uid) { slotIdx = i; break }
    }
    if (slotIdx === -1) {
      for (let i = 0; i < 3; i++) {
        if (bar.flightSlots[i] && bar.flightSlots[i]!.uid === card.uid) { slotIdx = i; isFlight = true; break }
      }
    }
    const slotCenterX = bar.startX + slotIdx * (bar.slotWidth + bar.gap) + bar.slotWidth / 2
    const slotCenterY = isFlight
      ? bar.startY - bar.slotHeight - 10 + 18 + bar.slotHeight * 0.75 / 2
      : bar.startY + bar.slotHeight / 2

    if (cardView && slotIdx !== -1) {
      const targetScale = Math.min(bar.slotWidth, bar.slotHeight) / board.cardWidth
      const halfScaled = (board.cardWidth * targetScale) / 2
      const targetX = slotCenterX - halfScaled
      const targetY = slotCenterY - halfScaled
      this.slotView.flyingUids.add(card.uid)
      this.animations.flyEffects.push({
        view: cardView, uid: card.uid,
        startX, startY, targetX, targetY, targetScale,
        elapsed: 0, duration: 24,
        flipElapsed: 0,
        flipDuration: 0,
        holdDuration: 0,
        flipDone: true,
        holdDone: true,
        flipFaceRedrawn: false,
      })
    }
    if (!cardView || slotIdx === -1) this.logic.slotBar.notifySlotChanged()
    this.slotView.renderHUD()
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
    this.slotView.renderSlotBar()
    this.slotView.renderHUD()

    const bar = this.logic.slotBar
    const fx = bar.startX + (bar.maxSlots * bar.slotWidth + (bar.maxSlots - 1) * bar.gap) / 2
    const fy = bar.startY + bar.slotHeight / 2
    this.animations.playEliminationEffect(fx, fy)

    this.logic.onEliminate(e.count)
  }

  // ── Settings ──

  private _showSettingsPopup(): void {
    if (this.levelId === 'level2') {
      // Build settings with debug button inline
      this._addDebugSettings()
    } else {
      this.overlayView.showSettingsPopup()
    }
  }

  private _addDebugSettings(): void {
    if (this._settingsOverlay) return
    const self = this
    const { PopupView } = require('../views/PopupView')
    const popup = new PopupView(this.screenW, this.screenH, 230, {
      title: '⚙️ 设置', width: 240, closable: true,
      onClose: () => { self._settingsOverlay = null; self._settingsAreas = [] }
    })
    this._settingsOverlay = popup.container
    this._settingsAreas = popup.hitAreas

    const cw = popup.cardW - 32
    const drawRow = (y: number, label: string, value: string, valueColor: string, onClick?: () => void) => {
      const rowH = 36
      const bg = new PIXI.Graphics()
      bg.beginFill(0xFFFFFF, 0.08)
      bg.drawRoundedRect(0, y, cw, rowH, 8)
      bg.endFill()
      popup.content.addChild(bg)
      const lt = new PIXI.Text(label, { fontFamily: 'sans-serif', fontSize: 15, fill: '#FFFFFF' } as any)
      lt.x = 12; lt.y = y + (rowH - 15) / 2
      popup.content.addChild(lt)
      const vt = new PIXI.Text(value, { fontFamily: 'sans-serif', fontSize: 13, fill: valueColor } as any)
      vt.anchor.set(1, 0); vt.x = cw - 12; vt.y = y + (rowH - 13) / 2
      popup.content.addChild(vt)
      if (onClick) popup.addHitArea(0, y, cw, rowH, onClick)
      return y + rowH + 4
    }

    let cy = 0
    cy = drawRow(cy, '🎵 音乐', this._musicOn ? '🟢 开' : '⚫ 关',
      this._musicOn ? '#2ECC71' : '#7F8C8D', () => {
        this._musicOn = !this._musicOn; this._saveSettings()
        if (this._musicOn) AudioManager.resume(); else AudioManager.pause()
        this._closeSettingsPopup(); this._addDebugSettings()
      })
    cy = drawRow(cy, '📳 震动', this._vibrateOn ? '🟢 开' : '⚫ 关',
      this._vibrateOn ? '#2ECC71' : '#7F8C8D', () => {
        this._vibrateOn = !this._vibrateOn; this._saveSettings()
        this._closeSettingsPopup(); this._addDebugSettings()
      })

    // Debug: one-click win
    cy += 8
    const dbgBg = new PIXI.Graphics()
    dbgBg.beginFill(0x2ECC71, 0.75)
    dbgBg.drawRoundedRect(0, cy, cw, 36, 8)
    dbgBg.endFill()
    popup.content.addChild(dbgBg)
    const dbgTxt = new PIXI.Text('🐛 调试通关', { fontFamily: 'sans-serif', fontSize: 14, fontWeight: 'bold', fill: '#FFFFFF' } as any)
    dbgTxt.anchor.set(0.5); dbgTxt.x = cw / 2; dbgTxt.y = cy + 18
    popup.content.addChild(dbgTxt)
    cy += 40
    popup.addHitArea(0, cy - 40, cw, 36, () => {
      this._closeSettingsPopup()
      this.logic.skillSystem.destroy()
      const fid = getRandomFishId()
      this._showFishResult(fid, FISH_TYPES[fid])
    })

    // Give up
    cy += 4
    const gbBg = new PIXI.Graphics()
    gbBg.beginFill(0xE74C3C, 0.75)
    gbBg.drawRoundedRect(0, cy, cw, 38, 8)
    gbBg.endFill()
    popup.content.addChild(gbBg)
    const gbTxt = new PIXI.Text('🚪 放弃挑战', { fontFamily: 'sans-serif', fontSize: 15, fontWeight: 'bold', fill: '#FFFFFF' } as any)
    gbTxt.anchor.set(0.5); gbTxt.x = cw / 2; gbTxt.y = cy + 19
    popup.content.addChild(gbTxt)
    popup.addHitArea(0, cy, cw, 38, () => {
      this._closeSettingsPopup()
      this.logic.skillSystem.destroy()
      const { MenuScene } = require('./MenuScene')
      this.manager.replace(new MenuScene())
    })

    this.container.addChild(popup.container)
  }
  _closeSettingsPopup(): void {
    if (this._settingsOverlay) {
      this.container.removeChild(this._settingsOverlay)
      this._settingsOverlay.destroy({ children: true })
      this._settingsOverlay = null
      this._settingsAreas = []
    }
  }

  // ── Skill selection ──

  private onSkillSelected(skill: SkillConfig): void {
    logger.info('GameScene', `onSkillSelected: ${skill.name} id=${skill.id} charges=${this.logic.skillSystem.charges}`)
    this._dismissSkillPanel()
    const ctx = this.logic.getSkillContext()
    this.logic.skillSystem.selectSkill(skill, ctx)
    this.slotView.renderHUD()
  }

  // ── Game over ──

  private onGameOver(result: GameResult): void {
    if (result.won) {
      if (this.levelId === 'level2') {
        const fishId = getRandomFishId()
        const fishInfo = FISH_TYPES[fishId]
        this._showFishResult(fishId, fishInfo)
        return
      }
      if (result.levelId === 'level1') {
        this._pendingTransition = { levelId: 'level2' }
        return
      }
    }
    const { ResultOverlay } = require('./overlays/ResultOverlay')
    this.manager.push(new ResultOverlay(result, () => {
      this.logic.revive()
      this.slotView.renderSlotBar()
      this.slotView.renderHUD()
    }))
  }
}
