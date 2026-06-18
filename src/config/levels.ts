import type { LevelConfig } from '../core/types'

export const LEVELS: Record<string, LevelConfig> = {
  // 教学关 — 几乎不可能失败，学会基础操作
  level1: {
    id: 'level1',
    name: '第一关·摸鱼入门',
    normalCardTypes: 3,        // 仅 3 种卡，每种 6 张
    funcCardCount: 0,          // 无功能卡干扰
    funcTypes: [],
    layers: 2,
    gridRows: 3,
    gridCols: 3,               // 3×3 整齐布局
    totalCards: 18,            // 9底 + 9顶
    steps: 27,                 // 18×1.5，极其充裕
    slotLimit: 7,
    layerCards: [9, 9],        // 两层各 9 张，整齐排列
    gapRatio: 0,               // 使用固定 20px 间距
  },
  // 地狱关 — 通关率 3-8%，5层金字塔密集堆叠
  level2: {
    id: 'level2',
    name: '第二关·地狱',
    normalCardTypes: 6,        // 6种卡：3种常见+3种稀有，高分散难凑齐
    funcCardCount: 9,          // 适量功能卡（约14%）
    funcTypes: ['negative', 'positive', 'dual'],
    funcRatio: { negative: 0.6, positive: 0.2, dual: 0.2 },
    layers: 5,                 // 5层金字塔
    gridRows: 5,
    gridCols: 6,               // 6×5=30格，底层24张=80%密度
    totalCards: 66,            // 24+18+12+8+4=66张，22组消除
    steps: 46,                 // 紧凑步数，容错极低
    slotLimit: 7,              // 7槽
    layerCards: [24, 18, 12, 8, 4],  // 金字塔：底层密→顶层疏
    gapRatio: 0.08,            // 密集间距8%卡宽
  },
}

export function getLevelConfig(levelId: string): LevelConfig {
  return LEVELS[levelId] || LEVELS.level1
}
