import type { EventBus } from '../engine/EventBus'
import type { StepsChangedEvent } from './types'

export class StepManager {
  stepsRemaining: number
  maxSteps: number
  slotLimit: number
  baseSlotLimit: number
  slotFreeClicks = 0
  tempSlotLimit9 = 0
  slotOverflowShield = false
  stepsUnlimited = false
  slotUnlimited = false
  noMoreBossPatrol = false

  private bus: EventBus

  constructor(bus: EventBus) {
    this.bus = bus
    this.stepsRemaining = 35
    this.maxSteps = 35
    this.slotLimit = 7
    this.baseSlotLimit = 7
  }

  init(config: { steps: number; slotLimit: number }): void {
    this.stepsRemaining = config.steps
    this.maxSteps = config.steps
    this.slotLimit = config.slotLimit
    this.baseSlotLimit = config.slotLimit
    this.slotFreeClicks = 0
    this.tempSlotLimit9 = 0
    this.slotOverflowShield = false
    this.stepsUnlimited = false
    this.slotUnlimited = false
    this._emit()
  }

  useStep(): boolean {
    if (this.stepsUnlimited) return true
    if (this.stepsRemaining <= 0) return false
    this.stepsRemaining--
    this._emit()
    return true
  }

  occupiesSlot(): boolean {
    if (this.slotFreeClicks > 0) { this.slotFreeClicks--; return false }
    return true
  }

  getEffectiveSlotLimit(): number {
    if (this.slotUnlimited) return Infinity
    if (this.tempSlotLimit9 > 0) return 9
    return this.slotLimit
  }

  tick(): void {
    if (this.tempSlotLimit9 > 0) this.tempSlotLimit9--
  }

  checkFailure(slotFull: boolean, canEliminate: boolean): { isFailed: boolean; reason: string; shieldActivated: boolean } {
    if (!this.stepsUnlimited && this.stepsRemaining <= 0) {
      return { isFailed: true, reason: 'steps', shieldActivated: false }
    }
    if (!this.slotUnlimited && slotFull && !canEliminate) {
      if (this.slotOverflowShield) {
        this.slotOverflowShield = false
        return { isFailed: false, reason: '', shieldActivated: true }
      }
      return { isFailed: true, reason: 'slot_full', shieldActivated: false }
    }
    return { isFailed: false, reason: '', shieldActivated: false }
  }

  private _emit(): void {
    this.bus.emit<StepsChangedEvent>('stepsChanged', { remaining: this.stepsRemaining })
  }
}
