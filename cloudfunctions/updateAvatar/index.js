const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const openId = cloud.getWXContext().OPENID
    const { avatarUrl, nickName, fishSelectionShown, clearedLevel2 } = event

    const player = await db.collection('player_ponds').where({ openId }).get()
    if (player.data.length === 0) return { ok: false, reason: 'no_record' }

    const data = {}
    if (avatarUrl) data.avatarUrl = avatarUrl
    if (nickName) data.nickName = nickName
    if (fishSelectionShown !== undefined) data.fishSelectionShown = fishSelectionShown
    if (clearedLevel2 !== undefined) data.clearedLevel2 = clearedLevel2

    if (Object.keys(data).length === 0) return { ok: false, reason: 'no_fields' }

    await db.collection('player_ponds').doc(player.data[0]._id).update({ data })
    console.log('[updateAvatar] updated', Object.keys(data), 'for', openId)
    return { ok: true }
  } catch (err) {
    console.error('[updateAvatar]', err)
    return { ok: false }
  }
}
