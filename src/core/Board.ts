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

  calcLayout(screenW: number, screenH: number, rows: number, cols: number, layers: number, gapRatio = 0, verticalShift = 0): void {
    const areaTop = 20
    const areaBottom = 240
    const areaH = screenH - areaTop - areaBottom
    const areaW = screenW - 40

    const layerOffsetRatio = 0.06
    const gap = gapRatio > 0 ? gapRatio : 0.18  // Level 1 default gap

    // Solve: totalWidth = CW * (cols + (cols-1)*gap + (layers-1)*layerOffsetRatio) ≤ areaW
    const denom = cols + (cols - 1) * gap + (layers - 1) * layerOffsetRatio
    const maxCardW = 62  // allow larger cards for better fish visibility
    this.cardWidth = Math.min(maxCardW, Math.floor(areaW / denom))
    this.cardHeight = this.cardWidth

    this.layerOffsetX = Math.floor(this.cardWidth * layerOffsetRatio)
    this.layerOffsetY = Math.floor(this.cardHeight * 0.25)
    this.gap = Math.floor(this.cardWidth * gap)
    this.staggerLayers = layers <= 1  // single-layer: stagger; multi-layer: align for more overlap

    // Center horizontally
    const totalVisualWidth = this.cardWidth * cols + this.gap * (cols - 1) + (layers - 1) * this.layerOffsetX
    this.offsetX = Math.max(10, Math.floor((screenW - totalVisualWidth) / 2))

    // Center vertically with room for top layers
    const gridVisualHeight = this.cardHeight * rows + this.gap * (rows - 1)
    const centeredOffsetY = areaTop + Math.floor((areaH - gridVisualHeight) / 2)
    const minOffsetY = areaTop + (layers - 1) * this.layerOffsetY
    // Multi-layer levels: shift down 30% to leave breathing room above
    const multiLayerShift = layers > 1 ? Math.floor(areaH * 0.30) : 0
    this.offsetY = Math.max(centeredOffsetY, minOffsetY) + multiLayerShift
    if (verticalShift !== 0) {
      this.offsetY += Math.floor(areaH * verticalShift)
    }
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

    // Randomly pick card types — capped by what can fit (each type needs ≥3 cards)
    const maxTypes = Math.max(1, Math.floor(normalCount / 3))
    const typeCount = Math.min(config.normalCardTypes, maxTypes)
    const shuffled = [...NORMAL_CARDS].sort(() => Math.random() - 0.5)
    const usedNormalTypes = shuffled.slice(0, typeCount)

    // Distribute cards evenly: each type gets the same base count (multiple of 3)
    const perType = Math.floor(normalCount / typeCount)
    const perType3n = perType - (perType % 3)  // round down to nearest 3n
    let placed = 0
    for (let i = 0; i < usedNormalTypes.length; i++) {
      // First type gets any extra cards
      const count = i === 0
        ? normalCount - (usedNormalTypes.length - 1) * perType3n
        : perType3n
      for (let j = 0; j < count; j++) {
        list.push({ type: 'normal', config: usedNormalTypes[i] })
        placed++
      }
    }
    // Fill any remaining slots to reach 3n
    const remain = normalCount - placed
    const adjustedRemain = remain - (remain % 3)
    for (let k = 0; k < adjustedRemain; k++) {
      list.push({ type: 'normal', config: usedNormalTypes[0] })
    }

    this._addFuncCards(list, FUNC_TYPE.NEGATIVE, negCount)
    this._addFuncCards(list, FUNC_TYPE.POSITIVE, posCount)
    this._addFuncCards(list, FUNC_TYPE.DUAL, dualCount)
    this._shuffle(list)
    // Validate 3n guarantee: every card type must appear in multiples of 3
    const counts: Record<string, number> = {}
    for (const item of list) counts[item.config.id] = (counts[item.config.id] || 0) + 1
    for (const [id, cnt] of Object.entries(counts)) {
      if (cnt % 3 !== 0) {
        console.warn(`[Board] 3n VIOLATION: cardId=${id} count=${cnt} (not divisible by 3)`)
      }
    }
    console.log(`[Board] cardList: ${list.length} total, ${Object.keys(counts).length} types, counts:`, JSON.stringify(counts))
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

    const clusterLayers: number[] = this.config?.clusterLayers || []

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

      const isCluster = clusterLayers.includes(l)
      let placed = 0

      if (isCluster) {
        // Cluster placement: 3 fixed hot-spots
        const clusters = [
          { rMin: 0, rMax: 1, cMin: 0, cMax: 1 },
          { rMin: 2, rMax: 3, cMin: 2, cMax: 3 },
          { rMin: 0, rMax: 1, cMin: 4, cMax: 5 },
        ]
        const cardsPerCluster = Math.ceil(needed / clusters.length)

        for (const cl of clusters) {
          let clPlaced = 0
          for (let r = cl.rMin; r <= cl.rMax && clPlaced < cardsPerCluster && placed < needed; r++) {
            for (let c = cl.cMin; c <= cl.cMax && clPlaced < cardsPerCluster && placed < needed; c++) {
              if (r >= rows || c >= cols) continue
              if (this.grid[l][r][c] !== null) continue
              const cardData = normalCards.shift()
              if (!cardData) break
              const card = createCardData({ type: cardData.type, config: cardData.config, layer: l, row: r, col: c })
              this.grid[l][r][c] = cardToBoardCard(card, false)
              clPlaced++
              placed++
            }
          }
        }
      } else {
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

  /** Public check: is this card covered by any card in the layer above? */
  isCardCovered(card: BoardCard): boolean {
    return this._isCovered(card)
  }

  private _isCovered(card: BoardCard): boolean {
    const upperLayer = card.layer + 1
    if (upperLayer >= this.grid.length) return false

    // Use core area (fish body, ~65% of card) for overlap detection.
    // Transparent corners shouldn't count as "covering" the fish.
    const CORE = 0.60
    const MIN_OVERLAP_RATIO = 0.12
    const padX = this.cardWidth * (1 - CORE) / 2
    const padY = this.cardHeight * (1 - CORE) / 2
    const coreW = this.cardWidth * CORE
    const coreH = this.cardHeight * CORE
    const coreArea = coreW * coreH
    const minOverlapArea = coreArea * MIN_OVERLAP_RATIO

    // Card's core region (centered)
    const cLeft = this.offsetX + card.col * (this.cardWidth + this.gap) + card.layer * this.layerOffsetX + padX
    const cTop = this.offsetY + card.row * (this.cardHeight + this.gap) - card.layer * this.layerOffsetY + padY
    const cRight = cLeft + coreW
    const cBottom = cTop + coreH

    for (let r = 0; r < this.grid[upperLayer].length; r++) {
      for (let c = 0; c < this.grid[upperLayer][0].length; c++) {
        const upper = this.grid[upperLayer][r][c]
        if (!upper || upper.isRemoved) continue

        const uLeft = this.offsetX + c * (this.cardWidth + this.gap) + upperLayer * this.layerOffsetX + padX
        const uTop = this.offsetY + r * (this.cardHeight + this.gap) - upperLayer * this.layerOffsetY + padY
        const uRight = uLeft + coreW
        const uBottom = uTop + coreH

        // Core-area AABB intersection
        const overlapX = Math.min(cRight, uRight) - Math.max(cLeft, uLeft)
        const overlapY = Math.min(cBottom, uBottom) - Math.max(cTop, uTop)

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

  /** Check if this card covers any card in the layer below (for transparency hint). */
  isCoveringCard(card: BoardCard): boolean {
    const lowerLayer = card.layer - 1
    if (lowerLayer < 0) return false

    const CORE = 0.60
    const MIN_OVERLAP_RATIO = 0.12
    const padX = this.cardWidth * (1 - CORE) / 2
    const padY = this.cardHeight * (1 - CORE) / 2
    const coreW = this.cardWidth * CORE
    const coreH = this.cardHeight * CORE
    const coreArea = coreW * coreH
    const minOverlapArea = coreArea * MIN_OVERLAP_RATIO

    const cLeft = this.offsetX + card.col * (this.cardWidth + this.gap) + card.layer * this.layerOffsetX + padX
    const cTop = this.offsetY + card.row * (this.cardHeight + this.gap) - card.layer * this.layerOffsetY + padY
    const cRight = cLeft + coreW
    const cBottom = cTop + coreH

    for (let r = 0; r < this.grid[lowerLayer].length; r++) {
      for (let c = 0; c < this.grid[lowerLayer][0].length; c++) {
        const lower = this.grid[lowerLayer][r][c]
        if (!lower || lower.isRemoved) continue

        const lLeft = this.offsetX + c * (this.cardWidth + this.gap) + lowerLayer * this.layerOffsetX + padX
        const lTop = this.offsetY + r * (this.cardHeight + this.gap) - lowerLayer * this.layerOffsetY + padY
        const lRight = lLeft + coreW
        const lBottom = lTop + coreH

        const overlapX = Math.min(cRight, lRight) - Math.max(cLeft, lLeft)
        const overlapY = Math.min(cBottom, lBottom) - Math.max(cTop, lTop)

        if (overlapX > 0 && overlapY > 0) {
          if (overlapX * overlapY >= minOverlapArea) return true
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

  /** Shuffle all remaining cards' positions on the board */
  shuffleBoard(): void {
    const cards: BoardCard[] = []
    const positions: Array<{ l: number; r: number; c: number }> = []
    for (let l = 0; l < this.grid.length; l++)
      for (let r = 0; r < this.grid[l].length; r++)
        for (let c = 0; c < this.grid[l][r].length; c++) {
          const card = this.grid[l][r][c]
          if (card && !card.isRemoved) {
            cards.push(card)
            positions.push({ l, r, c })
          }
        }

    // Shuffle cards while keeping positions the same
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[cards[i], cards[j]] = [cards[j], cards[i]]
    }

    // Clear grid and re-place
    for (const pos of positions) {
      this.grid[pos.l][pos.r][pos.c] = null
    }
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i]
      const p = positions[i]
      c.layer = p.l; c.row = p.r; c.col = p.c
      this.grid[p.l][p.r][p.c] = c
    }

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

  /** 章鱼墨水: randomly swap 2 cards' positions on the board */
  swapTwoCards(): void {
    const cards: BoardCard[] = []
    const positions: Array<{ l: number; r: number; c: number }> = []
    for (let l = 0; l < this.grid.length; l++)
      for (let r = 0; r < this.grid[l].length; r++)
        for (let c = 0; c < this.grid[l][r].length; c++) {
          const card = this.grid[l][r][c]
          if (card && !card.isRemoved) {
            cards.push(card)
            positions.push({ l, r, c })
          }
        }
    if (cards.length < 2) return

    // Pick 2 distinct random cards
    const i = Math.floor(Math.random() * cards.length)
    let j = Math.floor(Math.random() * cards.length)
    while (j === i) j = Math.floor(Math.random() * cards.length)

    const ci = cards[i], cj = cards[j]
    const pi = positions[i], pj = positions[j]

    // Update card grid coordinates
    ci.layer = pj.l; ci.row = pj.r; ci.col = pj.c
    cj.layer = pi.l; cj.row = pi.r; cj.col = pi.c

    // Swap in grid
    this.grid[pi.l][pi.r][pi.c] = cj
    this.grid[pj.l][pj.r][pj.c] = ci

    this._updateCoveredState()
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
    const cards: Array<{ uid: string; blocked: boolean; covering: boolean }> = []
    for (let l = 0; l < this.grid.length; l++)
      for (let r = 0; r < this.grid[l].length; r++)
        for (let c = 0; c < this.grid[l][r].length; c++) {
          const card = this.grid[l][r][c]
          if (card && !card.isRemoved) cards.push({
            uid: card.uid,
            blocked: card.isCovered,
            covering: this.isCoveringCard(card)
          })
        }
    this.bus.emit<BoardChangedEvent>('boardChanged', { cards })
  }
}
