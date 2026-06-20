const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    const openId = cloud.getWXContext().OPENID
    const player = await db.collection('player_ponds').where({ openId }).get()
    if (player.data.length === 0) return { ok: false, reason: 'no_pond' }

    const p = player.data[0]
    const pondId = p.pondId
    const date = todayStr()
    const avatarUrl = event.avatarUrl || ''

    // Increment player contribution
    const updates: any = {
      todayContribution: _.inc(1),
      [`totalContribution.${pondId}`]: _.inc(1)
    }
    if (avatarUrl) updates.avatarUrl = avatarUrl
    await db.collection('player_ponds').where({ openId }).update({ data: updates })

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

    // Streak tracking: update consecutive #1 days
    if (rank === 1) {
      const yesterday = yesterdayStr()
      const streakResult = await db.collection('pond_streaks').where({ pondId }).get()
      if (streakResult.data.length === 0) {
        await db.collection('pond_streaks').add({
          data: { pondId, streakDays: 1, lastRankOneDate: date }
        })
      } else {
        const s = streakResult.data[0]
        if (s.lastRankOneDate === date) {
          // Already counted for today, no change needed
        } else if (s.lastRankOneDate === yesterday) {
          // Continuing streak
          await db.collection('pond_streaks').doc(s._id).update({
            data: { streakDays: _.inc(1), lastRankOneDate: date }
          })
        } else {
          // Streak broken, reset to 1
          await db.collection('pond_streaks').doc(s._id).update({
            data: { streakDays: 1, lastRankOneDate: date }
          })
        }
      }
    }

    return {
      ok: true,
      pondName: POND_NAMES[pondId] || pondId,
      fishEmoji: FISH_EMOJIS[pondId] || '🐟',
      todayContribution: updated.data[0].todayContribution,
      pondClears: pondData.data[0].dailyClears,
      rank
    }
  } catch (err) {
    console.error('[contribute]', err)
    return { ok: false }
  }
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function yesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
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
