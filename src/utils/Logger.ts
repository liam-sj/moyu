/**
 * 全局唯一日志实例
 *
 * 用法:
 *   import logger from '../utils/Logger'
 *   logger.info('GameScene', 'entered')
 *   logger.warn('MenuScene', 'oops', err)
 *
 * 控制:
 *   logger.setLevel('warn')           // 只显示 warn + error
 *   logger.enableModules(['GameScene']) // 只看指定模块
 *   logger.disableAll()                // 关闭全部
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'off'

const LV: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3, off: 4 }

class Logger {
  private _level: LogLevel = 'debug'
  /** null = all modules allowed */
  private _modules: Set<string> | null = null

  // ── Controls ──

  setLevel(level: LogLevel): void { this._level = level }
  get level(): LogLevel { return this._level }

  /** Whitelist modules. Pass [] to allow all. */
  enableModules(tags: string[]): void {
    this._modules = tags.length > 0 ? new Set(tags) : null
  }

  /** Production: only warn + error */
  productionMode(): void { this._level = 'warn' }
  disableAll(): void { this._level = 'off' }

  // ── Log methods ──

  debug(tag: string, msg: string, data?: unknown): void { this._emit('debug', tag, msg, data) }
  info(tag: string, msg: string, data?: unknown): void { this._emit('info', tag, msg, data) }
  warn(tag: string, msg: string, data?: unknown): void { this._emit('warn', tag, msg, data) }
  error(tag: string, msg: string, data?: unknown): void { this._emit('error', tag, msg, data) }

  // ── Internal ──

  private _emit(level: LogLevel, tag: string, msg: string, data?: unknown): void {
    if (typeof console === 'undefined') return
    if (LV[level] < LV[this._level]) return
    if (this._modules !== null && !this._modules.has(tag)) return

    const fn = level === 'error' ? console.error
      : level === 'warn' ? console.warn
      : console.log

    if (data !== undefined) {
      fn(`[${tag}] ${msg}`, data)
    } else {
      fn(`[${tag}] ${msg}`)
    }
  }
}

const logger = new Logger()
export default logger

// ── Backward-compatible named exports (prefer `import logger from ...`) ──

let _debug = true

export function setDebug(enabled: boolean): void {
  _debug = enabled
  logger.setLevel(enabled ? 'debug' : 'off')
}

export function log(tag: string, msg: string, data?: unknown): void {
  if (!_debug) return
  logger.debug(tag, msg, data)
}

export function warn(tag: string, msg: string, data?: unknown): void {
  logger.warn(tag, msg, data)
}

export function error(tag: string, msg: string, data?: unknown): void {
  logger.error(tag, msg, data)
}
