import type { LevelConfig } from '../core/types'

export const LEVELS: Record<string, LevelConfig> = {
  // 教学关 — 几乎不可能失败，学会基础操作
  level1: {
    id: 'level1',
    name: '第一关·DEV',
    normalCardTypes: 2,        // DEV
    funcCardCount: 0,
    funcTypes: [],
    layers: 1,
    gridRows: 2,
    gridCols: 3,
    totalCards: 6,
    steps: 99,
    slotLimit: 10,
    layerCards: [6],
    gapRatio: 0,
  },
  level2: {
    id: 'level2',
    name: '第二关·DEV',
    normalCardTypes: 2,        // DEV
    funcCardCount: 0,
    funcTypes: [],
    layers: 1,
    gridRows: 2,
    gridCols: 3,
    totalCards: 6,
    steps: 99,
    slotLimit: 10,
    layerCards: [6],
    gapRatio: 0.50,            // DEV: 宽间距
  },
}

export function getLevelConfig(levelId: string): LevelConfig {
  return LEVELS[levelId] || LEVELS.level1
}
