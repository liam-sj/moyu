const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    const openId = cloud.getWXContext().OPENID
    const player = await db.collection('player_ponds').where({ openId }).get()
    if (player.data.length === 0) return { ok: false, reason: 'no_player' }

    const p = player.data[0]
    const existingAchievements = p.achievements || []
    const existingIds = new Set(existingAchievements.map(a => a.id))
    const newAchievements = []

    // 🐟 鱼塘领头鱼: todayContribution is #1 in their pond (no one has more)
    if (!existingIds.has('pond_leader') && p.todayContribution >= 1) {
      const topInPond = await db.collection('player_ponds')
        .where({ pondId: p.pondId, todayContribution: _.gt(p.todayContribution) })
        .count()
      if (topInPond.total === 0) {
        newAchievements.push({
          id: 'pond_leader',
          name: '鱼塘领头鱼',
          emoji: '🐟',
          desc: '本鱼塘今日通关数第1名',
          unlockedAt: new Date()
        })
      }
    }

    // 🔥 连胜锦鲤: todayContribution >= 3
    if (!existingIds.has('streak_koi') && p.todayContribution >= 3) {
      newAchievements.push({
        id: 'streak_koi',
        name: '连胜锦鲤',
        emoji: '🔥',
        desc: '今日贡献3次以上',
        unlockedAt: new Date()
      })
    }

    // Save any new achievements to player document
    if (newAchievements.length > 0) {
      await db.collection('player_ponds').where({ openId }).update({
        data: {
          achievements: _.push(newAchievements)
        }
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
