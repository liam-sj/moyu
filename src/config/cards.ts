import type { NormalCardConfig, FuncCardConfig } from '../core/types'

/**
 * 12 fish types as normal cards (first 3 rows of new-fishs.png atlas).
 * Weights control rarity: higher = more likely to appear in a level.
 */
export const NORMAL_CARDS: NormalCardConfig[] = [
  { id: 'xiaojinyu', icon: '🐟', name: '小金鱼', rarity: 'common', weight: 90 },
  { id: 'xianyugan',  icon: '🦐', name: '咸鱼干', rarity: 'common', weight: 90 },
  { id: 'jinli',     icon: '🐠', name: '锦鲤',   rarity: 'common', weight: 80 },
  { id: 'hetun',     icon: '🐡', name: '河豚',   rarity: 'common', weight: 70 },
  { id: 'moyu',      icon: '🦑', name: '墨鱼',   rarity: 'uncommon', weight: 45 },
  { id: 'haima',     icon: '🐬', name: '海马',   rarity: 'uncommon', weight: 40 },
  { id: 'feiyu',     icon: '🦅', name: '飞鱼',   rarity: 'uncommon', weight: 35 },
  { id: 'zhangyu',   icon: '🐙', name: '章鱼',   rarity: 'uncommon', weight: 35 },
  { id: 'bimuyu',    icon: '🐟', name: '比目鱼', rarity: 'rare', weight: 20 },
  { id: 'pangxie',   icon: '🦀', name: '螃蟹',   rarity: 'rare', weight: 15 },
  { id: 'jianyu',    icon: '⚔️', name: '剑鱼',   rarity: 'rare', weight: 10 },
  { id: 'haitun',    icon: '🐬', name: '海豚',   rarity: 'rare', weight: 10 },
]

export const FUNC_TYPE = {
  NEGATIVE: 'negative',
  POSITIVE: 'positive',
  DUAL: 'dual',
} as const

export const FUNC_CARDS: FuncCardConfig[] = [
  // 减益 — 负面效果
  { id: 'shark',      icon: '🦈', name: '鲨鱼来袭', type: 'negative',
    effect: 'boss_patrol', revealIcon: '🦈', revealName: '鲨鱼来袭', weight: 50 },
  // 增益 — 正面效果
  { id: 'pearl',      icon: '🦪', name: '万能珍珠', type: 'positive',
    effect: 'wild_card', revealIcon: '🦪', revealName: '万能珍珠', weight: 20 },
  // 干扰 — 扰乱效果
  { id: 'octopus',    icon: '🐙', name: '章鱼墨水', type: 'dual',
    effect: 'ink_slots', revealIcon: '🐙', revealName: '章鱼墨水', weight: 20 },
]
