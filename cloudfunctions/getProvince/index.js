const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// Tencent Map API key — set in cloud function env or hardcode
const QQMAP_KEY = 'YOUR_TENCENT_MAP_KEY'  // TODO: replace with real key

exports.main = async (event) => {
  const { latitude, longitude } = event
  if (!latitude || !longitude) {
    return { ok: false, reason: 'missing coordinates' }
  }

  try {
    // Tencent Map reverse geocoding API
    const url = `https://apis.map.qq.com/ws/geocoder/v1/?location=${latitude},${longitude}&key=${QQMAP_KEY}&get_poi=0`
    const result = await new Promise((resolve, reject) => {
      require('https').get(url, (res) => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
        })
      }).on('error', reject)
    })

    if (result.status === 0 && result.result?.ad_info?.province) {
      return { ok: true, province: result.result.ad_info.province }
    }
    return { ok: false, reason: 'geocode failed' }
  } catch (e) {
    return { ok: false, reason: e.message }
  }
}
