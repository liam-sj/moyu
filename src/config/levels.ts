import type { LevelConfig } from '../core/types'

export const LEVELS: Record<string, LevelConfig> = {
  level1: {
    id: 'level1',
    name: '第一关·浅滩',
    normalCardTypes: 3,
    funcCardCount: 0,
    funcTypes: [],
    layers: 2,
    gridRows: 3,
    gridCols: 3,
    totalCards: 18,
    steps: 99,
    slotLimit: 7,
    layerCards: [9, 9],
    gapRatio: 0.12,
    clusterLayers: [],
    verticalShift: -0.15,
  },
  level2: {
    id: 'level2',
    name: '第二关·深渊',
    normalCardTypes: 12,
    funcCardCount: 9,
    funcTypes: ['shark', 'pearl', 'octopus'],
    funcRatio: { negative: 1, positive: 1, dual: 1 },
    layers: 9,
    gridRows: 6,
    gridCols: 6,
    totalCards: 120,
    steps: 99,
    slotLimit: 7,
    layerCards: [28, 24, 20, 16, 12, 10, 6, 2, 2],
    gapRatio: 0.06,
    clusterLayers: [2, 3, 4, 5, 6, 7, 8],
    verticalShift: -0.14,
  },
}

export function getLevelConfig(levelId: string): LevelConfig {
  return LEVELS[levelId] || LEVELS.level1
}
