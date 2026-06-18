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
  /** Whether to offset odd layers by half card width (brick-wall stagger) */
  staggerLayers = false

  constructor(bus: EventBus) {
    this.bus = bus
  }

  calcLayout(screenW: number, screenH: number, rows: number, cols: number, layers: number, gapRatio = 0): void {
    const areaTop = 20
    const areaBottom = 200
    const areaH = screenH - areaTop - areaBottom
    const areaW = screenW - 20

    // Unified card sizing for both levels.
    // Level 2 (6 cols + 4 layers × 0.50) is the constraining layout.
    // We compute cardWidth from Level 2's effectiveCols, then Level 1 reuses it.
    const layerOffsetRatio = gapRatio > 0 ? 0.50 : 0
    const preGap = gapRatio > 0 ? 0 : 20
    const effectiveCols = cols + (layers - 1) * layerOffsetRatio

    if (gapRatio > 0) {
      // Dense pyramid: cardWidth driven by effectiveCols to fill screen
      this.cardWidth = Math.floor((areaW - (cols - 1) * preGap) / effectiveCols)
    } else {
      // Simple layout: targeted card width for neat 3×3 grid (~50px)
      this.cardWidth = Math.floor((areaW - (cols - 1) * preGap) / (cols + 3))
    }
    this.cardHeight = Math.floor(this.cardWidth * 1.25)

    this.layerOffsetX = gapRatio > 0 ? Math.floor(this.cardWidth * layerOffsetRatio) : 0
    this.layerOffsetY = gapRatio > 0 ? Math.floor(this.cardHeight * 0.40) : 40
    this.gap = gapRatio > 0 ? Math.floor(this.cardWidth * gapRatio) : 20
    this.staggerLayers = gapRatio > 0

    // Center the widest (top) layer's visual extent
    const gridVisualWidth = this.cardWidth * cols + this.gap * (cols - 1)
    const totalVisualWidth = gridVisualWidth + (layers - 1) * this.layerOffsetX
    this.offsetX = Math.max(10, Math.floor((screenW - totalVisualWidth) / 2))

    // Center grid vertically, then shift down to prevent top layer from going off-screen
    const gridVisualHeight = this.cardHeight * rows + this.gap * (rows - 1)
    const centeredOffsetY = areaTop + Math.floor((areaH - gridVisualHeight) / 2)
    const minOffsetY = areaTop + (layers - 1) * this.layerOffsetY
    this.offsetY = Math.max(centeredOffsetY, minOffsetY)
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

    // Use exact per-layer counts if specified, otherwise calculate from coverage
    const layerCards = config.layerCards
    const totalNeeded = layerCards
      ? layerCards.reduce((a, b) => a + b, 0)
      : this._calcTotalNeeded(layers, rows, cols)

    const cardList = this._buildCardList(config, totalNeeded)
    this._fillGrid(cardList, layers, rows, cols, layerCards)
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
    layers: number, rows: number, cols: number,
    layerCards?: number[]
  ): void {
    // Separate normal and event cards, then interleave event cards randomly
    // so func cards appear distributed across all layers, not just the top.
    const normalCards = cardList.filter(c => c.type === 'normal')
    const eventCards = cardList.filter(c => c.type === 'event')
    // sort rare cards to lower layers
    normalCards.sort((a, b) => {
      const order: Record<string, number> = { rare: 0, uncommon: 1, common: 2 }
      return (order[(a.config as NormalCardConfig).rarity] || 2) - (order[(b.config as NormalCardConfig).rarity] || 2)
    })
    // Randomly insert event cards into the normal card list
    for (const ev of eventCards) {
      const pos = Math.floor(Math.random() * (normalCards.length + 1))
      normalCards.splice(pos, 0, ev)
    }

    for (let l = 0; l < layers; l++) {
      let needed: number
      if (layerCards && layerCards[l] !== undefined) {
        needed = layerCards[l]
      } else {
        let coverage: number
        if (layers === 1) coverage = 0.95
        else if (l === 0) coverage = 0.85
        else if (l === layers - 1) coverage = 0.35
        else coverage = 0.5
        const rawNeeded = Math.floor(rows * cols * coverage)
        needed = rawNeeded - (rawNeeded % 3)
      }

      let placed = 0
      for (let r = 0; r < rows && placed < needed; r++) {
        for (let c = 0; c < cols && placed < needed; c++) {
          if (this.grid[l][r][c] !== null) continue
          const cardData = normalCards.shift()
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

    // Pixel-level overlap with minimum area threshold.
    // Only mark as "covered" if an upper card obscures >20% of this card's area.
    // Barely-touching edges don't count — the exposed portion stays highlighted.
    const MIN_OVERLAP_RATIO = 0.08
    const cardArea = this.cardWidth * this.cardHeight
    const minOverlapArea = cardArea * MIN_OVERLAP_RATIO

    const cx = this.offsetX + card.col * (this.cardWidth + this.gap) + card.layer * this.layerOffsetX
    const cy = this.offsetY + card.row * (this.cardHeight + this.gap) - card.layer * this.layerOffsetY
    const cRight = cx + this.cardWidth
    const cBottom = cy + this.cardHeight

    for (let r = 0; r < this.grid[upperLayer].length; r++) {
      for (let c = 0; c < this.grid[upperLayer][0].length; c++) {
        const upper = this.grid[upperLayer][r][c]
        if (!upper || upper.isRemoved) continue

        const ux = this.offsetX + c * (this.cardWidth + this.gap) + upperLayer * this.layerOffsetX
        const uy = this.offsetY + r * (this.cardHeight + this.gap) - upperLayer * this.layerOffsetY
        const uRight = ux + this.cardWidth
        const uBottom = uy + this.cardHeight

        // AABB intersection
        const overlapX = Math.min(cRight, uRight) - Math.max(cx, ux)
        const overlapY = Math.min(cBottom, uBottom) - Math.max(cy, uy)

        if (overlapX > 0 && overlapY > 0) {
          const overlapArea = overlapX * overlapY
          if (overlapArea >= minOverlapArea) {
            return true
          }
        }
      }
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

  /** S8 屏幕切换: remove all cards of a given cardId from the board */
  removeAllOfType(cardId: string): number {
    let removed = 0
    for (let l = 0; l < this.grid.length; l++)
      for (let r = 0; r < this.grid[l].length; r++)
        for (let c = 0; c < this.grid[l][r].length; c++) {
          const card = this.grid[l][r][c]
          if (card && card.cardId === cardId && !card.isRemoved) {
            card.isRemoved = true
            this.grid[l][r][c] = null
            removed++
          }
        }
    if (removed > 0) {
      this._updateCoveredState()
      this._emitBoardChanged()
      this._emitBoardInit()
    }
    return removed
  }

  /** Get all unique card IDs currently on the board (for skill targeting) */
  getCardTypesOnBoard(): string[] {
    const seen = new Set<string>()
    for (let l = 0; l < this.grid.length; l++)
      for (let r = 0; r < this.grid[l].length; r++)
        for (let c = 0; c < this.grid[l][r].length; c++) {
          const card = this.grid[l][r][c]
          if (card && !card.isRemoved) seen.add(card.cardId)
        }
    return Array.from(seen)
  }

  /** Undo: restore a card to the board grid */
  restoreCard(card: BoardCard): void {
    const { layer, row, col } = card
    if (layer < 0 || layer >= this.grid.length) return
    if (row < 0 || row >= this.grid[layer].length) return
    if (col < 0 || col >= this.grid[layer][row].length) return
    card.isRemoved = false
    card.isCovered = false
    this.grid[layer][row][col] = card
    this._updateCoveredState()
    this._emitBoardChanged()
    this._emitBoardInit()
  }

  /** Force all remaining cards to be uncovered (deadlock recovery) */
  forceUncoverAll(): void {
    for (let l = 0; l < this.grid.length; l++)
      for (let r = 0; r < this.grid[l].length; r++)
        for (let c = 0; c < this.grid[l][r].length; c++) {
          const card = this.grid[l][r][c]
          if (card && !card.isRemoved) card.isCovered = false
        }
    this._emitBoardChanged()
    this._emitBoardInit()
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
