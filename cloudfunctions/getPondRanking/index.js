const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

/** Treat missing collection as empty */
async function safeGet(query) {
  try { return await query.get() }
  catch (e) { if (e.errCode === -502005) return { data: [] }; throw e }
}
async function safeCount(query) {
  try { return await query.count() }
  catch (e) { if (e.errCode === -502005) return { total: 0 }; throw e }
}

exports.main = async (event, context) => {
  try {
    const date = todayStr()
    const openId = cloud.getWXContext().OPENID

    // ── 1. Today's pond stats, ordered by dailyClears ──
    const ponds = await safeGet(
      db.collection('pond_daily_stats').where({ date }).orderBy('dailyClears', 'desc')
    )
    console.log('[getPondRanking] found', ponds.data.length, 'ponds for', date)

    // ── 2. All today's contributions — group by pondId + openId in JS ──
    const allContribs = await safeGet(db.collection('contributions').where({ date }))

    // Group: { pondId: { openId: { url, nickName, fishId, count } } }
    const byPond = {}
    for (const c of allContribs.data) {
      const pid = c.pondId
      const uid = c.openId
      if (!byPond[pid]) byPond[pid] = {}
      if (!byPond[pid][uid]) {
        byPond[pid][uid] = {
          url: c.avatarUrl || '',
          nickName: c.nickName || '',
          fishId: c.fishId || '',
          count: 0
        }
      }
      byPond[pid][uid].count++
    }

    // Build contributors arrays (sorted by count desc) — for avatar display
    const contributors = {}
    for (const pid of Object.keys(byPond)) {
      contributors[pid] = Object.entries(byPond[pid])
        .map(([openId, info]) => ({ openId, ...info }))
        .sort((a, b) => b.count - a.count)
    }

    // Build fishEntries — flat list, one per contribution, each keeps its own fishId
    const fishEntries = {}
    for (const c of allContribs.data) {
      const pid = c.pondId
      if (!fishEntries[pid]) fishEntries[pid] = []
      fishEntries[pid].push({
        url: c.avatarUrl || '',
        fishId: c.fishId || ''
      })
    }

    // ── 3. My pond info ──
    let myPond = null
    if (openId) {
      const player = await safeGet(db.collection('players').where({ openId }))
      if (player.data.length > 0) {
        const p = player.data[0]
        const rank = ponds.data.findIndex(r => r.pondId === p.pondId) + 1
        // Count today's contributions for this player
        const myContribs = await safeCount(
          db.collection('contributions').where({ openId, date })
        )
        myPond = {
          pondId: p.pondId,
          fishId: p.fishId,
          rank: rank > 0 ? rank : 0,
          todayContribution: myContribs.total,
          joinDate: p.joinDate,
          switchCount: p.switchCount || 0,
          avatarUrl: p.avatarUrl || '',
          nickName: p.nickName || '',
          fishSelectionShown: p.fishSelectionShown || false,
          clearedLevel2: p.clearedLevel2 || false
        }
      }
    }

    // ── 4. Rankings ──

    // 4a. 今日最肥 (by dailyClears)
    const fatPondRank = ponds.data.slice(0, 12).map((p, i) => ({
      pondId: p.pondId,
      rank: i + 1,
      dailyClears: p.dailyClears,
      date: p.date,
      activePlayers: (p.activePlayers || []).length,
      pondName: POND_NAMES[p.pondId] || p.pondId,
      fishEmoji: FISH_EMOJIS[p.pondId] || '🐟'
    }))

    // 4b. 人均摸鱼王 (dailyClears / activePlayers)
    const withPerCapita = ponds.data
      .map(p => ({
        ...p,
        perCapita: (p.activePlayers || []).length > 0
          ? p.dailyClears / (p.activePlayers || []).length
          : 0
      }))
      .sort((a, b) => b.perCapita - a.perCapita)

    const perCapitaRank = withPerCapita.slice(0, 12).map((p, i) => ({
      pondId: p.pondId,
      rank: i + 1,
      perCapita: Math.round(p.perCapita * 100) / 100,
      dailyClears: p.dailyClears,
      activePlayers: (p.activePlayers || []).length,
      pondName: POND_NAMES[p.pondId] || p.pondId,
      fishEmoji: FISH_EMOJIS[p.pondId] || '🐟'
    }))

    // 4c. 连续霸榜
    const streaks = await safeGet(
      db.collection('pond_streaks').orderBy('streakDays', 'desc')
    )
    const streakRank = streaks.data.slice(0, 12).map((s, i) => ({
      pondId: s.pondId,
      rank: i + 1,
      streakDays: s.streakDays,
      pondName: POND_NAMES[s.pondId] || s.pondId,
      fishEmoji: FISH_EMOJIS[s.pondId] || '🐟'
    }))

    return {
      ok: true,
      fatPondRank,
      perCapitaRank,
      streakRank,
      myPond,
      contributors,
      fishEntries
    }
  } catch (err) {
    console.error('[getPondRanking]', err)
    return { ok: false }
  }
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const POND_NAMES = {
  moyutang: '摸鱼塘', xianyutang: '咸鱼塘', jinlitang: '锦鲤塘', hetuntang: '河豚塘',
  moyutang2: '墨鱼塘', haimatang: '海马塘', feiyutang: '飞鱼塘', zhangyutang: '章鱼塘',
  bimuyutang: '比目鱼塘', pangxietang: '螃蟹塘', jianyutang: '剑鱼塘', haituntang: '海豚塘'
}
const FISH_EMOJIS = {
  moyutang: '🐟', xianyutang: '🦐', jinlitang: '🐠', hetuntang: '🐡',
  moyutang2: '🦑', haimatang: '🐬', feiyutang: '🦅', zhangyutang: '🐙',
  bimuyutang: '🐟', pangxietang: '🦀', jianyutang: '⚔️', haituntang: '🐬'
}
