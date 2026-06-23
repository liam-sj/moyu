import type { LevelConfig } from '../core/types'

export const LEVELS: Record<string, LevelConfig> = {
  // 教学关 — 单层平铺，熟悉操作
  level1: {
    id: 'level1',
    name: '第一关·浅滩',
    normalCardTypes: 3,
    funcCardCount: 0,
    funcTypes: [],
    layers: 1,
    gridRows: 3,
    gridCols: 4,
    totalCards: 12,
    steps: 99,
    slotLimit: 7,
    layerCards: [12],
    gapRatio: 0,
  },
  // 深渊关 — 9层金字塔
  level2: {
    id: 'level2',
    name: '第二关·深渊',
    normalCardTypes: 7,         // 12种鱼里随机7种（留空间给功能卡）
    funcCardCount: 9,           // 9张功能卡（3种×各3张）
    funcTypes: ['shark', 'pearl', 'octopus'],
    funcRatio: { negative: 1, positive: 1, dual: 1 },
    layers: 9,
    gridRows: 6,
    gridCols: 6,
    totalCards: 96,
    steps: 99,
    slotLimit: 7,
    // 9层金字塔：底22→顶2，逐层递减
    layerCards: [22, 18, 14, 12, 10, 8, 6, 4, 2],
    gapRatio: 0.08,             // 紧凑排列
    clusterLayers: [4, 5, 6, 7, 8],
  },
}

export function getLevelConfig(levelId: string): LevelConfig {
  return LEVELS[levelId] || LEVELS.level1
}
