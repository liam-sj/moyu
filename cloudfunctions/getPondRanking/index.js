const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const POND_IDS = ['moyutang','xianyutang','jinlitang','hetuntang','moyutang2','haimatang','feiyutang','zhangyutang','bimuyutang','pangxietang','jianyutang','haituntang']

exports.main = async (event, context) => {
  try {
    const date = todayStr()

    // Get today's pond stats ordered by dailyClears desc
    console.log('[getPondRanking] query date=', date)
    const ponds = await db.collection('pond_stats').where({ date }).orderBy('dailyClears', 'desc').get()
    console.log('[getPondRanking] found', ponds.data.length, 'ponds')

    const openId = cloud.getWXContext().OPENID
    let myPond = null
    if (openId) {
      const player = await db.collection('player_ponds').where({ openId }).get()
      if (player.data.length > 0) {
        const p = player.data[0]
        const rank = ponds.data.findIndex(r => r.pondId === p.pondId) + 1
        myPond = {
          pondId: p.pondId, fishId: p.fishId,
          rank, todayContribution: p.todayContribution,
          joinDate: p.joinDate, switchCount: p.switchCount
        }
      }
    }

    // 1. 今日最肥 (fat pond rank - by dailyClears)
    const fatPondRank = ponds.data.slice(0, 12).map((p, i) => ({
      pondId: p.pondId,
      rank: i + 1,
      dailyClears: p.dailyClears,
      date: p.date,
      pondName: POND_NAMES[p.pondId] || p.pondId,
      fishEmoji: FISH_EMOJIS[p.pondId] || '🐟'
    }))

    // 2. 人均摸鱼王 (per capita rank - by dailyClears / activeMembers)
    const pondsWithPerCapita = ponds.data.map(p => ({
      ...p,
      perCapita: p.activeMembers > 0 ? p.dailyClears / p.activeMembers : 0
    })).sort((a, b) => b.perCapita - a.perCapita)

    const perCapitaRank = pondsWithPerCapita.slice(0, 12).map((p, i) => ({
      pondId: p.pondId,
      rank: i + 1,
      perCapita: Math.round(p.perCapita * 100) / 100,
      dailyClears: p.dailyClears,
      activeMembers: p.activeMembers,
      pondName: POND_NAMES[p.pondId] || p.pondId,
      fishEmoji: FISH_EMOJIS[p.pondId] || '🐟'
    }))

    // 3. 连续霸榜 (streak rank - consecutive days as #1)
    const streaks = await db.collection('pond_streaks').orderBy('streakDays', 'desc').get()
    const streakRank = streaks.data.slice(0, 12).map((s, i) => ({
      pondId: s.pondId,
      rank: i + 1,
      streakDays: s.streakDays,
      pondName: POND_NAMES[s.pondId] || s.pondId,
      fishEmoji: FISH_EMOJIS[s.pondId] || '🐟'
    }))

    // Get contributor avatars per pond
    const pondIds = POND_IDS
    const contributors = {}
    for (const pid of pondIds) {
      const topPlayers = await db.collection('player_ponds')
        .where({ pondId: pid, todayContribution: _.gt(0) })
        .orderBy('todayContribution', 'desc')
        .limit(5)
        .get()
      contributors[pid] = topPlayers.data
        .filter(p => p.avatarUrl)
        .map(p => ({ url: p.avatarUrl, count: p.todayContribution }))
    }

    return {
      ok: true,
      fatPondRank,
      perCapitaRank,
      streakRank,
      myPond,
      contributors
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
