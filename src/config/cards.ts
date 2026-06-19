import type { NormalCardConfig, FuncCardConfig } from '../core/types'

export const NORMAL_CARDS: NormalCardConfig[] = [
  { id: 'phone',    icon: '📱', name: '刷手机',   rarity: 'common', weight: 90 },
  { id: 'toilet',   icon: '🚽', name: '带薪拉屎', rarity: 'common', weight: 80 },
  { id: 'sleep',    icon: '😴', name: '打瞌睡',   rarity: 'common', weight: 70 },
  { id: 'snack',    icon: '🍜', name: '吃零食',   rarity: 'uncommon', weight: 40 },
  { id: 'shop',     icon: '🛒', name: '逛淘宝',   rarity: 'uncommon', weight: 35 },
  { id: 'gossip',   icon: '💬', name: '聊八卦',   rarity: 'rare', weight: 15 },
  { id: 'game',     icon: '🎮', name: '偷偷游戏', rarity: 'rare', weight: 10 },
]

export const FUNC_TYPE = {
  NEGATIVE: 'negative',
  POSITIVE: 'positive',
  DUAL: 'dual',
} as const

export const FUNC_CARDS: FuncCardConfig[] = [
  { id: 'boss_patrol',   icon: '⚠️', name: '老板巡视',   type: 'negative',
    effect: 'boss_patrol', revealIcon: '⚠️', revealName: '老板巡视', weight: 50 },
  { id: 'printer_jam',   icon: '🖨️', name: '卡纸打印机', type: 'negative',
    effect: 'slot_limit_down', revealIcon: '🖨️', revealName: '卡纸打印机', weight: 35 },
  { id: 'early_leave',   icon: '🎫', name: '提前下班',   type: 'positive',
    effect: 'add_steps_3', revealIcon: '🎫', revealName: '提前下班', weight: 10 },
  { id: 'paid_leave',    icon: '🌟', name: '万能卡',     type: 'positive',
    effect: 'wild_card', revealIcon: '🌟', revealName: '万能卡', weight: 15 },
]
