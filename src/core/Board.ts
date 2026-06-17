import type { EventBus } from '../engine/EventBus'
import type { LevelConfig, BoardCard, BoardInitEvent, BoardChangedEvent, NormalCardConfig, FuncCardConfig } from './types'
import { createCardData, cardToBoardCard, revealCard } from './Card'
import { NORMAL_CARDS, FUNC_CARDS, FUNC_TYPE } from '../config/cards'

export class Board {
  private grid: (BoardCard | null)[][][] = []
  private bus: EventBus
  private config: LevelConfig | null = null

  // Layout params
  cardWidth = 64
  cardHeight = 80
  offsetX = 0
  offsetY = 0
  layerOffsetX = 4
  layerOffsetY = 4
  gap = 8

  constructor(bus: EventBus) {
    this.bus = bus
  }

  calcLayout(screenW: number, screenH: number, rows: number, cols: number): void {
    const areaTop = 20
    const areaBottom = 180
    const areaH = screenH - areaTop - areaBottom
    const areaW = screenW - 20
    const gap = 8
    this.cardWidth = Math.floor((areaW - gap * (cols + 1)) / cols)
    this.cardHeight = Math.floor(this.cardWidth * 1.25)
    this.offsetX = Math.floor((screenW - (this.cardWidth * cols + gap * (cols - 1))) / 2)
    this.offsetY = areaTop + Math.floor((areaH - (this.cardHeight * rows + gap * (rows - 1))) / 2)
    this.gap = gap
    this.layerOffsetX = Math.floor(this.cardWidth * 0.08)
    this.layerOffsetY = Math.floor(this.cardHeight * 0.06)
  }

  generate(config: LevelConfig): void {
    this.config = config
    this.grid = []
    const { layers, gridRows: rows, gridCols: cols } = config

    for (let l = 0; l < layers; l++) {
      this.grid[l] = []
      for (let r = 0; r < rows; r++) {
        this.grid[l][r] = []
        for (let c = 0; c < cols; c++) this.grid[l][r][c] = null
      }
    }

    // Calculate exact number of cards to place (3n), then generate exactly that many
    const totalNeeded = this._calcTotalNeeded(layers, rows, cols)
    const cardList = this._buildCardList(config, totalNeeded)
    this._fillGrid(cardList, layers, rows, cols)
    this._updateCoveredState()
    this._emitBoardInit()
  }

  /** Sum layer coverage slots, rounded down to 3n per layer and total */
  private _calcTotalNeeded(layers: number, rows: number, cols: number): number {
    let total = 0
    for (let l = 0; l < layers; l++) {
      let coverage: number
      if (layers === 1) coverage = 0.95
      else if (l === 0) coverage = 0.85
      else if (l === layers - 1) coverage = 0.35
      else coverage = 0.5
      const raw = Math.floor(rows * cols * coverage)
      total += raw - (raw % 3)
    }
    // Ensure grand total is 3n
    return total - (total % 3)
  }

  private _buildCardList(config: LevelConfig, totalNeeded: number): Array<{ type: 'normal' | 'event'; config: NormalCardConfig | FuncCardConfig }> {
    const list: Array<{ type: 'normal' | 'event'; config: NormalCardConfig | FuncCardConfig }> = []

    // Calculate func card count proportional to config, but scaled to totalNeeded
    const funcRatio = config.funcRatio || { negative: 1, positive: 0, dual: 0 }
    const ratioSum = (funcRatio.negative || 1) + (funcRatio.positive || 0) + (funcRatio.dual || 0)
    const funcFraction = config.totalCards > 0 ? config.funcCardCount / config.totalCards : 0
    let totalFunc = Math.floor(totalNeeded * funcFraction)
    totalFunc = totalFunc - (totalFunc % 3) // 3n
    // Ensure minimum 3 func cards if the level config has any func cards
    if (totalFunc === 0 && config.funcCardCount > 0 && totalNeeded >= 3) {
      totalFunc = 3
    }

    let negCount = Math.floor(totalFunc * (funcRatio.negative || 1) / ratioSum)
    let posCount = Math.floor(totalFunc * (funcRatio.positive || 0) / ratioSum)
    let dualCount = totalFunc - negCount - posCount
    // Ensure each func category is a multiple of 3 for guaranteed elimination
    negCount = negCount - (negCount % 3)
    posCount = posCount - (posCount % 3)
    dualCount = dualCount - (dualCount % 3)
    // Recalculate total func after rounding
    totalFunc = negCount + posCount + dualCount
    // Safeguard: func cards cannot exceed total slots
    if (totalFunc > totalNeeded) {
      totalFunc = totalNeeded - (totalNeeded % 3)
      negCount = Math.min(negCount, totalFunc)
      posCount = 0
      dualCount = 0
    }

    const normalCount = totalNeeded - totalFunc

    const usedNormalTypes = NORMAL_CARDS.slice(0, config.normalCardTypes)
    let perType = Math.floor(normalCount / config.normalCardTypes)
    perType = perType - (perType % 3) // ensure multiples of 3
    for (const ct of usedNormalTypes) {
      for (let j = 0; j < perType; j++) {
        list.push({ type: 'normal', config: ct })
      }
    }
    // fill remainder — ensure multiple of 3 so every card can be eliminated
    const remain = normalCount - list.filter(l => l.type === 'normal').length
    const adjustedRemain = remain - (remain % 3)
    for (let k = 0; k < adjustedRemain; k++) {
      list.push({ type: 'normal', config: usedNormalTypes[0] })
    }

    this._addFuncCards(list, FUNC_TYPE.NEGATIVE, negCount)
    this._addFuncCards(list, FUNC_TYPE.POSITIVE, posCount)
    this._addFuncCards(list, FUNC_TYPE.DUAL, dualCount)
    this._shuffle(list)
    return list
  }

  private _addFuncCards(
    list: Array<{ type: 'normal' | 'event'; config: NormalCardConfig | FuncCardConfig }>,
    funcType: string, count: number
  ): void {
    if (count <= 0) return
    const pool = FUNC_CARDS.filter(c => (c as FuncCardConfig).type === funcType)
    if (pool.length === 0) return
    // Pick one func card type and add in multiples of 3 for guaranteed elimination
    const pick = pool[Math.floor(Math.random() * pool.length)]
    for (let i = 0; i < count; i++) {
      list.push({ type: 'event', config: pick as FuncCardConfig })
    }
  }

  private _shuffle<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
  }

  private _fillGrid(
    cardList: Array<{ type: 'normal' | 'event'; config: NormalCardConfig | FuncCardConfig }>,
    layers: number, rows: number, cols: number
  ): void {
    const eventCards = cardList.filter(c => c.type === 'event')
    const normalCards = cardList.filter(c => c.type === 'normal')
    // sort rare cards to lower layers
    normalCards.sort((a, b) => {
      const order: Record<string, number> = { rare: 0, uncommon: 1, common: 2 }
      return (order[(a.config as NormalCardConfig).rarity] || 2) - (order[(b.config as NormalCardConfig).rarity] || 2)
    })

    for (let l = 0; l < layers; l++) {
      let coverage: number
      if (layers === 1) coverage = 0.95
      else if (l === 0) coverage = 0.85
      else if (l === layers - 1) coverage = 0.35
      else coverage = 0.5

      const rawNeeded = Math.floor(rows * cols * coverage)
      const needed = rawNeeded - (rawNeeded % 3) // ensure 3n for guaranteed elimination
      let placed = 0
      for (let r = 0; r < rows && placed < needed; r++) {
        for (let c = 0; c < cols && placed < needed; c++) {
          if (this.grid[l][r][c] !== null) continue
          let cardData: { type: 'normal' | 'event'; config: NormalCardConfig | FuncCardConfig } | undefined
          if (l === layers - 1 && eventCards.length > 0) cardData = eventCards.shift()
          else if (normalCards.length > 0) cardData = normalCards.shift()
          else if (eventCards.length > 0) cardData = eventCards.shift()
          else break
          if (!cardData) break
          const card = createCardData({ type: cardData.type, config: cardData.config, layer: l, row: r, col: c })
          this.grid[l][r][c] = cardToBoardCard(card, false)
          placed++
        }
      }
    }
  }

  private _updateCoveredState(): void {
    for (let l = 0; l < this.grid.length; l++) {
      for (let r = 0; r < this.grid[l].length; r++) {
        for (let c = 0; c < this.grid[l][r].length; c++) {
          const card = this.grid[l][r][c]
          if (!card) continue
          card.isCovered = this._isCovered(card)
        }
      }
    }
  }

  private _isCovered(card: BoardCard): boolean {
    const upperLayer = card.layer + 1
    if (upperLayer >= this.grid.length) return false
    const checkPositions = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]
    for (const [dr, dc] of checkPositions) {
      const rr = card.row + dr, cc = card.col + dc
      if (rr >= 0 && rr < this.grid[upperLayer].length &&
          cc >= 0 && cc < this.grid[upperLayer][0].length &&
          this.grid[upperLayer][rr][cc] !== null) return true
    }
    return false
  }

  getClickableCards(): BoardCard[] {
    const result: BoardCard[] = []
    for (let l = 0; l < this.grid.length; l++)
      for (let r = 0; r < this.grid[l].length; r++)
        for (let c = 0; c < this.grid[l][r].length; c++) {
          const card = this.grid[l][r][c]
          if (card && !card.isRemoved && !card.isCovered) result.push(card)
        }
    return result
  }

  removeCard(uid: string): BoardCard | null {
    for (let l = 0; l < this.grid.length; l++)
      for (let r = 0; r < this.grid[l].length; r++)
        for (let c = 0; c < this.grid[l][r].length; c++) {
          const card = this.grid[l][r][c]
          if (card && card.uid === uid && !card.isRemoved) {
            card.isRemoved = true
            this.grid[l][r][c] = null
            this._updateCoveredState()
            this._emitBoardChanged()
            return card
          }
        }
    return null
  }

  revealAllEvents(): void {
    for (let l = 0; l < this.grid.length; l++)
      for (let r = 0; r < this.grid[l].length; r++)
        for (let c = 0; c < this.grid[l][r].length; c++) {
          const card = this.grid[l][r][c]
          if (card && card.type === 'event' && !card.isRevealed) {
            revealCard(card)
          }
        }
    this._emitBoardInit()
  }

  removeCoveredCards(count: number): BoardCard[] {
    const covered: BoardCard[] = []
    for (let l = 0; l < this.grid.length; l++)
      for (let r = 0; r < this.grid[l].length; r++)
        for (let c = 0; c < this.grid[l][r].length; c++) {
          const card = this.grid[l][r][c]
          if (card && card.isCovered && !card.isRemoved) covered.push(card)
        }
    this._shuffle(covered)
    const toRemove = covered.slice(0, count)
    for (const card of toRemove) this.removeCard(card.uid)
    return toRemove
  }

  hasCards(): boolean {
    for (let l = 0; l < this.grid.length; l++)
      for (let r = 0; r < this.grid[l].length; r++)
        for (let c = 0; c < this.grid[l][r].length; c++)
          if (this.grid[l][r][c] && !this.grid[l][r][c]!.isRemoved) return true
    return false
  }

  private _emitBoardInit(): void {
    const cards: BoardCard[] = []
    for (let l = 0; l < this.grid.length; l++)
      for (let r = 0; r < this.grid[l].length; r++)
        for (let c = 0; c < this.grid[l][r].length; c++) {
          const card = this.grid[l][r][c]
          if (card && !card.isRemoved) cards.push({ ...card })
        }
    this.bus.emit<BoardInitEvent>('boardInit', { cards })
  }

  private _emitBoardChanged(): void {
    const cards: Array<{ uid: string; blocked: boolean }> = []
    for (let l = 0; l < this.grid.length; l++)
      for (let r = 0; r < this.grid[l].length; r++)
        for (let c = 0; c < this.grid[l][r].length; c++) {
          const card = this.grid[l][r][c]
          if (card && !card.isRemoved) cards.push({ uid: card.uid, blocked: card.isCovered })
        }
    this.bus.emit<BoardChangedEvent>('boardChanged', { cards })
  }
}
