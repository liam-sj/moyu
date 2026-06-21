const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    const openId = cloud.getWXContext().OPENID
    const player = await db.collection('player_ponds').where({ openId }).get()
    if (player.data.length === 0) {
      // Create minimal record if missing (repair scenario)
      console.log('[contribute] Player has no pond record, creating minimal entry')
      await db.collection('player_ponds').add({
        data: {
          openId, fishId: '', pondId: 'moyutang', avatarUrl: event.avatarUrl || '',
          joinDate: new Date(), lastSwitchDate: null, switchCount: 0,
          visitedPonds: ['moyutang'], todayContribution: 0, totalContribution: { moyutang: 0 }
        }
      })
      return { ok: true, pondName: '摸鱼塘', fishEmoji: '🐟', todayContribution: 1, pondClears: 1, rank: 1 }
    }

    const p = player.data[0]
    const pondId = p.pondId
    const date = todayStr()
    // Avatar and nickName from stored player record, not from client event
    const avatarUrl = p.avatarUrl || ''
    const nickName = p.nickName || ''

    // Increment player contribution
    const updates = {
      todayContribution: _.inc(1),
      [`totalContribution.${pondId}`]: _.inc(1)
    }
    if (avatarUrl) updates.avatarUrl = avatarUrl
    await db.collection('player_ponds').where({ openId }).update({ data: updates })

    // Increment pond daily clears with user tracking
    const pond = await db.collection('pond_stats').where({ pondId, date }).get()
    console.log('[contribute] pond_stats query:', { pondId, date, found: pond.data.length })
    if (pond.data.length === 0) {
      await db.collection('pond_stats').add({
        data: {
          pondId, date, dailyClears: 1,
          uniquePlayers: [openId],
          contributors: [{ openId, avatarUrl, nickName, count: 1 }]
        }
      })
      console.log('[contribute] pond_stats CREATED with user for', pondId)
    } else {
      const doc = pond.data[0]
      const players = doc.uniquePlayers || []
      const contribs = doc.contributors || []
      // Update unique players (dedup)
      if (!players.includes(openId)) players.push(openId)
      // Update contributors (increment count or add new)
      const existingIdx = contribs.findIndex(c => c.openId === openId)
      if (existingIdx >= 0) {
        contribs[existingIdx].count += 1
        if (avatarUrl && !contribs[existingIdx].avatarUrl) contribs[existingIdx].avatarUrl = avatarUrl
      } else {
        contribs.push({ openId, avatarUrl, nickName, count: 1 })
      }
      await db.collection('pond_stats').doc(doc._id).update({
        data: { dailyClears: _.inc(1), uniquePlayers: players, contributors: contribs }
      })
      console.log('[contribute] pond_stats UPDATED with', players.length, 'players')
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
