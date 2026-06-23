import * as PIXI from 'pixi.js-legacy'
import { getDPR } from '../platform/PixiAdapter'

/** Single swimming fish with state-machine animation */
/** Load fish sprite sheet once */
let _fishTexture: PIXI.BaseTexture | null = null
/** Callbacks fired when atlas finishes loading — so views can re-render fish */
const _onReadyCallbacks: Array<() => void> = []

export function onFishAtlasReady(cb: () => void): void {
  if (_fishTexture) { cb(); return }
  _onReadyCallbacks.push(cb)
}

export function loadFishAtlas(url: string): void {
  const img = wx.createImage()
  img.onload = () => {
    const canvas = wx.createCanvas()
    canvas.width = img.width; canvas.height = img.height
    canvas.getContext('2d').drawImage(img, 0, 0)
    _fishTexture = PIXI.BaseTexture.from(canvas)
    // Notify all waiting views to re-render with real sprites
    const cbs = _onReadyCallbacks.splice(0)
    for (const cb of cbs) cb()
  }
  img.onerror = () => { /* keep emoji fallback */ }
  img.src = url
}

export function isFishAtlasReady(): boolean { return _fishTexture !== null }

const FISH_ORDER = ['xiaojinyu','xianyugan','jinli','hetun','moyu','haima','feiyu','zhangyu','bimuyu','pangxie','jianyu','haitun','__announcer__']

/** Fish behavior traits based on real-world characteristics */
interface FishTraits {
  baseSpeed: number        // horizontal speed multiplier
  vertSpeed: number        // vertical drift speed
  dashChance: number       // probability of spontaneous dash
  dashSpeedMul: number     // speed multiplier during dash
  turnChance: number       // probability of turn vs pause
  pauseChance: number      // probability of pause after cruise
  pauseDuration: number    // base pause duration (frames)
  wagStrength: number      // body sway intensity
}
const FISH_TRAITS: Record<string, FishTraits> = {
  xiaojinyu:  { baseSpeed: 0.12, vertSpeed: 0.04, dashChance: 0.04, dashSpeedMul: 5,  turnChance: 0.30, pauseChance: 0.20, pauseDuration: 80,  wagStrength: 0.03 },
  xianyugan:  { baseSpeed: 0.08, vertSpeed: 0.02, dashChance: 0.02, dashSpeedMul: 3,  turnChance: 0.20, pauseChance: 0.35, pauseDuration: 120, wagStrength: 0.02 },
  jinli:      { baseSpeed: 0.16, vertSpeed: 0.06, dashChance: 0.07, dashSpeedMul: 6,  turnChance: 0.30, pauseChance: 0.15, pauseDuration: 60,  wagStrength: 0.04 },
  hetun:      { baseSpeed: 0.10, vertSpeed: 0.03, dashChance: 0.06, dashSpeedMul: 8,  turnChance: 0.25, pauseChance: 0.25, pauseDuration: 70,  wagStrength: 0.04 },
  moyu:       { baseSpeed: 0.18, vertSpeed: 0.05, dashChance: 0.08, dashSpeedMul: 7,  turnChance: 0.35, pauseChance: 0.15, pauseDuration: 50,  wagStrength: 0.05 },
  haima:      { baseSpeed: 0.06, vertSpeed: 0.08, dashChance: 0.02, dashSpeedMul: 3,  turnChance: 0.20, pauseChance: 0.30, pauseDuration: 100, wagStrength: 0.02 },
  feiyu:      { baseSpeed: 0.20, vertSpeed: 0.04, dashChance: 0.10, dashSpeedMul: 9,  turnChance: 0.40, pauseChance: 0.10, pauseDuration: 40,  wagStrength: 0.05 },
  zhangyu:    { baseSpeed: 0.10, vertSpeed: 0.03, dashChance: 0.05, dashSpeedMul: 6,  turnChance: 0.30, pauseChance: 0.20, pauseDuration: 70,  wagStrength: 0.06 },
  bimuyu:     { baseSpeed: 0.07, vertSpeed: 0.01, dashChance: 0.03, dashSpeedMul: 4,  turnChance: 0.15, pauseChance: 0.35, pauseDuration: 100, wagStrength: 0.02 },
  pangxie:    { baseSpeed: 0.08, vertSpeed: 0,     dashChance: 0.06, dashSpeedMul: 5,  turnChance: 0.25, pauseChance: 0.25, pauseDuration: 90,  wagStrength: 0.02 },
  jianyu:     { baseSpeed: 0.22, vertSpeed: 0.03, dashChance: 0.12, dashSpeedMul: 10, turnChance: 0.35, pauseChance: 0.10, pauseDuration: 40,  wagStrength: 0.04 },
  haitun:     { baseSpeed: 0.17, vertSpeed: 0.07, dashChance: 0.10, dashSpeedMul: 7,  turnChance: 0.40, pauseChance: 0.12, pauseDuration: 50,  wagStrength: 0.05 },
  __announcer__:{ baseSpeed: 0.12,vertSpeed: 0.04, dashChance: 0.01, dashSpeedMul: 4,  turnChance: 0.25, pauseChance: 0.20, pauseDuration: 100, wagStrength: 0.03 },
}

export function getFishTex(fishId: string, idx: number = 0): PIXI.Texture | null {
  if (!_fishTexture) return null
  const fishIdx = FISH_ORDER.indexOf(fishId)
  if (fishIdx < 0) return null
  const cols = 4; const CW = _fishTexture.width / cols; const CH = _fishTexture.height / 4
  const col = fishIdx % cols; const row = Math.floor(fishIdx / cols)
  const isShark = fishId === '__announcer__'
  const w = isShark ? CW * 2 : CW
  return new PIXI.Texture(_fishTexture, new PIXI.Rectangle(col * CW, row * CH, w, CH))
}

export class FishView {
  readonly sprite: PIXI.Sprite
  readonly container: PIXI.Container
  vx: number
  vy: number
  private phase: number
  state: string
  stateTimer: number
  private _traits: FishTraits
  private _avatarSprite: PIXI.Sprite | null = null
  _destroyed = false
  /** Crab lives at the bottom — restricted vertical movement */
  readonly bottomDweller: boolean

  private _createSprite(tex: PIXI.Texture, fishId: string, size: number): PIXI.Sprite {
    const sp = new PIXI.Sprite(tex)
    sp.anchor.set(0.5)
    sp.height = size
    sp.width = tex.width * (size / tex.height)
    return sp
  }

  constructor(fishId: string, idx: number, x: number, y: number, size: number) {
    this._traits = FISH_TRAITS[fishId] || FISH_TRAITS.xiaojinyu
    this.bottomDweller = fishId === 'pangxie'
    this.container = new PIXI.Container()
    this.container.x = x; this.container.y = y

    const tex = getFishTex(fishId, idx)
    if (tex) {
      this.sprite = this._createSprite(tex, fishId, size)
    } else {
      // Atlas not ready yet — use emoji placeholder, upgrade when loaded
      const emoji = fishId === '__announcer__' ? '🦈' : '🐟'
      this.sprite = new PIXI.Text(emoji, { fontFamily: 'sans-serif', fontSize: size, align: 'center' } as any)
      this.sprite.anchor.set(0.5)
      // Register callback to swap emoji → real sprite when atlas loads
      const self = this; const fId = fishId; const sz = size
      onFishAtlasReady(() => {
        if (!self.container || self._destroyed) return
        const newTex = getFishTex(fId, idx)
        if (newTex) {
          const oldSprite = self.sprite
          self.container.removeChild(oldSprite as any)
          if (oldSprite instanceof PIXI.Text) oldSprite.destroy()
          self.sprite = self._createSprite(newTex, fId, sz)
          self.container.addChildAt(self.sprite as any, 0)
        }
      })
    }
    this.sprite.x = 0; this.sprite.y = 0
    this.container.addChild(this.sprite as any)
    this.sprite.alpha = 0.85

    const t = this._traits
    this.vx = t.baseSpeed * (Math.random() > 0.5 ? 1 : -1)
    this.vy = t.vertSpeed * (Math.random() > 0.5 ? 1 : -1)
    this.phase = Math.random() * Math.PI * 2
    this.state = 'cruise'
    this.stateTimer = 60 + Math.random() * 120
  }

  update(dt: number, bounds: { x: number; y: number; w: number; h: number }, repeller?: { x: number; y: number }): void {
    const now = Date.now()
    const t = this._traits

    // ── State machine ──
    this.stateTimer -= dt
    if (this.stateTimer <= 0) {
      const r = Math.random()
      if (this.state === 'cruise') {
        if (r < t.turnChance) this.state = 'turn'
        else if (r < t.turnChance + t.pauseChance) this.state = 'pause'
        else if (r < t.turnChance + t.pauseChance + t.dashChance) this.state = 'dash'
        else this.state = 'cruise'
      } else if (this.state === 'turn') {
        this.state = 'cruise'; this.vx *= -1
      } else {
        this.state = 'cruise'
      }
      this.stateTimer = this.state === 'pause' ? t.pauseDuration + Math.random() * 60 :
                       this.state === 'dash' ? 25 + Math.random() * 40 :
                       this.state === 'turn' ? 10 : 60 + Math.random() * 120
    }

    let speedMul = 1
    if (this.state === 'pause') speedMul = 0
    else if (this.state === 'dash') speedMul = t.dashSpeedMul
    else if (this.state === 'turn') speedMul = 0.3

    // Repulsion from announcer fish (shark) — turn away and dash
    if (repeller) {
      const dx = this.container.x - repeller.x
      const dy = this.container.y - repeller.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const repelRadius = 100
      if (dist < repelRadius && dist > 0) {
        // Push away
        const force = (repelRadius - dist) / repelRadius * 0.8
        this.container.x += (dx / dist) * force * dt
        this.container.y += (dy / dist) * force * dt
        // Turn to face away from shark + dash
        if (dist < repelRadius * 0.7 && this.state !== 'dash') {
          this.vx = Math.abs(this.vx) * (dx > 0 ? 1 : -1)  // face away from shark
          this.state = 'dash'
          this.stateTimer = 15 + Math.random() * 25
        }
      }
    }

    this.container.x += this.vx * dt * speedMul
    this.container.y += this.vy * dt * speedMul

    // Gentle bobbing when paused — avoids frozen/stuck appearance
    if (this.state === 'pause') {
      const bob = Math.sin(now * 0.004 + this.phase) * 0.15 * dt
      this.container.y += bob
    }

    // ── Boundary handling ──
    const margin = 28
    const bottomMargin = this.bottomDweller ? 8 : 150

    if (this.bottomDweller) {
      // Crab: stays near the bottom of pond
      const crabTop = bounds.y + bounds.h * 0.75
      const crabBottom = bounds.y + bounds.h - bottomMargin
      if (this.container.y < crabTop) { this.vy = Math.abs(this.vy); this.container.y = crabTop + 1 }
      if (this.container.y > crabBottom) { this.vy = -Math.abs(this.vy) * 0.3; this.container.y = crabBottom - 1 }
      if (this.container.x < bounds.x + margin) { this.vx = Math.abs(this.vx); this.container.x = bounds.x + margin + 1 }
      if (this.container.x > bounds.x + bounds.w - margin - 6) { this.vx = -Math.abs(this.vx); this.container.x = bounds.x + bounds.w - margin - 7 }
    } else {
      const wrapBuffer = 40
      if (this.container.x < bounds.x - wrapBuffer && this.vx < 0) {
        this.container.x = bounds.x + bounds.w + wrapBuffer
      }
      if (this.container.x > bounds.x + bounds.w + wrapBuffer && this.vx > 0) {
        this.container.x = bounds.x - wrapBuffer
      }

      const bouncedY = this.container.y < bounds.y + margin || this.container.y > bounds.y + bounds.h - bottomMargin
      if (bouncedY) {
        this.state = 'dash'
        this.stateTimer = 20 + Math.random() * 30
      }
      if (this.container.y < bounds.y + margin) { this.vy = Math.abs(this.vy) * 0.3; this.container.y = bounds.y + margin + 1 }
      if (this.container.y > bounds.y + bounds.h - bottomMargin) { this.vy = -Math.abs(this.vy) * 0.3; this.container.y = bounds.y + bounds.h - bottomMargin - 1 }
    }

    // Body animation
    const animMul = this.state === 'dash' ? 3 : this.state === 'pause' ? 0.2 : 1
    const dir = this.vx > 0 ? -1 : 1
    const wag = Math.sin(now * 0.003 + this.phase) * t.wagStrength * animMul
    this.container.scale.x = dir
    this.sprite.rotation = wag
  }

  /** Show avatar above the fish. Uses real image when available, generates default when not. */
  setAvatar(url: string): void {
    if (this._avatarSprite) return
    const self = this
    const fishSize = this.sprite.height || 30
    const avatarSize = Math.floor(fishSize * 0.5)

    const renderAvatar = (sourceCanvas?: any) => {
      if (!self.sprite || !self.container || self._destroyed || self._avatarSprite) return
      const dpr = getDPR()
      const canvas = wx.createCanvas()
      canvas.width = avatarSize * dpr; canvas.height = avatarSize * dpr
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
      ctx.scale(dpr, dpr)
      ctx.beginPath(); ctx.arc(avatarSize/2, avatarSize/2, avatarSize/2, 0, Math.PI * 2); ctx.clip()

      if (sourceCanvas) {
        // Real avatar image
        ctx.drawImage(sourceCanvas, 0, 0, avatarSize, avatarSize)
      } else {
        // Default avatar: colored circle with fish emoji
        const colors = ['#3498DB', '#E67E22', '#2ECC71', '#9B59B6', '#1ABC9C', '#E74C3C', '#F39C12', '#2980B9']
        const color = colors[Math.abs(hashCode(self.vx + self.vy)) % colors.length]
        ctx.fillStyle = color
        ctx.fill()
        ctx.fillStyle = '#FFFFFF'
        ctx.font = `${avatarSize * 0.55}px sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText('🐟', avatarSize / 2, avatarSize / 2 + 1)
      }

      const tex = PIXI.Texture.from(canvas)
      self._avatarSprite = new PIXI.Sprite(tex)
      self._avatarSprite.width = avatarSize; self._avatarSprite.height = avatarSize
      self._avatarSprite.anchor.set(0.5)
      self._avatarSprite.x = 0; self._avatarSprite.y = -fishSize * 0.5 - 6
      self.container.addChild(self._avatarSprite)
    }

    if (url) {
      const img = wx.createImage()
      img.onload = () => renderAvatar(img)
      img.onerror = () => renderAvatar()  // fallback to default
      img.src = url
    } else {
      renderAvatar()  // no URL, use default immediately
    }
  }

  destroy(): void { this._destroyed = true; this.container.destroy({ children: true }) }
}

/** Simple string hash for deterministic color assignment */
function hashCode(s: string | number): number {
  const str = String(s)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}
