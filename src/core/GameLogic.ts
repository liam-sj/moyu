import type { EventBus } from '../engine/EventBus'
import type { LevelConfig, GameOverEvent, GameResult, NormalCardConfig, FuncCardConfig } from './types'
import { Board } from './Board'
import { SlotBar } from './SlotBar'
import { StepManager } from './StepManager'
import { SkillSystem } from './SkillSystem'
import { log } from '../utils/Logger'
import { FUNC_CARDS } from '../config/cards'

const TAG = 'GameLogic'

export class GameLogic {
  readonly board: Board
  readonly slotBar: SlotBar
  readonly stepManager: StepManager
  readonly skillSystem: SkillSystem

  private levelConfig: LevelConfig
  private bus: EventBus
  happyValue = 0
  eliminateGroupCount = 0
  consecutiveNegative = 0
  private over = false
  private _happyMultiplier: number | null = null
  private _happyMultiplierSteps = 0

  constructor(levelConfig: LevelConfig, bus: EventBus) {
    this.levelConfig = levelConfig
    this.bus = bus
    this.board = new Board(bus)
    this.slotBar = new SlotBar(levelConfig.slotLimit, bus)
    this.stepManager = new StepManager(bus)
    this.skillSystem = new SkillSystem(bus)
  }

  init(screenW: number, screenH: number): void {
    this.happyValue = 0
    this.eliminateGroupCount = 0
    this.over = false
    this.consecutiveNegative = 0
    this._happyMultiplier = null
    this._happyMultiplierSteps = 0

    const config = this.levelConfig
    this.board.calcLayout(screenW, screenH, config.gridRows, config.gridCols)
    this.slotBar.calcLayout(screenW, screenH)
    this.board.generate(config)
    this.slotBar.reset(config.slotLimit)
    this.stepManager.init(config)
    this.skillSystem.init()
  }

  onCardClicked(cardUid: string): void {
    if (this.over) return

    const card = this.board.removeCard(cardUid)
    if (!card) return

    if (!this.stepManager.useStep()) {
      this._endGame(false, '步数耗尽！')
      return
    }

    // Reveal event card
    if (card.type === 'event' && !card.isRevealed) {
      this._revealEventCard(card)
    }

    if (this.stepManager.occupiesSlot()) {
      if (!this.slotBar.addCard(card)) {
        this._checkFailure()
        return
      }
    } else {
      this.slotBar.addCard(card)
    }

    this.stepManager.tick()

    if (!this.board.hasCards()) {
      this._endGame(true, '棋盘清空！')
      return
    }

    this._checkFailure()
  }

  private _revealEventCard(card: any): void {
    if (this.consecutiveNegative >= 3) {
      const positiveCards = ['paid_leave', 'colleague_coffee', 'early_leave', 'boss_favor', 'reimburse']
      const pick = positiveCards[Math.floor(Math.random() * positiveCards.length)]
      for (const fc of FUNC_CARDS) {
        if (fc.id === pick) { card.config = fc; card.cardId = fc.id; break }
      }
      this.consecutiveNegative = 0
    }
    card.isRevealed = true
    const config = card.config as FuncCardConfig
    if (config.revealIcon) card.icon = config.revealIcon
    if (config.revealName) card.name = config.revealName

    this._applyFuncEffect(card)

    if (config.type === 'negative') this.consecutiveNegative++
    else this.consecutiveNegative = 0
  }

  private _applyFuncEffect(card: any): void {
    const effect = card.config.effect
    switch (effect) {
      case 'boss_patrol': {
        const slots = this.slotBar.slots
        const nonNull: number[] = []
        for (let i = 0; i < slots.length; i++) { if (slots[i]) nonNull.push(i) }
        if (nonNull.length > 0) {
          const target = nonNull[Math.floor(Math.random() * nonNull.length)]
          slots[target] = { uid: 'boss_patrol', type: 'event', config: card.config, cardId: 'boss_patrol', icon: '⚠️', name: '老板巡视', isRevealed: true }
        }
        this.bus.emit('slotChanged', {})
        break
      }
      case 'slot_limit_down': this.stepManager.slotLimit = Math.max(3, this.stepManager.slotLimit - 1); break
      case 'shuffle_slots': this.slotBar.shuffleSlots(); break
      case 'remove_most': this.slotBar.clearMostCardType(); break
      case 'add_steps_3': this.stepManager.stepsRemaining += 3; this.stepManager['_emit']?.(); break
      case 'double_happy_10': this._happyMultiplier = 2; this._happyMultiplierSteps = 10; break
      default: break
    }
  }

  onEliminate(count: number): void {
    let baseHappy = 10
    if (this._happyMultiplier && this._happyMultiplierSteps > 0) {
      baseHappy *= this._happyMultiplier
      this._happyMultiplierSteps--
      if (this._happyMultiplierSteps <= 0) this._happyMultiplier = null
    }
    this.happyValue += baseHappy
    this.eliminateGroupCount++
  }

  getSkillContext(): any {
    const self = this
    return {
      get slotFreeClicks() { return self.stepManager.slotFreeClicks },
      set slotFreeClicks(v: number) { self.stepManager.slotFreeClicks = v },
      get slotLimit() { return self.stepManager.slotLimit },
      set slotLimit(v: number) { self.stepManager.slotLimit = v },
      get clearMostInSlot() { return false },
      set clearMostInSlot(v: boolean) { if (v) self.slotBar.clearMostCardType() },
      get removeCoveredCards() { return 0 },
      set removeCoveredCards(v: number) { self.board.removeCoveredCards(v) },
      get transformToWild() { return 0 },
      set transformToWild(v: number) { if (v) self.slotBar.transformToWild() },
      get slotOverflowShield() { return self.stepManager.slotOverflowShield },
      set slotOverflowShield(v: boolean) { self.stepManager.slotOverflowShield = v },
      get stepsRemaining() { return self.stepManager.stepsRemaining },
      set stepsRemaining(v: number) { self.stepManager.stepsRemaining = v },
      get noMoreBossPatrol() { return self.stepManager.noMoreBossPatrol },
      set noMoreBossPatrol(v: boolean) { self.stepManager.noMoreBossPatrol = v },
      get revealAllEvents() { return false },
      set revealAllEvents(v: boolean) { if (v) self.board.revealAllEvents() },
      get tempSlotLimit9() { return self.stepManager.tempSlotLimit9 },
      set tempSlotLimit9(v: number) { self.stepManager.tempSlotLimit9 = v },
      get stepsUnlimited() { return self.stepManager.stepsUnlimited },
      set stepsUnlimited(v: boolean) { self.stepManager.stepsUnlimited = v },
      get slotUnlimited() { return self.stepManager.slotUnlimited },
      set slotUnlimited(v: boolean) { self.stepManager.slotUnlimited = v },
      selectAndClear: false,
      clearRandomRare: false,
      swapTwoInSlot: false,
      gainWildCard: false,
      extraSkillTrigger: false,
    }
  }

  private _checkFailure(): void {
    const slotFull = this.slotBar.isFull()

    let canEliminate = false
    const counts: Record<string, number> = {}
    for (let i = 0; i < this.slotBar.maxSlots; i++) {
      const s = this.slotBar.slots[i]; if (!s) continue
      counts[s.cardId] = (counts[s.cardId] || 0) + 1
    }
    for (const k in counts) { if (counts[k] >= 3) { canEliminate = true; break } }

    const result = this.stepManager.checkFailure(slotFull, canEliminate)
    if (result.shieldActivated) {
      this.slotBar.reset(this.slotBar.maxSlots)
      return
    }
    if (result.isFailed) {
      const reason = result.reason === 'steps' ? '步数耗尽！' : '被老板发现！'
      this._endGame(false, reason)
    }
  }

  private _endGame(won: boolean, reason: string): void {
    if (this.over) return
    this.over = true
    let bonusHappy = 0
    if (won) {
      bonusHappy += this.stepManager.stepsRemaining * 10
      if (this.slotBar.getVacantCount() >= 3) bonusHappy += 20
    }
    this.happyValue += bonusHappy
    const result: GameResult = {
      won,
      happiness: this.happyValue,
      reason,
      levelId: this.levelConfig.id,
      stepsUsed: this.stepManager.maxSteps - this.stepManager.stepsRemaining,
    }
    log(TAG, `Game over: won=${won}, happy=${this.happyValue}, reason=${reason}`)
    this.bus.emit<GameOverEvent>('gameOver', result)
  }
}
