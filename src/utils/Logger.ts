let DEBUG = true

export function setDebug(enabled: boolean): void {
  DEBUG = enabled
}

export function log(tag: string, msg: string, data?: unknown): void {
  if (!DEBUG) return
  if (data !== undefined) {
    console.log(`[${tag}] ${msg}`, data)
  } else {
    console.log(`[${tag}] ${msg}`)
  }
}

export function warn(tag: string, msg: string, data?: unknown): void {
  if (data !== undefined) {
    console.warn(`[${tag}] ${msg}`, data)
  } else {
    console.warn(`[${tag}] ${msg}`)
  }
}

export function error(tag: string, msg: string, data?: unknown): void {
  if (data !== undefined) {
    console.error(`[${tag}] ${msg}`, data)
  } else {
    console.error(`[${tag}] ${msg}`)
  }
}
