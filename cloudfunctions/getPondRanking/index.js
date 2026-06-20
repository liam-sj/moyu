const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const date = todayStr()
  const ponds = await db.collection('pond_stats').where({ date }).orderBy('dailyClears', 'desc').get()

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

  return {
    ok: true,
    rankings: ponds.data.slice(0, 12).map((p, i) => ({
      pondId: p.pondId, rank: i + 1, dailyClears: p.dailyClears, date: p.date
    })),
    myPond
  }
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
