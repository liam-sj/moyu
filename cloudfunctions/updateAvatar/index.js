const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/** Treat missing collection as empty */
async function safeGet(query) {
  try { return await query.get() }
  catch (e) { if (e.errCode === -502005) return { data: [] }; throw e }
}

exports.main = async (event, context) => {
  try {
    const openId = cloud.getWXContext().OPENID
    if (!openId) return { ok: false, reason: 'no_openid' }

    const { avatarUrl, nickName, fishSelectionShown, clearedLevel2 } = event

    const player = await safeGet(db.collection('players').where({ openId }))
    if (player.data.length === 0) return { ok: false, reason: 'no_record' }

    const data = {}
    if (avatarUrl !== undefined && avatarUrl !== '') data.avatarUrl = avatarUrl
    if (nickName !== undefined && nickName !== '') data.nickName = nickName
    if (fishSelectionShown !== undefined) data.fishSelectionShown = fishSelectionShown
    if (clearedLevel2 !== undefined) data.clearedLevel2 = clearedLevel2

    if (Object.keys(data).length === 0) return { ok: false, reason: 'no_fields' }

    data.updatedAt = new Date()
    await db.collection('players').doc(player.data[0]._id).update({ data })
    console.log('[updateAvatar] updated', Object.keys(data), 'for', openId)
    return { ok: true }
  } catch (err) {
    console.error('[updateAvatar]', err)
    return { ok: false }
  }
}
