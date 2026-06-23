/**
 * Lightweight caches for public read-only cloud data.
 * Uses wx.storage (synchronous, tiny JSON payloads) — these are NOT user
 * game state; they're shared ranking/detail snapshots with short TTLs.
 */

const RANKING_CACHE_KEY = 'pond_ranking_cache'
const RANKING_CACHE_TTL = 5 * 60 * 1000  // 5 minutes

const DETAIL_CACHE_PREFIX = 'pond_detail_'
const DETAIL_CACHE_TTL = 2 * 60 * 1000    // 2 minutes

function now(): number { return Date.now() }

// ── Ranking cache ──

export function getCachedRanking(): any | null {
  try {
    const raw = wx.getStorageSync(RANKING_CACHE_KEY)
    if (!raw) return null
    const entry = JSON.parse(raw)
    if (now() - entry.ts > RANKING_CACHE_TTL) return null
    return entry.data
  } catch { return null }
}

export function setCachedRanking(data: any): void {
  try {
    wx.setStorageSync(RANKING_CACHE_KEY, JSON.stringify({ ts: now(), data }))
  } catch { /* ignore */ }
}

export function clearRankingCache(): void {
  try { wx.removeStorageSync(RANKING_CACHE_KEY) } catch { /* ignore */ }
}

// ── Pond detail cache ──

function detailKey(pondId: string): string {
  return DETAIL_CACHE_PREFIX + pondId
}

export function getCachedDetail(pondId: string): any | null {
  try {
    const raw = wx.getStorageSync(detailKey(pondId))
    if (!raw) return null
    const entry = JSON.parse(raw)
    if (now() - entry.ts > DETAIL_CACHE_TTL) return null
    return entry.data
  } catch { return null }
}

export function setCachedDetail(pondId: string, data: any): void {
  try {
    wx.setStorageSync(detailKey(pondId), JSON.stringify({ ts: now(), data }))
  } catch { /* ignore */ }
}

export function clearDetailCache(pondId?: string): void {
  try {
    if (pondId) {
      wx.removeStorageSync(detailKey(pondId))
    } else {
      // Clear all detail caches
      const info = wx.getStorageInfoSync()
      for (const key of info.keys) {
        if (key.startsWith(DETAIL_CACHE_PREFIX)) wx.removeStorageSync(key)
      }
    }
  } catch { /* ignore */ }
}
