const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { action, fishId, pondId } = event
  const openId = cloud.getWXContext().OPENID
  const _ = db.command

  if (action === 'select') {
    // First time selecting a fish
    const existing = await db.collection('player_ponds').where({ openId }).get()
    if (existing.data.length > 0) {
      return { ok: false, reason: 'already_selected' }
    }
    const avatarUrl = event.avatarUrl || ''
    const nickName = event.nickName || ''
    await db.collection('player_ponds').add({
      data: {
        openId, fishId, pondId,
        avatarUrl, nickName,
        joinDate: new Date(),
        lastSwitchDate: null,
        switchCount: 0,
        visitedPonds: [pondId],
        todayContribution: 0,
        totalContribution: { [pondId]: 0 }
      }
    })
    const todayRecord = await db.collection('pond_stats').where({ pondId, date: todayStr() }).get()
    if (todayRecord.data.length === 0) {
      await db.collection('pond_stats').add({
        data: { pondId, date: todayStr(), dailyClears: 0, activeMembers: 0, totalMembers: 1 }
      })
    } else {
      await db.collection('pond_stats').doc(todayRecord.data[0]._id).update({
        data: { totalMembers: _.inc(1) }
      })
    }
    return { ok: true }
  }

  if (action === 'switch') {
    const player = await db.collection('player_ponds').where({ openId }).get()
    if (player.data.length === 0) return { ok: false, reason: 'no_record' }
    const p = player.data[0]
    const lastSwitch = new Date(p.lastSwitchDate || 0)
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000
    if (lastSwitch.getTime() > weekAgo) {
      return { ok: false, reason: 'cooldown', nextAvailable: new Date(lastSwitch.getTime() + 7 * 24 * 3600 * 1000) }
    }
    await db.collection('player_ponds').where({ openId }).update({
      data: {
        fishId, pondId,
        lastSwitchDate: new Date(),
        switchCount: _.inc(1),
        visitedPonds: _.addToSet(pondId),
        todayContribution: 0,
        totalContribution: { [pondId]: 0 }
      }
    })
    return { ok: true }
  }

  return { ok: false, reason: 'unknown_action' }
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
