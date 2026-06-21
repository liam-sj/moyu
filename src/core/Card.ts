import type { NormalCardConfig, FuncCardConfig, CardData, BoardCard, SlotCard } from './types'

let uidSeq = 0

export function createCardData(opts: {
  type: 'normal' | 'event'
  config: NormalCardConfig | FuncCardConfig
  layer: number
  row: number
  col: number
}): CardData {
  return {
    uid: `c${uidSeq++}`,
    type: opts.type,
    config: opts.config,
    cardId: opts.config.id,
    icon: opts.config.icon,
    name: opts.config.name,
    layer: opts.layer,
    row: opts.row,
    col: opts.col,
    isRevealed: false,
    isRemoved: false,
    isCovered: true,
  }
}

export function cardToBoardCard(card: CardData, isCovered: boolean): BoardCard {
  return {
    uid: card.uid,
    type: card.type,
    config: card.config,
    cardId: card.cardId,
    icon: card.icon,
    name: card.name,
    layer: card.layer,
    row: card.row,
    col: card.col,
    isCovered,
    isRevealed: card.isRevealed,
    isRemoved: card.isRemoved,
  }
}

export function revealCard(card: CardData): void {
  if (card.type !== 'event' || card.isRevealed) return
  card.isRevealed = true
  const config = card.config as FuncCardConfig
  if (config.revealIcon) card.icon = config.revealIcon
  if (config.revealName) card.name = config.revealName
}

export function getCardColor(card: CardData | BoardCard | SlotCard): string {
  const config = card.config
  if (card.type === 'event' && !card.isRevealed) return '#B39BC8'   // muted lotus purple
  if (card.type === 'event' && card.isRevealed) {
    const t = (config as FuncCardConfig).type
    if (t === 'negative') return '#E87461'   // warm coral red
    if (t === 'positive') return '#6BBF8A'   // jade green
    if (t === 'dual') return '#F0A860'       // warm amber
  }
  const r = (config as NormalCardConfig).rarity
  if (r === 'rare') return '#E8B45A'         // soft gold
  if (r === 'uncommon') return '#6CB4C4'     // pond teal
  return '#A8B5A0'                           // moss green (was cold grey)
}
