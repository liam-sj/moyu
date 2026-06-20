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
    gapRatio: 0,               // 固定间距模式
  },
  // 地狱关 — 通关率 3-8%，5层金字塔密集堆叠
  level2: {
    id: 'level2',
    name: '第二关·地狱',
    normalCardTypes: 4,        // DEV: 仅4种卡
    funcCardCount: 0,          // DEV: 无功能卡
    funcTypes: [],
    layers: 5,                 // DEV: 5层
    gridRows: 5,
    gridCols: 6,
    totalCards: 66,
    steps: 150,                // DEV: 超充裕
    slotLimit: 8,
    layerCards: [24, 18, 12, 8, 4],
    clusterLayers: [5, 6, 7, 8, 9],  // 顶层5层：3簇聚集，几乎重叠
    gapRatio: 0.08,
  },
}

export function getLevelConfig(levelId: string): LevelConfig {
  return LEVELS[levelId] || LEVELS.level1
}
