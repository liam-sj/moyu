const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

/** Treat missing collection as empty result */
async function safeGet(query) {
  try { return await query.get() }
  catch (e) { if (e.errCode === -502005) return { data: [] }; throw e }
}
async function safeCount(query) {
  try { return await query.count() }
  catch (e) { if (e.errCode === -502005) return { total: 0 }; throw e }
}
async function safeAdd(collName, data) {
  try { return await db.collection(collName).add({ data }) }
  catch (e) { if (e.errCode === -502005) { return await db.collection(collName).add({ data }) }; throw e }
}

exports.main = async (event, context) => {
  const { fishId, pondId, avatarUrl, nickName, fishSelectionShown, checkAchievements } = event
  const openId = cloud.getWXContext().OPENID
  if (!openId) return { ok: false, reason: 'no_openid' }

  const usedPondId = pondId || 'moyutang'
  const usedFishId = fishId || 'xiaojinyu'
  const date = todayStr()

  try {
    // ── 1. Read players record ──
    const player = await safeGet(db.collection('players').where({ openId }))

    // ── 2. Write/update players (selectFish logic) ──
    const playerData = {
      fishId: usedFishId,
      pondId: usedPondId,
      avatarUrl: avatarUrl || '',
      nickName: nickName || '',
      clearedLevel2: true,
      updatedAt: new Date()
    }

    if (player.data.length > 0) {
      const p = player.data[0]
      const visitedPonds = p.visitedPonds || []
      if (!visitedPonds.includes(usedPondId)) visitedPonds.push(usedPondId)
      await db.collection('players').doc(p._id).update({
        data: {
          ...playerData,
          visitedPonds,
          fishSelectionShown: fishSelectionShown || p.fishSelectionShown || false
        }
      })
    } else {
      await safeAdd('players', {
        openId,
        ...playerData,
        joinDate: new Date(),
        lastSwitchDate: null,
        switchCount: 0,
        visitedPonds: [usedPondId],
        achievements: [],
        fishSelectionShown: fishSelectionShown || false,
        createdAt: new Date()
      })
    }

    // ── 3. Write contribution ──
    await safeAdd('contributions', {
      openId, pondId: usedPondId, fishId: usedFishId,
      avatarUrl: playerData.avatarUrl, nickName: playerData.nickName,
      date, createdAt: new Date()
    })

    // ── 4+5: Update pond_daily_stats + count today's contributions (parallel) ──
    const pondUpdate = (async () => {
      const pond = await safeGet(db.collection('pond_daily_stats').where({ pondId: usedPondId, date }))
      if (pond.data.length === 0) {
        await safeAdd('pond_daily_stats', { pondId: usedPondId, date, dailyClears: 1, activePlayers: [openId] })
        return { dailyClears: 1, activePlayers: [openId] }
      } else {
        await db.collection('pond_daily_stats').doc(pond.data[0]._id).update({
          data: { dailyClears: _.inc(1), activePlayers: _.addToSet(openId) }
        })
        return {
          dailyClears: pond.data[0].dailyClears + 1,
          activePlayers: pond.data[0].activePlayers || []
        }
      }
    })()

    const [pondResult, myCountResult] = await Promise.all([
      pondUpdate,
      safeCount(db.collection('contributions').where({ openId, date }))
    ])

    const todayContribution = myCountResult.total + 1  // +1 for the one just inserted
    const pondClears = pondResult.dailyClears

    // ── 6. Streak tracking (only if this pond is #1 today) ──
    const pondRankRes = await safeGet(
      db.collection('pond_daily_stats').where({ date }).orderBy('dailyClears', 'desc')
    )
    const rank = pondRankRes.data.findIndex(p => p.pondId === usedPondId) + 1

    if (rank === 1) {
      const yesterday = yesterdayStr()
      const streakResult = await safeGet(db.collection('pond_streaks').where({ pondId: usedPondId }))
      if (streakResult.data.length === 0) {
        await safeAdd('pond_streaks', { pondId: usedPondId, streakDays: 1, lastRankOneDate: date })
      } else {
        const s = streakResult.data[0]
        if (s.lastRankOneDate !== date) {
          if (s.lastRankOneDate === yesterday) {
            await db.collection('pond_streaks').doc(s._id).update({
              data: { streakDays: _.inc(1), lastRankOneDate: date }
            })
          } else {
            await db.collection('pond_streaks').doc(s._id).update({
              data: { streakDays: 1, lastRankOneDate: date }
            })
          }
        }
      }
    }

    // ── 7. Achievements check (optional) ──
    let newAchievements = []
    if (checkAchievements && player.data.length > 0) {
      const p = player.data[0]
      const existingAchievements = p.achievements || []
      const existingIds = new Set(existingAchievements.map(a => a.id))

      // 🐟 鱼塘领头鱼
      if (!existingIds.has('pond_leader') && todayContribution >= 1) {
        const allPondContribs = await safeGet(
          db.collection('contributions').where({ pondId: usedPondId, date })
        )
        const playerCounts = {}
        for (const c of allPondContribs.data) {
          playerCounts[c.openId] = (playerCounts[c.openId] || 0) + 1
        }
        const isLeader = Object.entries(playerCounts).every(
          ([uid, count]) => uid === openId || count <= todayContribution
        )
        if (isLeader) {
          newAchievements.push({
            id: 'pond_leader', name: '鱼塘领头鱼', emoji: '🐟',
            desc: '本鱼塘今日通关数第1名', unlockedAt: new Date()
          })
        }
      }

      // 🔥 连胜锦鲤
      if (!existingIds.has('streak_koi') && todayContribution >= 3) {
        newAchievements.push({
          id: 'streak_koi', name: '连胜锦鲤', emoji: '🔥',
          desc: '今日贡献3次以上', unlockedAt: new Date()
        })
      }

      if (newAchievements.length > 0) {
        await db.collection('players').doc(p._id).update({
          data: { achievements: _.push(newAchievements) }
        })
      }
    }

    return {
      ok: true,
      pondName: POND_NAMES[usedPondId] || usedPondId,
      fishEmoji: FISH_EMOJIS[usedPondId] || '🐟',
      todayContribution,
      pondClears,
      newAchievements
    }
  } catch (err) {
    console.error('[selectAndContribute]', err)
    return { ok: false, reason: err.message || 'unknown', errCode: err.errCode || 0 }
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
