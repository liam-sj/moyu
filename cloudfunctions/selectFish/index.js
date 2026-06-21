const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

/** Treat missing collection as empty result */
async function safeGet(query) {
  try { return await query.get() }
  catch (e) { if (e.errCode === -502005) return { data: [] }; throw e }
}
async function safeAdd(collName, data) {
  try { return await db.collection(collName).add({ data }) }
  catch (e) { if (e.errCode === -502005) { return await db.collection(collName).add({ data }) }; throw e }
}

exports.main = async (event, context) => {
  const { action, fishId, pondId, avatarUrl, nickName } = event
  const openId = cloud.getWXContext().OPENID

  if (!openId) return { ok: false, reason: 'no_openid' }

  if (action === 'select') {
    const player = await safeGet(db.collection('players').where({ openId }))
    const data = {
      fishId: fishId || '',
      pondId: pondId || 'moyutang',
      avatarUrl: avatarUrl || '',
      nickName: nickName || '',
    }

    if (player.data.length > 0) {
      // Update existing
      const p = player.data[0]
      const visitedPonds = p.visitedPonds || []
      if (!visitedPonds.includes(pondId)) visitedPonds.push(pondId)
      await db.collection('players').doc(p._id).update({
        data: {
          ...data,
          visitedPonds,
          updatedAt: new Date()
        }
      })
    } else {
      // Create new record
      await safeAdd('players', {
        openId,
        ...data,
        joinDate: new Date(),
        lastSwitchDate: null,
        switchCount: 0,
        visitedPonds: [pondId],
        achievements: [],
        fishSelectionShown: false,
        clearedLevel2: false,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    }
    return { ok: true }
  }

  if (action === 'switch') {
    const player = await safeGet(db.collection('players').where({ openId }))
    if (player.data.length === 0) return { ok: false, reason: 'no_record' }

    const p = player.data[0]
    const lastSwitch = new Date(p.lastSwitchDate || 0)
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000
    if (lastSwitch.getTime() > weekAgo) {
      return {
        ok: false,
        reason: 'cooldown',
        nextAvailable: new Date(lastSwitch.getTime() + 7 * 24 * 3600 * 1000)
      }
    }

    const visitedPonds = p.visitedPonds || []
    if (!visitedPonds.includes(pondId)) visitedPonds.push(pondId)

    await db.collection('players').doc(p._id).update({
      data: {
        fishId: fishId || p.fishId,
        pondId: pondId || p.pondId,
        lastSwitchDate: new Date(),
        switchCount: _.inc(1),
        visitedPonds,
        updatedAt: new Date()
      }
    })
    return { ok: true }
  }

  return { ok: false, reason: 'unknown_action' }
}
