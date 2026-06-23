const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

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
    const { pondId } = event
    const date = todayStr()
    const openId = cloud.getWXContext().OPENID

    if (!pondId) return { ok: false, reason: 'missing_pondId' }

    // ── Parallel: 3 independent queries ──
    const [allPonds, contribs, streakResult] = await Promise.all([
      safeGet(db.collection('pond_daily_stats').where({ date }).orderBy('dailyClears', 'desc')),
      safeGet(db.collection('contributions').where({ pondId, date })),
      safeGet(db.collection('pond_streaks').where({ pondId }))
    ])

    // Extract target pond stats from allPonds (no separate query needed)
    const stat = allPonds.data.find(p => p.pondId === pondId) || { dailyClears: 0, activePlayers: [] }
    const rank = allPonds.data.findIndex(p => p.pondId === pondId) + 1

    // Heroes: group contributions by openId
    const byPlayer = {}
    for (const c of contribs.data) {
      const uid = c.openId
      if (!byPlayer[uid]) {
        byPlayer[uid] = {
          nickName: c.nickName || '',
          avatarUrl: c.avatarUrl || '',
          fishId: c.fishId || '',
          todayClears: 0
        }
      }
      byPlayer[uid].todayClears++
    }

    const heroes = Object.values(byPlayer)
      .sort((a, b) => b.todayClears - a.todayClears)
      .slice(0, 10)

    // My contribution — from already-fetched data (no extra query)
    const myContribution = openId
      ? contribs.data.filter(c => c.openId === openId).length
      : 0

    // Streak
    const streakDays = streakResult.data.length > 0 ? streakResult.data[0].streakDays : 0

    return {
      ok: true,
      pondId,
      pondName: POND_NAMES[pondId] || pondId,
      fishEmoji: FISH_EMOJIS[pondId] || '🐟',
      rank: rank > 0 ? rank : allPonds.data.length + 1,
      dailyClears: stat.dailyClears || 0,
      activePlayers: (stat.activePlayers || []).length,
      perCapita: (stat.activePlayers || []).length > 0
        ? Math.round((stat.dailyClears / stat.activePlayers.length) * 100) / 100
        : 0,
      streakDays,
      myContribution,
      heroes
    }
  } catch (err) {
    console.error('[getPondDetail]', err)
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
