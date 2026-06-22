/**
 * Simple BGM manager for WeChat mini-game.
 * Uses wx.createInnerAudioContext() for seamless looping background music.
 * Audio won't autoplay — WeChat requires user gesture to start.
 * Call `AudioManager.init()` early, then `play()` on first touch.
 */
let _ctx: any = null
let _inited = false
let _src = ''

export const AudioManager = {
  /** Call once on app start to set up the audio context */
  init(src: string): void {
    _src = src
    if (typeof wx === 'undefined') return
    try {
      _ctx = wx.createInnerAudioContext()
      _ctx.obeyMuteSwitch = false  // play even when phone is in silent mode
      _ctx.loop = true
      _ctx.volume = 0.35
      _ctx.src = src
      // Debug events
      _ctx.onCanplay(() => console.log('[AudioManager] canplay'))
      _ctx.onPlay(() => console.log('[AudioManager] playing'))
      _ctx.onError((e: any) => console.warn('[AudioManager] error', e?.errMsg || e))
      _inited = true
    } catch (e) { console.warn('[AudioManager] init failed', e) }
  },

  /** Start playback. Safe to call multiple times. */
  play(): void {
    if (!_inited || !_ctx) {
      if (_src) this.init(_src)
      if (!_ctx) return
    }
    try {
      _ctx.play()
      console.log('[AudioManager] play() called')
    } catch (e) { console.warn('[AudioManager] play() error', e) }
  },

  /** Pause BGM */
  pause(): void {
    try { _ctx?.pause() } catch (e) { /* ignore */ }
  },

  /** Resume from pause */
  resume(): void {
    this.play()
  },

  /** Set volume 0.0 - 1.0 */
  setVolume(v: number): void {
    try { if (_ctx) _ctx.volume = Math.max(0, Math.min(1, v)) } catch (e) { /* ignore */ }
  },

  /** Stop and destroy the audio context */
  destroy(): void {
    try {
      if (_ctx) { _ctx.stop(); _ctx.destroy(); _ctx = null }
    } catch (e) { /* ignore */ }
    _inited = false
  },
}
