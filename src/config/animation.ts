/**
 * Global animation speed coefficient.
 * > 1.0 = faster, < 1.0 = slower.
 * Does NOT affect dealing (card distribution) speed — that is controlled
 * separately via layerDelay / cardDelay in GameScene.
 */
export const ANIM_SPEED = 1.5

/** Apply speed coefficient to a duration value (frames or ms). */
export function speedUp(value: number): number {
  return Math.max(1, Math.round(value / ANIM_SPEED))
}
