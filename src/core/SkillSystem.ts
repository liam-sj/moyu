import type { EventBus } from '../engine/EventBus'
import type { SkillConfig, SkillContext, SkillTriggeredEvent, EliminatedEvent } from './types'
import { getAllSkills } from '../config/skills'
import { log } from '../utils/Logger'

const TAG = 'SkillSystem'

export class SkillSystem {
  private eliminateCount = 0
  private triggerThreshold = 3
  /** Charges available for the player to use a skill */
  charges = 0
  /** Maximum charges that can be accumulated */
  maxCharges = 5
  /** Set of skill IDs already used this game */
  usedSkills = new Set<string>()
  isShowingSelection = false
  private bus: EventBus

  constructor(bus: EventBus) {
    this.bus = bus
    this.bus.on<EliminatedEvent>('eliminated', () => this.onEliminate())
  }

  init(): void {
    this.eliminateCount = 0
    this.triggerThreshold = 3
    this.charges = 0
    this.usedSkills.clear()
    this.isShowingSelection = false
  }

  onEliminate(): void {
    this.eliminateCount++
    if (this.eliminateCount % this.triggerThreshold === 0) {
      if (this.charges < this.maxCharges) {
        this.charges++
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
    log(TAG, 'Skill panel opened, available: ' + available.length + ', charges: ' + this.charges)
    this.bus.emit<SkillTriggeredEvent>('skillTriggered', { skills: available })
  }

  selectSkill(skill: SkillConfig, ctx: SkillContext): void {
    if (this.charges <= 0) return  // need charges to use
    this.isShowingSelection = false
    this.usedSkills.add(skill.id)
    this.charges--
    log(TAG, 'Player used: ' + skill.name + ' (charges left: ' + this.charges + ')')
    skill.apply(ctx)
    this.bus.emit('skillApplied', { skill })
  }

  reset(): void {
    this.init()
  }
}
