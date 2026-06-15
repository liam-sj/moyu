// src/data/cards.js

// 基础摸鱼卡（7种）
export var NORMAL_CARDS = [
  { id: 'phone',    icon: '📱', name: '刷手机',   rarity: 'common', weight: 90 },
  { id: 'toilet',   icon: '🚽', name: '带薪拉屎', rarity: 'common', weight: 80 },
  { id: 'sleep',    icon: '😴', name: '打瞌睡',   rarity: 'common', weight: 70 },
  { id: 'snack',    icon: '🍜', name: '吃零食',   rarity: 'uncommon', weight: 40 },
  { id: 'shop',     icon: '🛒', name: '逛淘宝',   rarity: 'uncommon', weight: 35 },
  { id: 'gossip',   icon: '💬', name: '聊八卦',   rarity: 'rare', weight: 15 },
  { id: 'game',     icon: '🎮', name: '偷偷游戏', rarity: 'rare', weight: 10 },
];

/**
 * 根据权重随机选择基础卡
 */
export function randomNormalCard(excludeIds) {
  excludeIds = excludeIds || [];
  var pool = NORMAL_CARDS.filter(function (c) {
    return excludeIds.indexOf(c.id) === -1;
  });
  var totalWeight = pool.reduce(function (sum, c) { return sum + c.weight; }, 0);
  var r = Math.random() * totalWeight;
  var acc = 0;
  for (var i = 0; i < pool.length; i++) {
    acc += pool[i].weight;
    if (r <= acc) return pool[i];
  }
  return pool[pool.length - 1];
}

// 功能卡类型标记
export var FUNC_TYPE = {
  NEGATIVE: 'negative',
  POSITIVE: 'positive',
  DUAL: 'dual',
};

// 功能卡片配置（10种，点击揭示）
export var FUNC_CARDS = [
  // 负面卡
  { id: 'boss_patrol',    icon: '⚠️', name: '老板巡视', type: FUNC_TYPE.NEGATIVE,
    effect: 'boss_patrol', revealIcon: '⚠️', revealName: '老板巡视', weight: 30 },
  { id: 'emergency_meet', icon: '📞', name: '紧急会议', type: FUNC_TYPE.NEGATIVE,
    effect: 'lock_cards', revealIcon: '📞', revealName: '紧急会议', weight: 15 },
  { id: 'printer_jam',    icon: '🖨️', name: '卡纸打印机', type: FUNC_TYPE.NEGATIVE,
    effect: 'slot_limit_down', revealIcon: '🖨️', revealName: '卡纸打印机', weight: 15 },
  { id: 'system_crash',   icon: '💻', name: '系统崩溃', type: FUNC_TYPE.NEGATIVE,
    effect: 'shuffle_slots', revealIcon: '💻', revealName: '系统崩溃', weight: 25 },
  { id: 'new_task',       icon: '📋', name: '临时加需求', type: FUNC_TYPE.NEGATIVE,
    effect: 'add_cards_to_board', revealIcon: '📋', revealName: '临时加需求', weight: 15 },

  // 正面卡
  { id: 'paid_leave',     icon: '🌟', name: '带薪年假', type: FUNC_TYPE.POSITIVE,
    effect: 'wild_card', revealIcon: '🌟', revealName: '带薪年假', weight: 15 },
  { id: 'colleague_coffee', icon: '☕', name: '同事请咖啡', type: FUNC_TYPE.POSITIVE,
    effect: 'remove_most', revealIcon: '☕', revealName: '同事请咖啡', weight: 15 },
  { id: 'early_leave',    icon: '🎫', name: '提前下班券', type: FUNC_TYPE.POSITIVE,
    effect: 'add_steps_3', revealIcon: '🎫', revealName: '提前下班券', weight: 8 },
  { id: 'boss_favor',     icon: '🍀', name: '领导的宠儿', type: FUNC_TYPE.POSITIVE,
    effect: 'immune_negative_3', revealIcon: '🍀', revealName: '领导的宠儿', weight: 15 },
  { id: 'reimburse',      icon: '💰', name: '报销通过', type: FUNC_TYPE.POSITIVE,
    effect: 'double_happy_10', revealIcon: '💰', revealName: '报销通过', weight: 12 },

  // 双刃剑卡
  { id: 'job_rotate',     icon: '🔀', name: '岗位轮换', type: FUNC_TYPE.DUAL,
    effect: 'random_transform_one', revealIcon: '🔀', revealName: '岗位轮换', weight: 20 },
  { id: 'overtime',       icon: '⏳', name: '加班申请', type: FUNC_TYPE.DUAL,
    effect: 'add_steps_5_boss_rise', revealIcon: '⏳', revealName: '加班申请', weight: 15 },
  { id: 'dept_dinner',    icon: '🍺', name: '部门聚餐', type: FUNC_TYPE.DUAL,
    effect: 'remove_3_slot_down', revealIcon: '🍺', revealName: '部门聚餐', weight: 15 },
  { id: 'weekly_report',  icon: '📊', name: '全员周报', type: FUNC_TYPE.DUAL,
    effect: 'reveal_add_boss', revealIcon: '📊', revealName: '全员周报', weight: 12 },
];

/**
 * 按权重随机选择功能卡
 */
export function randomFuncCard(typeFilter) {
  var pool = FUNC_CARDS;
  if (typeFilter) {
    pool = FUNC_CARDS.filter(function (c) { return c.type === typeFilter; });
  }
  var totalWeight = pool.reduce(function (sum, c) { return sum + c.weight; }, 0);
  var r = Math.random() * totalWeight;
  var acc = 0;
  for (var i = 0; i < pool.length; i++) {
    acc += pool[i].weight;
    if (r <= acc) return pool[i];
  }
  return pool[0];
}
