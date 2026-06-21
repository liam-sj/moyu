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
/** Add a document — auto-creates collection on first use, with fallback */
async function safeAdd(collName, data) {
  try {
    return await db.collection(collName).add({ data })
  } catch (e) {
    // If collection doesn't exist, try once more after a brief wait
    // (WeChat cloud sometimes needs a moment to auto-create)
    if (e.errCode === -502005) {
      console.log('[contribute] safeAdd retry for', collName)
      return await db.collection(collName).add({ data })
    }
    throw e
  }
}

exports.main = async (event, context) => {
  try {
    const openId = cloud.getWXContext().OPENID
    if (!openId) return { ok: false, reason: 'no_openid' }

    // Read player profile
    const player = await safeGet(db.collection('players').where({ openId }))
    if (player.data.length === 0) {
      console.log('[contribute] No player record, creating minimal entry')
      await safeAdd('players', {
        openId, fishId: 'xiaojinyu', pondId: 'moyutang',
        avatarUrl: '', nickName: '',
        joinDate: new Date(), lastSwitchDate: null, switchCount: 0,
        visitedPonds: ['moyutang'], achievements: [],
        fishSelectionShown: false, clearedLevel2: false,
        createdAt: new Date(), updatedAt: new Date()
      })
      return { ok: true, pondName: '摸鱼塘', fishEmoji: '🐟', todayContribution: 1, pondClears: 1, rank: 1 }
    }

    const p = player.data[0]
    const pondId = p.pondId || 'moyutang'
    const fishId = p.fishId || 'xiaojinyu'
    const avatarUrl = p.avatarUrl || ''
    const nickName = p.nickName || ''
    const date = todayStr()
    console.log('[contribute] step1 player found', { pondId, fishId, date, hasAvatar: !!avatarUrl })

    // ── 1. Insert contribution document (append-only, no race condition) ──
    console.log('[contribute] step2 inserting contribution...')
    await safeAdd('contributions', {
      openId, pondId, fishId,
      avatarUrl, nickName,
      date,
      createdAt: new Date()
    })
    console.log('[contribute] step2 done')

    // ── 2. Update pond_daily_stats atomically ──
    console.log('[contribute] step3 updating pond_daily_stats...')
    const pond = await safeGet(db.collection('pond_daily_stats').where({ pondId, date }))
    if (pond.data.length === 0) {
      await safeAdd('pond_daily_stats', { pondId, date, dailyClears: 1, activePlayers: [openId] })
      console.log('[contribute] pond_daily_stats CREATED for', pondId, date)
    } else {
      await db.collection('pond_daily_stats').doc(pond.data[0]._id).update({
        data: {
          dailyClears: _.inc(1),
          activePlayers: _.addToSet(openId)
        }
      })
      console.log('[contribute] pond_daily_stats UPDATED for', pondId)
    }
    console.log('[contribute] step3 done')

    // ── 3. Count today's contributions for this player (for feedback) ──
    const myCount = await safeCount(
      db.collection('contributions').where({ openId, date })
    )

    // ── 4. Get pond clears + rank ──
    const pondData = await safeGet(db.collection('pond_daily_stats').where({ pondId, date }))
    const pondClears = pondData.data.length > 0 ? pondData.data[0].dailyClears : 0

    const allPonds = await safeGet(
      db.collection('pond_daily_stats').where({ date }).orderBy('dailyClears', 'desc')
    )
    const rank = allPonds.data.findIndex(r => r.pondId === pondId) + 1

    // ── 5. Streak tracking ──
    if (rank === 1) {
      const yesterday = yesterdayStr()
      const streakResult = await safeGet(db.collection('pond_streaks').where({ pondId }))
      if (streakResult.data.length === 0) {
        await safeAdd('pond_streaks', { pondId, streakDays: 1, lastRankOneDate: date })
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

    console.log('[contribute] ok', { pondId, fishId, myCount: myCount.total, pondClears, rank })
    return {
      ok: true,
      pondName: POND_NAMES[pondId] || pondId,
      fishEmoji: FISH_EMOJIS[pondId] || '🐟',
      todayContribution: myCount.total,
      pondClears,
      rank
    }
  } catch (err) {
    console.error('[contribute] ERROR', JSON.stringify({ message: err.message, errCode: err.errCode, stack: err.stack }))
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
