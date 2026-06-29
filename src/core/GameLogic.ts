import type { EventBus } from '../engine/EventBus'
import type { LevelConfig, GameOverEvent, GameResult, NormalCardConfig, FuncCardConfig, BoardCard } from './types'
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
  /** Undo: last card moved from board to slot */
  private _lastAction: { card: BoardCard } | null = null

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
    this.board.calcLayout(screenW, screenH, config.gridRows, config.gridCols, config.layers, config.gapRatio || 0, config.verticalShift || 0)
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

    // Save for undo
    this._lastAction = { card: { ...card } }

    if (!this.stepManager.useStep()) {
      this._endGame(false, '步数耗尽！')
      return
    }

    // Reveal event card — if the effect already placed the card, skip addCard
    let cardConsumed = false
    if (card.type === 'event' && !card.isRevealed) {
      cardConsumed = this._revealEventCard(card)
    }

    // Flight mode: card goes to special flight slots above the bar
    if (cardConsumed) {
      // Card already placed by effect (e.g. boss_patrol), nothing more to do
    } else if (this.stepManager.slotFreeClicks > 0) {
      this.stepManager.slotFreeClicks--
      this.slotBar.addToFlightSlot(card)
    } else if (this.stepManager.occupiesSlot()) {
      if (!this.slotBar.addCard(card)) {
        // Card couldn't be placed — put it back before checking failure
        this.board.restoreCard(card)
        this.stepManager.stepsRemaining++
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

    // Deadlock guard: if all remaining cards are covered, force-uncover them
    if (this.board.getClickableCards().length === 0) {
      this.board.forceUncoverAll()
    }

    this._checkFailure()
  }

  /** Returns true if the card was already placed/handled by the effect */
  private _revealEventCard(card: any): boolean {
    // Pity system: after 3 consecutive negative reveals, force a positive card
    if (this.consecutiveNegative >= 3) {
      const positiveCards = FUNC_CARDS.filter(c => c.type === 'positive')
      if (positiveCards.length > 0) {
        const pick = positiveCards[Math.floor(Math.random() * positiveCards.length)]
        card.config = pick; card.cardId = pick.id
      }
      this.consecutiveNegative = 0
    }
    card.isRevealed = true
    const config = card.config as FuncCardConfig
    if (config.revealIcon) card.icon = config.revealIcon
    if (config.revealName) card.name = config.revealName

    const consumed = this._applyFuncEffect(card)

    if (config.type === 'negative') this.consecutiveNegative++
    else this.consecutiveNegative = 0

    return consumed
  }

  /** Returns true if the card was already placed in a slot by the effect (skip addCard) */
  private _applyFuncEffect(card: any): boolean {
    const effect = card.config.effect
    switch (effect) {
      case 'boss_patrol': {
        // Shark eats a random slot card, then disappears
        const slots = this.slotBar.slots
        const nonNull: number[] = []
        for (let i = 0; i < slots.length; i++) { if (slots[i]) nonNull.push(i) }
        if (nonNull.length > 0) {
          const target = nonNull[Math.floor(Math.random() * nonNull.length)]
          slots[target] = null
          this.bus.emit('slotChanged', {})
        }
        return true
      }
      case 'slot_limit_down': this.stepManager.slotLimit = Math.max(3, this.stepManager.slotLimit - 1); break
      case 'shuffle_slots': this.slotBar.shuffleSlots(); break
      case 'remove_most': this.slotBar.clearMostCardType(); break
      case 'add_steps_3': this.stepManager.stepsRemaining += 3; this.stepManager['_emit']?.(); break
      case 'double_happy_10': this._happyMultiplier = 2; this._happyMultiplierSteps = 10; break
      case 'swap_board_cards': this.board.swapTwoCards(); break
      case 'ink_slots': this.slotBar.inkRandomSlots(2); return true
      case 'wild_card': /* passive — matching handled by SlotBar */ break
      default: break
    }
    return false
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

  private _handleSelectAndClear(): void {
    const types = this.board.getCardTypesOnBoard()
    if (types.length === 0) return
    // Emit event so GameScene shows card-type selection UI
    this.bus.emit('selectCardType', { cardTypes: types })
  }

  /** Undo last card click: put card back on board, restore step */
  undoLastAction(): boolean {
    if (!this._lastAction) return false
    const a = this._lastAction
    this._lastAction = null

    const uid = a.card.uid
    // Find card in slot and remove it
    let removed = false
    for (let i = 0; i < this.slotBar.maxSlots; i++) {
      if (this.slotBar.slots[i] && this.slotBar.slots[i]!.uid === uid) {
        this.slotBar.slots[i] = null
        removed = true
        break
      }
    }
    if (!removed) {
      for (let i = 0; i < 3; i++) {
        if (this.slotBar.flightSlots[i] && this.slotBar.flightSlots[i]!.uid === uid) {
          this.slotBar.flightSlots[i] = null
          this.slotBar.flightSlotsUsed--
          removed = true
          break
        }
      }
    }
    if (!removed) return false

    this.board.restoreCard(a.card)
    this.stepManager.stepsRemaining++
    this.bus.emit('slotChanged', {})
    return true
  }

  /** Revive after failure: eject 3 cards, reset game-over flag */
  revive(): void {
    this.over = false
    this.slotBar.ejectFirstThree()
  }

  /** Shuffle remaining board cards */
  shuffleBoard(): void {
    this.board.shuffleBoard()
  }

  getSkillContext(): any {
    const self = this
    return {
      get slotFreeClicks() { return self.stepManager.slotFreeClicks },
      set slotFreeClicks(v: number) { self.stepManager.slotFreeClicks = v },
      get slotLimit() { return self.stepManager.slotLimit },
      set slotLimit(v: number) {
        self.stepManager.slotLimit = v
        // Sync visual: show a bonus slot above the bar
        self.slotBar.bonusSlotCount = v - self.stepManager.baseSlotLimit
        self.bus.emit('slotChanged', {})
      },
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
      get selectAndClear() { return false },
      set selectAndClear(v: boolean) {
        if (v) self._handleSelectAndClear()
      },
      get selectAndClearTarget() { return null },
      set selectAndClearTarget(cardId: string | null) {
        if (cardId) {
          // Remove from board
          self.board.removeAllOfType(cardId)
          // Remove from normal slots
          for (let i = 0; i < self.slotBar.maxSlots; i++) {
            if (self.slotBar.slots[i] && self.slotBar.slots[i]!.cardId === cardId) {
              self.slotBar.slots[i] = null
            }
          }
          // Remove from flight slots
          for (let i = 0; i < 3; i++) {
            if (self.slotBar.flightSlots[i] && self.slotBar.flightSlots[i]!.cardId === cardId) {
              self.slotBar.flightSlots[i] = null
              self.slotBar.flightSlotsUsed--
            }
          }
          // Remove from holding slots
          for (let i = 0; i < 3; i++) {
            if (self.slotBar.holdingSlots[i] && self.slotBar.holdingSlots[i]!.cardId === cardId) {
              self.slotBar.holdingSlots[i] = null
            }
          }
          self.bus.emit('slotChanged', {})
        }
      },
      clearRandomRare: false,
      swapTwoInSlot: false,
      gainWildCard: false,
      extraSkillTrigger: false,
      get ejectSlots() { return false },
      set ejectSlots(v: boolean) { if (v) self.slotBar.ejectFirstThree() },
    }
  }

  private _checkFailure(): void {
    const slotFull = this.slotBar.isFull()

    let canEliminate = false
    const counts: Record<string, number> = {}
    let wildCount = 0
    for (let i = 0; i < this.slotBar.slots.length; i++) {
      const s = this.slotBar.slots[i]; if (!s) continue
      if (s.type === 'event' && (s.config as any).effect === 'wild_card' && s.isRevealed)
        wildCount++
      else
        counts[s.cardId] = (counts[s.cardId] || 0) + 1
    }
    if (this.slotBar.bonusSlot) {
      const bs = this.slotBar.bonusSlot
      if (bs.type === 'event' && (bs.config as any).effect === 'wild_card' && bs.isRevealed)
        wildCount++
      else
        counts[bs.cardId] = (counts[bs.cardId] || 0) + 1
    }
    for (const h of this.slotBar.holdingSlots) {
      if (!h) continue
      if (h.type === 'event' && (h.config as any).effect === 'wild_card' && h.isRevealed)
        wildCount++
      else
        counts[h.cardId] = (counts[h.cardId] || 0) + 1
    }
    // Any type reaching 3 (with wild card help) means elimination is possible
    for (const k in counts) {
      if (counts[k] + wildCount >= 3) { canEliminate = true; break }
    }
    // 3 wild cards alone can match
    if (wildCount >= 3) canEliminate = true

    const result = this.stepManager.checkFailure(slotFull, canEliminate)
    if (result.shieldActivated) {
      this.slotBar.reset(this.slotBar.maxSlots)
      return
    }
    if (result.isFailed) {
      const reasonMap: Record<string, string> = {
        steps: '氧气耗尽！',
        slot_full: '鱼槽已满！',
      }
      const reason = reasonMap[result.reason] || '鱼槽已满！'
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
