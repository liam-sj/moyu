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
    normalCardTypes: 6,        // 6种卡：3种常见+3种稀有，高分散难凑齐
    funcCardCount: 12,         // 功能卡（约18%）
    funcTypes: ['negative', 'positive', 'dual'],
    funcRatio: { negative: 0.7, positive: 0.1, dual: 0.2 },
    layers: 10,                // 10层金字塔：5层底+5层聚集
    gridRows: 5,
    gridCols: 6,               // 6×5=30格
    totalCards: 84,            // 24+18+13+10+7+4+3+2+2+1=84, 28组消除
    steps: 85,                 // 84张卡+1步容错
    slotLimit: 6,
    layerCards: [24, 18, 13, 10, 7, 4, 3, 2, 2, 1],
    clusterLayers: [5, 6, 7, 8, 9],  // 顶层5层：3簇聚集，几乎重叠
    gapRatio: 0.08,
  },
}

export function getLevelConfig(levelId: string): LevelConfig {
  return LEVELS[levelId] || LEVELS.level1
}
