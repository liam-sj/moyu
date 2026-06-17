import type { LevelConfig } from '../core/types'

export const LEVELS: Record<string, LevelConfig> = {
  level1: {
    id: 'level1',
    name: '第一关',
    normalCardTypes: 4,
    funcCardCount: 3,
    funcTypes: ['negative'],
    layers: 2,
    gridRows: 4,
    gridCols: 4,
    totalCards: 24,
    steps: 30,
    slotLimit: 7,
  },
  level2: {
    id: 'level2',
    name: '第二关',
    normalCardTypes: 7,
    funcCardCount: 12,
    funcTypes: ['negative', 'positive', 'dual'],
    funcRatio: { negative: 0.5, positive: 0.25, dual: 0.25 },
    layers: 4,
    gridRows: 5,
    gridCols: 5,
    totalCards: 48,
    steps: 35,
    slotLimit: 7,
  },
}

export function getLevelConfig(levelId: string): LevelConfig {
  return LEVELS[levelId] || LEVELS.level1
}
