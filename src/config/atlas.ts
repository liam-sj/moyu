/**
 * Texture atlas coordinate mapping — computed dynamically from image size.
 */
export interface AtlasCell { x: number; y: number; w: number; h: number }

/** Built by loadCardAtlas after the image loads */
export let ATLAS: Record<string, AtlasCell> = {}

// First 3 rows of new-fishs.png atlas (4 cols × 3 rows = 12 fish)
const CARD_ORDER = [
  'xiaojinyu', 'xianyugan', 'jinli', 'hetun',           // row 1
  'moyu', 'haima', 'feiyu', 'zhangyu',                   // row 2
  'bimuyu', 'pangxie', 'jianyu', 'haitun',               // row 3
]

export function buildAtlas(imgW: number, imgH: number, cols = 4, rows = 4): void {
  const CW = Math.floor(imgW / cols)
  const CH = Math.floor(imgH / rows)
  const map: Record<string, AtlasCell> = {}
  for (let i = 0; i < CARD_ORDER.length; i++) {
    // card i uses row = floor(i / cols), col = i % cols
    const col = i % cols
    const row = Math.floor(i / cols)
    map[CARD_ORDER[i]] = {
      x: col * CW + Math.floor(CW * 0.05),       // 5% inset
      y: row * CH + Math.floor(CH * 0.05),
      w: CW - Math.floor(CW * 0.10),              // 10% narrower (crop blank edges)
      h: CH - Math.floor(CH * 0.10),
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

export const ATLAS_PATH = 'assets/fishs.png'
