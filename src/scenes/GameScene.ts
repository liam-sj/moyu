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

  // Skill popup state
  private pendingSkills: SkillConfig[] | null = null
  private skillHitAreas: Array<{ rect: { x: number; y: number; w: number; h: number }; callback: () => void }> = []
  private skillOverlay: PIXI.Graphics | null = null
  private skillPopupElements: PIXI.Container[] = []

  onEnter(params?: unknown): void {
    this.levelId = (params as any)?.levelId || 'level1'

    const sysInfo = wx.getSystemInfoSync()
    this.screenW = sysInfo.windowWidth
    this.screenH = sysInfo.windowHeight

    this.container.addChild(this.boardLayer)
    this.container.addChild(this.slotLayer)
    this.container.addChild(this.hudLayer)

    // Pause button
    const pauseBtn = new Button(this.screenW - 130, 8, 120, 44, '暂停', {
      bgColor: '#7F8C8D', fontSize: 16, radius: 6,
    })
    this.container.addChild(pauseBtn.container)
    this.registerHitArea(pauseBtn.hitArea, () => {
      const { PauseOverlay } = require('./overlays/PauseOverlay')
      this.manager.push(new PauseOverlay())
    }, 15)

    // Subscribe to events
    this.listen<BoardInitEvent>('boardInit', (e) => this.renderBoard(e.cards))
    this.listen<StepsChangedEvent>('stepsChanged', () => this.renderHUD())
    this.listen<CardToSlotEvent>('cardToSlot', () => this.renderSlotBar())
    this.listen<BoardChangedEvent>('boardChanged', (e) => this.syncBlocked(e.cards))
    this.listen<EliminatedEvent>('eliminated', (e) => this.onEliminated(e))
    this.listen<SkillTriggeredEvent>('skillTriggered', (e) => this.showSkillSelection(e.skills))
    this.listen<GameOverEvent>('gameOver', (e) => this.onGameOver(e))
    this.listen('slotChanged', () => this.renderSlotBar())

    // Initialize logic
    const config = getLevelConfig(this.levelId)
    this.logic = new GameLogic(config, this.bus)
    this.logic.init(this.screenW, this.screenH)
    log(TAG, 'GameScene entered, level=' + this.levelId)
  }

  onUpdate(_dt: number): void {
    if (!this.pendingSkills) {
      this.registerCardHitAreas()
    } else {
      for (const item of this.skillHitAreas) {
        this.registerHitArea(item.rect, item.callback, 20)
      }
    }
  }

  // ── Board rendering ──

  private renderBoard(cards: BoardCard[]): void {
    this.boardLayer.removeChildren()
    this.cardViews.clear()

    const board = this.logic.board
    for (const card of cards) {
      const view = new CardView(
        card, board.cardWidth, board.cardHeight,
        board.layerOffsetX, board.layerOffsetY,
        board.gap, board.offsetX, board.offsetY
      )
      this.boardLayer.addChild(view.container)
      this.cardViews.set(card.uid, view)
    }
  }

  private syncBlocked(cards: Array<{ uid: string; blocked: boolean }>): void {
    for (const { uid, blocked } of cards) {
      const view = this.cardViews.get(uid)
      if (view) view.container.alpha = blocked ? 0.4 : 1
    }
  }

  // ── Slot rendering ──

  private renderSlotBar(): void {
    this.slotLayer.removeChildren()

    const bar = this.logic.slotBar
    for (let i = 0; i < bar.maxSlots; i++) {
      const slot = bar.slots[i]
      const x = bar.startX + i * (bar.slotWidth + bar.gap)
      const y = bar.startY
      const w = bar.slotWidth; const h = bar.slotHeight

      const bg = new PIXI.Graphics()
      if (slot) {
        bg.beginFill(0xFFFFFF)
        bg.drawRoundedRect(x, y, w, h, 4)
        bg.endFill()
        const colorStr = getCardColor(slot)
        bg.lineStyle(1.5, hexToInt(colorStr), 0.8)
        bg.drawRoundedRect(x, y, w, h, 4)
        this.slotLayer.addChild(bg)

        const icon = (slot.type === 'event' && !slot.isRevealed) ? '❓' : slot.icon
        const iconTxt = new PIXI.Text(icon, {
          fontFamily: 'sans-serif', fontSize: 22, align: 'center',
        } as any)
        iconTxt.anchor.set(0.5); iconTxt.x = x + w / 2; iconTxt.y = y + h * 0.4
        this.slotLayer.addChild(iconTxt)

        const nameTxt = new PIXI.Text(slot.name, {
          fontFamily: 'sans-serif', fontSize: 10, fill: '#333', align: 'center',
        } as any)
        nameTxt.anchor.set(0.5); nameTxt.x = x + w / 2; nameTxt.y = y + h * 0.75
        this.slotLayer.addChild(nameTxt)
      } else {
        bg.lineStyle(1, 0xBDC3C7, 0.5)
        bg.drawRoundedRect(x, y, w, h, 4)
        this.slotLayer.addChild(bg)
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
      fontFamily: 'sans-serif', fontSize: 14, fill: '#BDC3C7',
    } as any)
    levelTxt.x = 10; levelTxt.y = 8
    this.hudLayer.addChild(levelTxt)

    const stepsColor = bar.stepsRemaining <= 5 ? '#E74C3C' : '#FFFFFF'
    const stepsTxt = new PIXI.Text('步数: ' + bar.stepsRemaining, {
      fontFamily: 'sans-serif', fontSize: 18, fontWeight: 'bold', fill: stepsColor,
    } as any)
    stepsTxt.anchor.set(0.5, 0); stepsTxt.x = w / 2; stepsTxt.y = 5
    this.hudLayer.addChild(stepsTxt)

    const happyTxt = new PIXI.Text('😊 ' + this.logic.happyValue, {
      fontFamily: 'sans-serif', fontSize: 16, fontWeight: 'bold', fill: '#F1C40F',
    } as any)
    happyTxt.anchor.set(1, 0); happyTxt.x = w - 10; happyTxt.y = 8
    this.hudLayer.addChild(happyTxt)

    let slotStatus = this.logic.slotBar.getVacantCount() + ' 空格'
    if (bar.slotFreeClicks > 0) slotStatus += ' | 🛡️飞行中×' + bar.slotFreeClicks
    if (bar.tempSlotLimit9 > 0) slotStatus += ' | 💤装死中×' + bar.tempSlotLimit9
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
      this.registerHitArea({
        x: view.container.x,
        y: view.container.y,
        w: board.cardWidth,
        h: board.cardHeight,
      }, () => {
        this.logic.onCardClicked(card.uid)
        this.renderSlotBar()
        this.renderHUD()
      }, 5)
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
    this.renderSlotBar()
    this.renderHUD()
    this.logic.onEliminate(e.count)
  }

  private showSkillSelection(skills: SkillConfig[]): void {
    this.pendingSkills = skills
    this.skillHitAreas = []

    const w = this.screenW; const h = this.screenH
    const overlay = new PIXI.Graphics()
    overlay.beginFill(0x000000, 0.6); overlay.drawRect(0, 0, w, h); overlay.endFill()
    this.container.addChild(overlay)
    this.skillOverlay = overlay

    const popupTitle = new PIXI.Text('🎯 选择技能', {
      fontFamily: 'sans-serif', fontSize: 24, fontWeight: 'bold', fill: '#F39C12', align: 'center',
    } as any)
    popupTitle.anchor.set(0.5); popupTitle.x = w / 2; popupTitle.y = h * 0.15
    this.container.addChild(popupTitle)
    this.skillPopupElements.push(popupTitle)

    const self = this
    const btnW = w - 60, btnH = 80, startY = h * 0.25, gap = 20

    for (let i = 0; i < skills.length; i++) {
      ;((skill: SkillConfig, idx: number) => {
        const y = startY + idx * (btnH + gap)
        const sc = new PIXI.Container()

        const bg = new PIXI.Graphics()
        bg.beginFill(0x34495E); bg.drawRoundedRect(30, y, btnW, btnH, 8); bg.endFill()
        sc.addChild(bg)

        const iconTxt = new PIXI.Text(skill.icon, {
          fontFamily: 'sans-serif', fontSize: 28, align: 'center',
        } as any)
        iconTxt.anchor.set(0.5); iconTxt.x = 70; iconTxt.y = y + btnH / 2
        sc.addChild(iconTxt)

        const nameTxt = new PIXI.Text(skill.name, {
          fontFamily: 'sans-serif', fontSize: 18, fontWeight: 'bold', fill: '#FFFFFF', align: 'left',
        } as any)
        nameTxt.x = 100; nameTxt.y = y + 12
        sc.addChild(nameTxt)

        const descTxt = new PIXI.Text(skill.desc, {
          fontFamily: 'sans-serif', fontSize: 13, fill: '#BDC3C7', align: 'left',
        } as any)
        descTxt.x = 100; descTxt.y = y + 40
        sc.addChild(descTxt)

        const tagTxt = new PIXI.Text(skill.tag, {
          fontFamily: 'sans-serif', fontSize: 11, fill: '#F39C12', align: 'right',
        } as any)
        tagTxt.anchor.set(1, 0.5); tagTxt.x = 30 + btnW - 15; tagTxt.y = y + btnH / 2
        sc.addChild(tagTxt)

        self.container.addChild(sc)
        self.skillPopupElements.push(sc)

        self.skillHitAreas.push({
          rect: { x: 30, y, w: btnW, h: btnH },
          callback: () => self.onSkillSelected(skill),
        })
      })(skills[i], i)
    }
  }

  private onSkillSelected(skill: SkillConfig): void {
    if (this.skillOverlay) { this.container.removeChild(this.skillOverlay); this.skillOverlay = null }
    for (const el of this.skillPopupElements) { this.container.removeChild(el) }
    this.skillPopupElements = []
    this.skillHitAreas = []
    this.pendingSkills = null

    const ctx = this.logic.getSkillContext()
    this.logic.skillSystem.selectSkill(skill, ctx)
    this.renderHUD()
  }

  private onGameOver(result: GameResult): void {
    const { ResultOverlay } = require('./overlays/ResultOverlay')
    this.manager.push(new ResultOverlay(result))
  }
}
