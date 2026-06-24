const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// Tencent Map WebService API key
const QQMAP_KEY = 'D4CBZ-WBH6A-EOHK6-CN6PJ-W35D6-PTBE2'

exports.main = async (event) => {
  const { latitude, longitude } = event
  console.log('[getProvince] input:', latitude, longitude)
  if (!latitude || !longitude) {
    console.log('[getProvince] missing coordinates')
    return { ok: false, reason: 'missing coordinates' }
  }

  try {
    const url = `https://apis.map.qq.com/ws/geocoder/v1/?location=${latitude},${longitude}&key=${QQMAP_KEY}&get_poi=0`
    console.log('[getProvince] calling Tencent Map API...')
    const result = await new Promise((resolve, reject) => {
      require('https').get(url, (res) => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
        })
      }).on('error', reject)
    })

    console.log('[getProvince] Tencent Map status:', result.status, 'province:', result.result?.ad_info?.province || '(none)')
    if (result.status === 0 && result.result?.ad_info?.province) {
      return { ok: true, province: result.result.ad_info.province }
    }
    return { ok: false, reason: 'geocode failed', status: result.status }
  } catch (e) {
    console.log('[getProvince] error:', e.message || e)
    return { ok: false, reason: e.message }
  }
}
