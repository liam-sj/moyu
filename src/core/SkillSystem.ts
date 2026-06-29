import type { EventBus } from '../engine/EventBus'
import type { SkillConfig, SkillContext, SkillTriggeredEvent, EliminatedEvent } from './types'
import { getAllSkills } from '../config/skills'
import { log } from '../utils/Logger'

const TAG = 'SkillSystem'

export class SkillSystem {
  private eliminateCount = 0
  private triggerThreshold = 1
  /** Charges available for the player to use a skill */
  charges = 0
  /** Maximum charges that can be accumulated */
  maxCharges = 5
  /** Progress ratio toward next charge (0-1) */
  get chargeProgress(): number {
    return (this.eliminateCount % this.triggerThreshold) / this.triggerThreshold
  }
  /** Set of skill IDs already used this game */
  usedSkills = new Set<string>()
  isShowingSelection = false
  private bus: EventBus
  private _unsubEliminated: (() => void) | null = null

  constructor(bus: EventBus) {
    this.bus = bus
    this._unsubEliminated = this.bus.on<EliminatedEvent>('eliminated', () => this.onEliminate())
  }

  /** Unregister event listeners so this instance stops responding to bus events */
  destroy(): void {
    if (this._unsubEliminated) {
      this._unsubEliminated()
      this._unsubEliminated = null
    }
  }

  init(): void {
    this.eliminateCount = 0
    this.triggerThreshold = 5
    this.charges = 0
    this.usedSkills.clear()
    this.isShowingSelection = false
  }

  onEliminate(): void {
    this.eliminateCount++
    console.log(`[SkillSystem] eliminated #${this.eliminateCount} (threshold=${this.triggerThreshold})`)
    if (this.eliminateCount % this.triggerThreshold === 0) {
      if (this.charges < this.maxCharges) {
        this.charges++
        console.log(`[SkillSystem] ⚡ charge gained (${this.charges}/${this.maxCharges})`)
        log(TAG, `Skill charge gained (${this.charges}/${this.maxCharges})`)
      }
    }
  }

  /** Player clicked the skill button — always show the panel */
  openSkillPanel(): void {
    if (this.isShowingSelection) return
    this.isShowingSelection = true
    const all = getAllSkills()
    const available = all.filter(s => !this.usedSkills.has(s.id))
    console.log(`[SkillSystem] panel opened charges=${this.charges} available=${available.length}`)
    log(TAG, 'Skill panel opened, available: ' + available.length + ', charges: ' + this.charges)
    this.bus.emit<SkillTriggeredEvent>('skillTriggered', { skills: available })
  }

  selectSkill(skill: SkillConfig, ctx: SkillContext): void {
    console.log(`[SkillSystem] selectSkill charges=${this.charges} skill=${skill.name}`)
    if (this.charges <= 0) return  // need charges to use
    this.isShowingSelection = false
    this.usedSkills.add(skill.id)
    this.charges--
    console.log(`[SkillSystem] ✅ skill used: ${skill.name} (charges left: ${this.charges})`)
    log(TAG, 'Player used: ' + skill.name + ' (charges left: ' + this.charges + ')')
    skill.apply(ctx)
    this.bus.emit('skillApplied', { skill })
  }

  reset(): void {
    this.init()
  }
}
