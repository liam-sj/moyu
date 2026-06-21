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
    const openId = cloud.getWXContext().OPENID
    if (!openId) return { ok: false, reason: 'no_openid' }

    const player = await safeGet(db.collection('players').where({ openId }))
    if (player.data.length === 0) return { ok: false, reason: 'no_player' }

    const p = player.data[0]
    const date = todayStr()
    const existingAchievements = p.achievements || []
    const existingIds = new Set(existingAchievements.map(a => a.id))
    const newAchievements = []

    // Count today's contributions (from contributions collection)
    const myContribs = await safeCount(
      db.collection('contributions').where({ openId, date })
    )
    const todayCount = myContribs.total

    // 🐟 鱼塘领头鱼: todayCount >= 1 AND no other player in same pond has more
    if (!existingIds.has('pond_leader') && todayCount >= 1) {
      // Get all players in same pond with higher contribution count
      const allPondContribs = await safeGet(
        db.collection('contributions').where({ pondId: p.pondId, date })
      )

      // Group by openId and count
      const playerCounts = {}
      for (const c of allPondContribs.data) {
        playerCounts[c.openId] = (playerCounts[c.openId] || 0) + 1
      }

      const isLeader = Object.entries(playerCounts).every(
        ([uid, count]) => uid === openId || count <= todayCount
      )

      if (isLeader) {
        newAchievements.push({
          id: 'pond_leader',
          name: '鱼塘领头鱼',
          emoji: '🐟',
          desc: '本鱼塘今日通关数第1名',
          unlockedAt: new Date()
        })
      }
    }

    // 🔥 连胜锦鲤: todayCount >= 3
    if (!existingIds.has('streak_koi') && todayCount >= 3) {
      newAchievements.push({
        id: 'streak_koi',
        name: '连胜锦鲤',
        emoji: '🔥',
        desc: '今日贡献3次以上',
        unlockedAt: new Date()
      })
    }

    // Save new achievements
    if (newAchievements.length > 0) {
      await db.collection('players').doc(p._id).update({
        data: { achievements: _.push(newAchievements) }
      })
    }

    return {
      ok: true,
      newAchievements,
      total: existingAchievements.length + newAchievements.length
    }
  } catch (err) {
    console.error('[checkAchievements]', err)
    return { ok: false }
  }
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
