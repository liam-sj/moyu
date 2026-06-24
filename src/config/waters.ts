export interface WaterBody {
  waterId: string      // pinyin slug e.g. "zhujiang"
  province: string     // Chinese province name e.g. "广东省"
  waterName: string    // Water body display name e.g. "珠江"
  emoji: string        // Water emoji
}

export const WATER_BODIES: WaterBody[] = [
  { waterId:'shichahai', province:'北京市', waterName:'什刹海', emoji:'🏞️' },
  { waterId:'huangpujiang', province:'上海市', waterName:'黄浦江', emoji:'🌊' },
  { waterId:'haihe', province:'天津市', waterName:'海河', emoji:'🏞️' },
  { waterId:'jialingjiang', province:'重庆市', waterName:'嘉陵江', emoji:'⛰️' },
  { waterId:'zhujiang', province:'广东省', waterName:'珠江', emoji:'🌊' },
  { waterId:'xihu', province:'浙江省', waterName:'西湖', emoji:'🌿' },
  { waterId:'taihu', province:'江苏省', waterName:'太湖', emoji:'🌊' },
  { waterId:'dongtinghu', province:'湖南省', waterName:'洞庭湖', emoji:'🌊' },
  { waterId:'honghu', province:'湖北省', waterName:'洪湖', emoji:'🪷' },
  { waterId:'dujiangyan', province:'四川省', waterName:'都江堰', emoji:'⛲' },
  { waterId:'minjiang', province:'福建省', waterName:'闽江', emoji:'🏞️' },
  { waterId:'poyanghu', province:'江西省', waterName:'鄱阳湖', emoji:'🌊' },
  { waterId:'chaohu', province:'安徽省', waterName:'巢湖', emoji:'🌊' },
  { waterId:'daminghu', province:'山东省', waterName:'大明湖', emoji:'🪷' },
  { waterId:'huanghe', province:'河南省', waterName:'黄河', emoji:'🌊' },
  { waterId:'baiyangdian', province:'河北省', waterName:'白洋淀', emoji:'🪷' },
  { waterId:'fenhe', province:'山西省', waterName:'汾河', emoji:'🏞️' },
  { waterId:'weihe', province:'陕西省', waterName:'渭河', emoji:'🏞️' },
  { waterId:'yueyaquan', province:'甘肃省', waterName:'月牙泉', emoji:'🏜️' },
  { waterId:'qinghaihu', province:'青海省', waterName:'青海湖', emoji:'🏔️' },
  { waterId:'erhai', province:'云南省', waterName:'洱海', emoji:'🏔️' },
  { waterId:'huangguoshu', province:'贵州省', waterName:'黄果树', emoji:'💧' },
  { waterId:'lijiang', province:'广西壮族自治区', waterName:'漓江', emoji:'🏞️' },
  { waterId:'nanhai', province:'海南省', waterName:'南海', emoji:'🌴' },
  { waterId:'yalvjiang', province:'辽宁省', waterName:'鸭绿江', emoji:'🏞️' },
  { waterId:'tianchi', province:'吉林省', waterName:'天池', emoji:'🏔️' },
  { waterId:'songhuajiang', province:'黑龙江省', waterName:'松花江', emoji:'❄️' },
  { waterId:'tianchi_xj', province:'新疆维吾尔自治区', waterName:'天池', emoji:'🏔️' },
  { waterId:'namucuo', province:'西藏自治区', waterName:'纳木错', emoji:'🏔️' },
  { waterId:'shahu', province:'宁夏回族自治区', waterName:'沙湖', emoji:'🏜️' },
  { waterId:'hulunhu', province:'内蒙古自治区', waterName:'呼伦湖', emoji:'🌿' },
  { waterId:'riyuetan', province:'台湾省', waterName:'日月潭', emoji:'🏞️' },
  { waterId:'weiduoliyagang', province:'香港特别行政区', waterName:'维多利亚港', emoji:'🌃' },
  { waterId:'nanwanhu', province:'澳门特别行政区', waterName:'南湾湖', emoji:'🏞️' },
]

export const DEFAULT_WATER: WaterBody = {
  waterId:'sihaiveijia', province:'', waterName:'四海为家', emoji:'🌏'
}

export function getWaterByProvince(province: string): WaterBody | undefined {
  if (!province) return undefined
  // Normalize: strip trailing "省","市","自治区","特别行政区"
  const normalized = province
    .replace(/省$/, '')
    .replace(/市$/, '')
    .replace(/自治区$/, '')
    .replace(/特别行政区$/, '')
    .replace(/壮族$/, '')
    .replace(/回族$/, '')
    .replace(/维吾尔$/, '')
  return WATER_BODIES.find(w => w.province.includes(normalized))
}

export function getWaterById(waterId: string): WaterBody | undefined {
  return WATER_BODIES.find(w => w.waterId === waterId) || (waterId === DEFAULT_WATER.waterId ? DEFAULT_WATER : undefined)
}

const PROVINCE_CACHE_KEY = 'user_province'

export function getCachedProvince(): string | null {
  try { return wx.getStorageSync(PROVINCE_CACHE_KEY) || null } catch { return null }
}

export function setCachedProvince(province: string): void {
  wx.setStorageSync(PROVINCE_CACHE_KEY, province)
}

/** Detect user province: cached → profile → GPS → default */
export async function detectProvince(): Promise<string> {
  const cached = getCachedProvince()
  if (cached) return cached

  // Tier 1: wx.getUserInfo profile
  try {
    const res = await new Promise<any>((resolve) => {
      wx.getUserInfo({ success: (r: any) => resolve(r), fail: () => resolve(null) })
    })
    const profileProvince = res?.userInfo?.province
    if (profileProvince && profileProvince !== '' && profileProvince !== '海外') {
      setCachedProvince(profileProvince)
      return profileProvince
    }
  } catch {}

  // Tier 2: GPS + cloud reverse geocode
  try {
    const loc = await new Promise<any>((resolve, reject) => {
      wx.getLocation({ type: 'wgs84', success: (r: any) => resolve(r), fail: (e: any) => reject(e) })
    })
    const res = await wx.cloud.callFunction({
      name: 'getProvince',
      data: { latitude: loc.latitude, longitude: loc.longitude }
    })
    const province = (res as any).result?.province
    if (province) {
      setCachedProvince(province)
      return province
    }
  } catch {}

  // Tier 3: default
  return ''
}

// Fish types (moved from ponds.ts)
export const FISH_TYPES: Record<string, { name: string; emoji: string }> = {
  xiaojinyu: { name: '小金鱼', emoji: '🐟' },
  xianyugan: { name: '咸鱼干', emoji: '🦐' },
  jinli:    { name: '锦鲤',   emoji: '🐠' },
  hetun:    { name: '河豚',   emoji: '🐡' },
  moyu:     { name: '墨鱼',   emoji: '🦑' },
  haima:    { name: '海马',   emoji: '🐬' },
  feiyu:    { name: '飞鱼',   emoji: '🦅' },
  zhangyu:  { name: '章鱼',   emoji: '🐙' },
  bimuyu:   { name: '比目鱼', emoji: '🐟' },
  pangxie:  { name: '螃蟹',   emoji: '🦀' },
  jianyu:   { name: '剑鱼',   emoji: '⚔️' },
  haitun:   { name: '海豚',   emoji: '🐬' },
}

const ALL_FISH_IDS = Object.keys(FISH_TYPES)

export function getRandomFishId(): string {
  return ALL_FISH_IDS[Math.floor(Math.random() * ALL_FISH_IDS.length)]
}
