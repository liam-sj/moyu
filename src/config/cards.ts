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
  { id: 'boss_patrol',    icon: '⚠️', name: '老板巡视', type: 'negative',
    effect: 'boss_patrol', revealIcon: '⚠️', revealName: '老板巡视', weight: 30 },
  { id: 'emergency_meet', icon: '📞', name: '紧急会议', type: 'negative',
    effect: 'lock_cards', revealIcon: '📞', revealName: '紧急会议', weight: 15 },
  { id: 'printer_jam',    icon: '🖨️', name: '卡纸打印机', type: 'negative',
    effect: 'slot_limit_down', revealIcon: '🖨️', revealName: '卡纸打印机', weight: 15 },
  { id: 'system_crash',   icon: '💻', name: '系统崩溃', type: 'negative',
    effect: 'shuffle_slots', revealIcon: '💻', revealName: '系统崩溃', weight: 25 },
  { id: 'new_task',       icon: '📋', name: '临时加需求', type: 'negative',
    effect: 'add_cards_to_board', revealIcon: '📋', revealName: '临时加需求', weight: 15 },
  { id: 'paid_leave',     icon: '🌟', name: '带薪年假', type: 'positive',
    effect: 'wild_card', revealIcon: '🌟', revealName: '带薪年假', weight: 15 },
  { id: 'colleague_coffee', icon: '☕', name: '同事请咖啡', type: 'positive',
    effect: 'remove_most', revealIcon: '☕', revealName: '同事请咖啡', weight: 15 },
  { id: 'early_leave',    icon: '🎫', name: '提前下班券', type: 'positive',
    effect: 'add_steps_3', revealIcon: '🎫', revealName: '提前下班券', weight: 8 },
  { id: 'boss_favor',     icon: '🍀', name: '领导的宠儿', type: 'positive',
    effect: 'immune_negative_3', revealIcon: '🍀', revealName: '领导的宠儿', weight: 15 },
  { id: 'reimburse',      icon: '💰', name: '报销通过', type: 'positive',
    effect: 'double_happy_10', revealIcon: '💰', revealName: '报销通过', weight: 12 },
  { id: 'job_rotate',     icon: '🔀', name: '岗位轮换', type: 'dual',
    effect: 'random_transform_one', revealIcon: '🔀', revealName: '岗位轮换', weight: 20 },
  { id: 'overtime',       icon: '⏳', name: '加班申请', type: 'dual',
    effect: 'add_steps_5_boss_rise', revealIcon: '⏳', revealName: '加班申请', weight: 15 },
  { id: 'dept_dinner',    icon: '🍺', name: '部门聚餐', type: 'dual',
    effect: 'remove_3_slot_down', revealIcon: '🍺', revealName: '部门聚餐', weight: 15 },
  { id: 'weekly_report',  icon: '📊', name: '全员周报', type: 'dual',
    effect: 'reveal_add_boss', revealIcon: '📊', revealName: '全员周报', weight: 12 },
]
