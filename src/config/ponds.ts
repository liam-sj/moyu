export interface PondConfig {
  id: string
  name: string
  fishId: string
  fishName: string
  emoji: string
  careerHint: string
  slogan: string
  color: string
  colorInt: number
}

export const PONDS: PondConfig[] = [
  { id:'moyutang',name:'摸鱼塘',fishId:'xiaojinyu',fishName:'小金鱼',emoji:'🐟',careerHint:'程序员',slogan:'编译中请勿打扰',color:'#4A90D9',colorInt:0x4A90D9},
  { id:'xianyutang',name:'咸鱼塘',fishId:'xianyugan',fishName:'咸鱼干',emoji:'🦐',careerHint:'公务员',slogan:'上班即摸鱼',color:'#E8915F',colorInt:0xE8915F},
  { id:'jinlitang',name:'锦鲤塘',fishId:'jinli',fishName:'锦鲤',emoji:'🐠',careerHint:'运营/市场',slogan:'转发这条鱼KPI达标',color:'#E25B5B',colorInt:0xE25B5B},
  { id:'hetuntang',name:'河豚塘',fishId:'hetun',fishName:'河豚',emoji:'🐡',careerHint:'产品经理',slogan:'一拍需求就膨胀',color:'#5DB87B',colorInt:0x5DB87B},
  { id:'moyutang2',name:'墨鱼塘',fishId:'moyu',fishName:'墨鱼',emoji:'🦑',careerHint:'设计师',slogan:'灵感来了喷墨就跑',color:'#9B6BB0',colorInt:0x9B6BB0},
  { id:'haimatang',name:'海马塘',fishId:'haima',fishName:'海马',emoji:'🐬',careerHint:'教师',slogan:'慢慢来比较快',color:'#6BC5B8',colorInt:0x6BC5B8},
  { id:'feiyutang',name:'飞鱼塘',fishId:'feiyu',fishName:'飞鱼',emoji:'🦅',careerHint:'销售',slogan:'业绩不飞就废',color:'#F0C745',colorInt:0xF0C745},
  { id:'zhangyutang',name:'章鱼塘',fishId:'zhangyu',fishName:'章鱼',emoji:'🐙',careerHint:'HR/人事',slogan:'八只手也忙不过来',color:'#F28BA8',colorInt:0xF28BA8},
  { id:'bimuyutang',name:'比目鱼塘',fishId:'bimuyu',fishName:'比目鱼',emoji:'🐟',careerHint:'财务/会计',slogan:'两眼盯穿你的账',color:'#2A8C8C',colorInt:0x2A8C8C},
  { id:'pangxietang',name:'螃蟹塘',fishId:'pangxie',fishName:'螃蟹',emoji:'🦀',careerHint:'法务/律师',slogan:'横着走也合法',color:'#A0343C',colorInt:0xA0343C},
  { id:'jianyutang',name:'剑鱼塘',fishId:'jianyu',fishName:'剑鱼',emoji:'⚔️',careerHint:'外卖骑手',slogan:'使命必达风雨无阻',color:'#FF8C42',colorInt:0xFF8C42},
  { id:'haituntang',name:'海豚塘',fishId:'haitun',fishName:'海豚',emoji:'🐬',careerHint:'网约车司机',slogan:'您已到达目的地',color:'#5BB8E8',colorInt:0x5BB8E8},
]

export function getPondById(id: string): PondConfig | undefined {
  return PONDS.find(p => p.id === id)
}

/** All fish types that players can get (excluding __announcer__ shark) */
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

export const ALL_FISH_IDS = Object.keys(FISH_TYPES)

export function getRandomFishId(): string {
  return ALL_FISH_IDS[Math.floor(Math.random() * ALL_FISH_IDS.length)]
}

const CACHE_KEY = 'fish_pond_cache'

export interface PlayerPondCache {
  pondId: string; fishId: string; joinDate: string
  todayContribution: number; switchCount: number
}

export function getCachedPond(): PlayerPondCache | null {
  try { return wx.getStorageSync(CACHE_KEY) || null } catch { return null }
}

export function setCachedPond(data: PlayerPondCache): void {
  wx.setStorageSync(CACHE_KEY, data)
}

export function clearPondCache(): void {
  wx.removeStorageSync(CACHE_KEY)
}
