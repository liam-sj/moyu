import type { EventBus } from '../engine/EventBus'
import type { SkillConfig, SkillContext, SkillTriggeredEvent, EliminatedEvent } from './types'
import { getRandomSkills } from '../config/skills'
import { log } from '../utils/Logger'

const TAG = 'SkillSystem'

export class SkillSystem {
  private eliminateCount = 0
  private triggerThreshold = 3
  isShowingSelection = false
  private bus: EventBus

  constructor(bus: EventBus) {
    this.bus = bus
    this.bus.on<EliminatedEvent>('eliminated', () => this.onEliminate())
  }

  init(): void {
    this.eliminateCount = 0
    this.triggerThreshold = 3
    this.isShowingSelection = false
  }

  onEliminate(): void {
    this.eliminateCount++
    if (this.eliminateCount % this.triggerThreshold === 0) {
      this._showSelection()
    }
  }

  private _showSelection(): void {
    if (this.isShowingSelection) return
    this.isShowingSelection = true
    const skills = getRandomSkills(3)
    log(TAG, 'Skill selection: ' + skills.map(s => s.name).join(', '))
    this.bus.emit<SkillTriggeredEvent>('skillTriggered', { skills })
  }

  selectSkill(skill: SkillConfig, ctx: SkillContext): void {
    this.isShowingSelection = false
    log(TAG, 'Player selected: ' + skill.name)
    skill.apply(ctx)
    this.bus.emit('skillApplied', { skill })
  }

  reset(): void {
    this.init()
  }
}
