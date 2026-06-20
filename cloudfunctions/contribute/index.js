const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const openId = cloud.getWXContext().OPENID
  const player = await db.collection('player_ponds').where({ openId }).get()
  if (player.data.length === 0) return { ok: false, reason: 'no_pond' }

  const p = player.data[0]
  const pondId = p.pondId
  const date = todayStr()

  // Increment player contribution
  await db.collection('player_ponds').where({ openId }).update({
    data: {
      todayContribution: _.inc(1),
      [`totalContribution.${pondId}`]: _.inc(1)
    }
  })

  // Increment pond daily clears
  const pond = await db.collection('pond_stats').where({ pondId, date }).get()
  if (pond.data.length === 0) {
    await db.collection('pond_stats').add({
      data: { pondId, date, dailyClears: 1, activeMembers: 1 }
    })
  } else {
    await db.collection('pond_stats').where({ pondId, date }).update({
      data: { dailyClears: _.inc(1), activeMembers: _.inc(1) }
    })
  }

  // Get updated player data for feedback
  const updated = await db.collection('player_ponds').where({ openId }).get()
  const pondData = await db.collection('pond_stats').where({ pondId, date }).get()
  const allPonds = await db.collection('pond_stats').where({ date }).orderBy('dailyClears', 'desc').get()
  const rank = allPonds.data.findIndex(r => r.pondId === pondId) + 1

  return {
    ok: true,
    pondName: POND_NAMES[pondId] || pondId,
    fishEmoji: FISH_EMOJIS[pondId] || '🐟',
    todayContribution: updated.data[0].todayContribution,
    pondClears: pondData.data[0].dailyClears,
    rank
  }
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

const POND_NAMES = {
  moyutang:'摸鱼塘',xianyutang:'咸鱼塘',jinlitang:'锦鲤塘',hetuntang:'河豚塘',
  moyutang2:'墨鱼塘',haimatang:'海马塘',feiyutang:'飞鱼塘',zhangyutang:'章鱼塘',
  bimuyutang:'比目鱼塘',pangxietang:'螃蟹塘',jianyutang:'剑鱼塘',haituntang:'海豚塘'
}
const FISH_EMOJIS = {
  moyutang:'🐟',xianyutang:'🦐',jinlitang:'🐠',hetuntang:'🐡',
  moyutang2:'🦑',haimatang:'🐬',feiyutang:'🦅',zhangyutang:'🐙',
  bimuyutang:'🐟',pangxietang:'🦀',jianyutang:'⚔️',haituntang:'🐬'
}
