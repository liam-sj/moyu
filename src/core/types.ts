// ── 卡片相关 ──
export type CardRarity = 'common' | 'uncommon' | 'rare'
export type CardEffectType = 'negative' | 'positive' | 'dual'

export interface NormalCardConfig {
  id: string
  icon: string
  name: string
  rarity: CardRarity
  weight: number
}

export interface FuncCardConfig {
  id: string
  icon: string
  name: string
  type: CardEffectType
  effect: string
  revealIcon: string
  revealName: string
  weight: number
}

export interface CardData {
  uid: string
  type: 'normal' | 'event'
  config: NormalCardConfig | FuncCardConfig
  cardId: string
  icon: string
  name: string
  layer: number
  row: number
  col: number
  isRevealed: boolean
  isRemoved: boolean
  isCovered: boolean
}

// ── 棋盘 ──
export interface BoardCard {
  uid: string
  type: 'normal' | 'event'
  config: NormalCardConfig | FuncCardConfig
  cardId: string
  icon: string
  name: string
  layer: number
  row: number
  col: number
  isCovered: boolean
  isRevealed: boolean
  isRemoved: boolean
}

// ── 卡槽 ──
export interface SlotCard {
  uid: string
  type: 'normal' | 'event'
  config: NormalCardConfig | FuncCardConfig
  cardId: string
  icon: string
  name: string
  isRevealed: boolean
}

// ── 关卡 ──
export interface LevelConfig {
  id: string
  name: string
  normalCardTypes: number
  funcCardCount: number
  funcTypes: string[]
  funcRatio?: { negative: number; positive: number; dual: number }
  layers: number
  gridRows: number
  gridCols: number
  totalCards: number
  steps: number
  slotLimit: number
  /** Exact card count per layer [bottom, ..., top]. Overrides coverage-based calculation. */
  layerCards?: number[]
  /** Gap between cards as ratio of cardWidth (default 0 for fixed 8px gap). e.g. 0.3 = 30% */
  gapRatio?: number
  /** Layers (by index) where cards should be placed in tight clusters */
  clusterLayers?: number[]
}

// ── 技能 ──
export interface SkillConfig {
  id: string
  name: string
  icon: string
  tag: string
  desc: string
  apply: (ctx: SkillContext) => void
}

export interface SkillContext {
  slotFreeClicks: number
  slotLimit: number
  clearMostInSlot: boolean
  removeCoveredCards: number
  transformToWild: number
  slotOverflowShield: boolean
  stepsRemaining: number
  noMoreBossPatrol: boolean
  revealAllEvents: boolean
  selectAndClear: boolean
  clearRandomRare: boolean
  swapTwoInSlot: boolean
  tempSlotLimit9: number
  gainWildCard: boolean
  extraSkillTrigger: boolean
  stepsUnlimited: boolean
  slotUnlimited: boolean
  /** S8 屏幕切换: cardId to clear from the board */
  selectAndClearTarget?: string | null
  /** S1 移出三张: eject first 3 cards to holding area */
  ejectSlots: boolean
}

// ── 游戏结果 ──
export interface GameResult {
  won: boolean
  happiness: number
  reason: string
  levelId: string
  stepsUsed: number
}

// ── 事件 Payload ──
export interface BoardInitEvent { cards: BoardCard[] }
export interface StepsChangedEvent { remaining: number }
export interface CardToSlotEvent { card: BoardCard; slotIndex: number }
export interface BoardChangedEvent { cards: Array<{ uid: string; blocked: boolean }> }
export interface EliminatedEvent { uids: string[]; happiness: number; count: number }
export interface HappyChangedEvent { value: number }
export interface SkillTriggeredEvent { skills: SkillConfig[] }
export interface SkillAppliedEvent { skill: SkillConfig }
export interface GameOverEvent extends GameResult {}
