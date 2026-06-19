/**
 * Texture atlas coordinate mapping — computed dynamically from image size.
 */
export interface AtlasCell { x: number; y: number; w: number; h: number }

/** Built by loadCardAtlas after the image loads */
export let ATLAS: Record<string, AtlasCell> = {}

const CARD_ORDER = [
  'phone', 'toilet', 'sleep', 'snack', 'shop',       // row 1
  'gossip', 'game', 'question_mark', 'boss_patrol', 'printer_jam', // row 2
  'early_leave', 'paid_leave',                         // row 3
]

export function buildAtlas(imgW: number, imgH: number, cols = 5, rows = 3): void {
  const CW = Math.floor(imgW / cols)
  const CH = Math.floor(imgH / rows)
  const map: Record<string, AtlasCell> = {}
  for (let i = 0; i < CARD_ORDER.length; i++) {
    map[CARD_ORDER[i]] = {
      x: (i % cols) * CW,
      y: Math.floor(i / cols) * CH,
      w: CW,
      h: CH,
    }
  }
  ATLAS = map
  console.log('[atlas] img=%dx%d grid=%dx%d cell=%dx%d cards=%d',
    imgW, imgH, cols, rows, CW, CH, Object.keys(map).length)
}

export function atlasKey(cardId: string, isEvent: boolean, isRevealed: boolean): string {
  if (isEvent && !isRevealed) return 'question_mark'
  return cardId
}

export const ATLAS_PATH = 'assets/cards/cards.png'
