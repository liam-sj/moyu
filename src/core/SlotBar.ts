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

  // Flight mode slots (S1 skill)
  flightSlots: (SlotCard | null)[] = [null, null, null]
  flightSlotsUsed = 0

  // Holding area (移出 button) — up to 3 cards above the slot bar
  holdingSlots: (SlotCard | null)[] = [null, null, null]

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
    const margin = 16
    const availableW = screenW - margin * 2
    // Calculate slot width so all slots + gaps fit within available width
    this.slotWidth = Math.floor((availableW - (this.maxSlots - 1) * this.gap) / this.maxSlots)
    this.slotHeight = Math.floor(this.slotWidth * 1.25)
    const totalW = this.maxSlots * this.slotWidth + (this.maxSlots - 1) * this.gap
    this.startX = Math.floor((screenW - totalW) / 2)
    this.startY = screenH - this.slotHeight - 80
  }

  /** Add card to flight slot (S1 飞行模式). Cards stay until matched normally. */
  addToFlightSlot(card: BoardCard): boolean {
    const idx = this.flightSlots.findIndex(s => s === null)
    if (idx === -1) return false
    this.flightSlots[idx] = {
      uid: card.uid,
      type: card.type,
      config: card.config,
      cardId: card.cardId,
      icon: card.icon,
      name: card.name,
      isRevealed: card.isRevealed,
    }
    this.flightSlotsUsed++
    this.bus.emit('slotChanged', {})
    this._checkFlightMatch(card.cardId)
    return true
  }

  /** Match 3 same-type cards across flight + holding + normal slots */
  private _checkFlightMatch(cardId: string): void {
    type SlotEntry = { slot: SlotCard | null; clear: () => void }
    const allSlots: SlotEntry[] = []
    for (let i = 0; i < 3; i++) {
      const idx = i
      allSlots.push({ slot: this.flightSlots[i], clear: () => { this.flightSlots[idx] = null; this.flightSlotsUsed-- } })
    }
    for (let i = 0; i < 3; i++) {
      const idx = i
      allSlots.push({ slot: this.holdingSlots[i], clear: () => { this.holdingSlots[idx] = null } })
    }
    for (let i = 0; i < this.maxSlots; i++) {
      const idx = i
      allSlots.push({ slot: this.slots[i], clear: () => { this.slots[idx] = null } })
    }

    const sameSlots: SlotEntry[] = []
    const wildSlots: SlotEntry[] = []
    for (const s of allSlots) {
      if (!s.slot) continue
      if (s.slot.cardId === cardId) sameSlots.push(s)
      else if (s.slot.type === 'event' && (s.slot.config as any).effect === 'wild_card' && s.slot.isRevealed)
        wildSlots.push(s)
    }

    if (sameSlots.length >= 3) {
      const toClear = sameSlots.slice(0, 3)
      const uids = toClear.map(s => s.slot!.uid)
      for (const s of toClear) s.clear()
      this.happiness += 10
      this.bus.emit<EliminatedEvent>('eliminated', { uids, happiness: this.happiness, count: 3 })
      this._compact()
      this.bus.emit('slotChanged', {})
      return
    }
    if (wildSlots.length > 0 && (sameSlots.length + wildSlots.length) >= 3) {
      const needed = 3 - sameSlots.length
      const toClear = sameSlots.concat(wildSlots.slice(0, needed))
      const uids = toClear.map(s => s.slot!.uid)
      for (const s of toClear) s.clear()
      this.happiness += 10
      this.bus.emit<EliminatedEvent>('eliminated', { uids, happiness: this.happiness, count: 3 })
      this._compact()
      this.bus.emit('slotChanged', {})
    }
  }

  addCard(card: BoardCard): boolean {
    // Group same-type cards: insert next to existing same-type cards
    let targetIdx = -1
    const sameType: number[] = []
    for (let i = 0; i < this.maxSlots; i++) {
      if (this.slots[i] && this.slots[i]!.cardId === card.cardId) sameType.push(i)
    }

    if (sameType.length > 0) {
      // Target: right after the last same-type card
      const insertAfter = sameType[sameType.length - 1]
      targetIdx = insertAfter + 1

      // If target is occupied or beyond max, shift cards right to make room
      if (targetIdx < this.maxSlots && this.slots[targetIdx] !== null) {
        // Find a null slot to the right to cascade shift
        let nullIdx = -1
        for (let i = targetIdx + 1; i < this.maxSlots; i++) {
          if (this.slots[i] === null) { nullIdx = i; break }
        }
        if (nullIdx !== -1) {
          // Shift [targetIdx..nullIdx-1] right by 1
          for (let i = nullIdx; i > targetIdx; i--) {
            this.slots[i] = this.slots[i - 1]
          }
          this.slots[targetIdx] = null
        } else {
          targetIdx = -1 // can't make room
        }
      }
      if (targetIdx >= this.maxSlots) targetIdx = -1
    }

    // Fallback: leftmost empty
    if (targetIdx === -1) targetIdx = this.slots.findIndex(s => s === null)
    if (targetIdx === -1) { log(TAG, 'Slot full'); return false }

    this.slots[targetIdx] = {
      uid: card.uid,
      type: card.type,
      config: card.config,
      cardId: card.cardId,
      icon: card.icon,
      name: card.name,
      isRevealed: card.isRevealed,
    }
    // Slot render is driven by fly animation completion, not here
    return true
  }

  /** Signal that the slot bar should re-render (called after fly animation lands) */
  notifySlotChanged(): void {
    this.bus.emit('slotChanged', {})
  }

  /** Check for matches after card has settled in the slot (called after fly animation) */
  checkMatch(cardId: string): void {
    this._checkMatch(cardId)
  }

  /** Compact cards to the left, removing gaps */
  private _compact(): void {
    const cards = this.slots.filter(s => s !== null) as SlotCard[]
    for (let i = 0; i < this.maxSlots; i++) {
      this.slots[i] = i < cards.length ? cards[i] : null
    }
  }

  getVacantCount(): number {
    return this.slots.filter(s => s === null).length
  }

  isFull(): boolean { return this.getVacantCount() === 0 }

  private _checkMatch(cardId: string): void {
    // Check flight + holding slots — they participate in matching
    this._checkFlightMatch(cardId)
    this._checkHoldingMatch()
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
    this._compact()
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

  /** Eject the first 3 cards from slots to the holding area above. */
  ejectFirstThree(): void {
    let ejected = 0
    for (let i = 0; i < this.maxSlots && ejected < 3; i++) {
      if (this.slots[i]) {
        const hIdx = this.holdingSlots.findIndex(s => s === null)
        if (hIdx === -1) break
        this.holdingSlots[hIdx] = this.slots[i]
        this.slots[i] = null
        ejected++
      }
    }
    if (ejected > 0) {
      this._compact()
      this._checkHoldingMatch()
    }
  }

  /** Check if holding area + slots have 3-of-a-kind matches */
  private _checkHoldingMatch(): void {
    const all: Array<{ slot: SlotCard | null; clear: () => void }> = []
    for (let i = 0; i < 3; i++) {
      const idx = i
      all.push({ slot: this.holdingSlots[i], clear: () => { this.holdingSlots[idx] = null } })
    }
    for (let i = 0; i < this.maxSlots; i++) {
      const idx = i
      all.push({ slot: this.slots[i], clear: () => { this.slots[idx] = null } })
    }

    // Group by cardId
    const groups: Record<string, Array<{ clear: () => void }>> = {}
    for (const s of all) {
      if (!s.slot) continue
      const key = s.slot.cardId
      if (!groups[key]) groups[key] = []
      groups[key].push(s)
    }

    for (const key in groups) {
      if (groups[key].length >= 3) {
        const toClear = groups[key].slice(0, 3)
        const uids: string[] = []
        for (const s of all) {
          if (toClear.includes(s) && s.slot) {
            uids.push(s.slot.uid)
          }
        }
        for (const c of toClear) c.clear()
        this.happiness += 10
        this.bus.emit<EliminatedEvent>('eliminated', { uids, happiness: this.happiness, count: 3 })
        this._compact()
        break
      }
    }
    this.bus.emit('slotChanged', {})
  }

  reset(maxSlots?: number): void {
    if (maxSlots) this.maxSlots = maxSlots
    this.slots = []
    this.happiness = 0
    this.flightSlots = [null, null, null]
    this.flightSlotsUsed = 0
    this.holdingSlots = [null, null, null]
    for (let i = 0; i < this.maxSlots; i++) this.slots.push(null)
  }
}
