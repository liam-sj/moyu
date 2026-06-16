import type { EventBus } from '../engine/EventBus'
import type { SlotCard, EliminatedEvent } from './types'
import type { BoardCard } from './types'
import { log } from '../utils/Logger'

const TAG = 'SlotBar'

export class SlotBar {
  slots: (SlotCard | null)[] = []
  maxSlots: number
  private bus: EventBus
  happiness = 0

  slotWidth = 56
  slotHeight = 72
  gap = 6
  startX = 0
  startY = 0

  constructor(maxSlots: number, bus: EventBus) {
    this.maxSlots = maxSlots
    this.bus = bus
    for (let i = 0; i < maxSlots; i++) this.slots.push(null)
  }

  calcLayout(screenW: number, screenH: number): void {
    const totalW = this.maxSlots * this.slotWidth + (this.maxSlots - 1) * this.gap
    this.startX = Math.floor((screenW - totalW) / 2)
    this.startY = screenH - 140
  }

  addCard(card: BoardCard): boolean {
    const emptyIdx = this.slots.findIndex(s => s === null)
    if (emptyIdx === -1) { log(TAG, 'Slot full'); return false }
    this.slots[emptyIdx] = {
      uid: card.uid,
      type: card.type,
      config: card.config,
      cardId: card.cardId,
      icon: card.icon,
      name: card.name,
      isRevealed: card.isRevealed,
    }
    this.bus.emit('slotChanged', {})
    this._checkMatch(card.cardId)
    return true
  }

  getVacantCount(): number {
    return this.slots.filter(s => s === null).length
  }

  isFull(): boolean { return this.getVacantCount() === 0 }

  private _checkMatch(cardId: string): void {
    const wildCards: number[] = []
    const sameCards: number[] = []
    for (let i = 0; i < this.maxSlots; i++) {
      const s = this.slots[i]
      if (!s) continue
      if (s.cardId === cardId) sameCards.push(i)
      if (s.type === 'event' && (s.config as any).effect === 'wild_card' && s.isRevealed) wildCards.push(i)
    }
    if (sameCards.length >= 3) {
      this._eliminate(sameCards.slice(0, 3))
      return
    }
    if (wildCards.length > 0 && (sameCards.length + wildCards.length) >= 3) {
      const needed = 3 - sameCards.length
      this._eliminate(sameCards.concat(wildCards.slice(0, needed)))
    }
  }

  private _eliminate(indices: number[]): void {
    const uids: string[] = []
    for (const i of indices) {
      if (this.slots[i]) {
        uids.push(this.slots[i]!.uid)
      }
      this.slots[i] = null
    }
    this.happiness += 10
    this.bus.emit<EliminatedEvent>('eliminated', { uids, happiness: this.happiness, count: indices.length })
  }

  clearMostCardType(): void {
    const counts: Record<string, number[]> = {}
    for (let i = 0; i < this.maxSlots; i++) {
      const s = this.slots[i]; if (!s) continue
      const key = s.cardId
      if (!counts[key]) counts[key] = []
      counts[key].push(i)
    }
    let maxKey: string | null = null, maxCount = 0
    for (const k in counts) { if (counts[k].length > maxCount) { maxCount = counts[k].length; maxKey = k } }
    if (maxKey) this._eliminate(counts[maxKey])
  }

  shuffleSlots(): void {
    const cards = this.slots.filter(s => s !== null) as SlotCard[]
    for (let j = cards.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1))
      ;[cards[j], cards[k]] = [cards[k], cards[j]]
    }
    let ci = 0
    for (let s = 0; s < this.maxSlots; s++) { if (this.slots[s]) this.slots[s] = cards[ci++] }
    this.bus.emit('slotChanged', {})
  }

  transformToWild(): void {
    for (let i = 0; i < this.maxSlots; i++) {
      if (this.slots[i] && this.slots[i]!.type !== 'event') {
        const c = this.slots[i]!
        c.type = 'event'
        c.cardId = 'paid_leave'
        c.icon = '🌟'
        c.name = '万能卡'
        c.config = { id: 'paid_leave', effect: 'wild_card', type: 'positive' } as any
        c.isRevealed = true
        break
      }
    }
    this.bus.emit('slotChanged', {})
  }

  reset(maxSlots?: number): void {
    if (maxSlots) this.maxSlots = maxSlots
    this.slots = []
    this.happiness = 0
    for (let i = 0; i < this.maxSlots; i++) this.slots.push(null)
  }
}
