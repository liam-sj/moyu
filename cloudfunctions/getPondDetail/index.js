const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    const { pondId } = event
    const date = todayStr()
    const openId = cloud.getWXContext().OPENID

    if (!pondId) {
      return { ok: false, reason: 'missing_pondId' }
    }

    // Get pond stats for today
    const stats = await db.collection('pond_stats').where({ pondId, date }).get()
    const stat = stats.data[0] || { dailyClears: 0, activeMembers: 0, totalMembers: 0 }

    // Get ranking position (by dailyClears)
    const allPonds = await db.collection('pond_stats').where({ date }).orderBy('dailyClears', 'desc').get()
    const rank = allPonds.data.findIndex(p => p.pondId === pondId) + 1

    // Get top 10 contributors to this pond today
    const heroes = await db.collection('player_ponds')
      .where({ pondId })
      .orderBy('todayContribution', 'desc')
      .limit(10)
      .get()

    // Get streak data for this pond
    const streakResult = await db.collection('pond_streaks').where({ pondId }).get()
    const streakDays = streakResult.data.length > 0 ? streakResult.data[0].streakDays : 0

    // Check if current user is in this pond
    let myContribution = 0
    if (openId) {
      const player = await db.collection('player_ponds').where({ openId }).get()
      if (player.data.length > 0 && player.data[0].pondId === pondId) {
        myContribution = player.data[0].todayContribution || 0
      }
    }

    return {
      ok: true,
      pondId,
      pondName: POND_NAMES[pondId] || pondId,
      fishEmoji: FISH_EMOJIS[pondId] || '🐟',
      rank: rank > 0 ? rank : allPonds.data.length + 1,
      dailyClears: stat.dailyClears,
      activeMembers: stat.activeMembers,
      totalMembers: stat.totalMembers,
      perCapita: stat.activeMembers > 0 ? Math.round((stat.dailyClears / stat.activeMembers) * 100) / 100 : 0,
      streakDays,
      myContribution,
      heroes: heroes.data.map(h => ({
        todayClears: h.todayContribution
      }))
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
