interface IStorage {
  get<T>(key: string, def: T): T
  set(key: string, val: unknown): void
}

class WebStorage implements IStorage {
  get<T>(key: string, def: T): T {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : def
    } catch {
      return def
    }
  }
  set(key: string, val: unknown): void {
    try { localStorage.setItem(key, JSON.stringify(val)) } catch { /* ignore */ }
  }
}

class WxStorage implements IStorage {
  get<T>(key: string, def: T): T {
    try {
      const raw = wx.getStorageSync(key)
      return raw ? (JSON.parse(raw) as T) : def
    } catch {
      return def
    }
  }
  set(key: string, val: unknown): void {
    try { wx.setStorageSync(key, JSON.stringify(val)) } catch { /* ignore */ }
  }
}

export const storage: IStorage =
  typeof wx !== 'undefined' ? new WxStorage() : new WebStorage()
