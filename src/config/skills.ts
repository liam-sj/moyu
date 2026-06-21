import type { SkillConfig, SkillContext } from '../core/types'

const TAG = {
  RHYTHM:     '节奏型',
  TOLERANCE:  '容错型',
  EMERGENCY:  '救急型',
  RELIEF:     '减压型',
  WILD:       '万能型',
  LIFE_SAVER: '保命型',
  ENDURANCE:  '续航型',
  CLEAR:      '定向清除',
  LEGENDARY:  '传说型',
} as const

type Ctx = SkillContext

const SKILLS: SkillConfig[] = [
  // ═══ 常规技能 (S1-S8, 等概率) ═══
  { id: 'S1', name: '鱼群迁徙',   icon: '🐠', tag: TAG.RELIEF,
    desc: '将卡槽前3张移到移出区',
    apply: (c: Ctx) => { c.ejectSlots = true } },

  { id: 'S2', name: '珊瑚庇护',   icon: '🪸', tag: TAG.TOLERANCE,
    desc: '本局槽位上限+1（永久）',
    apply: (c: Ctx) => { c.slotLimit += 1 } },

  { id: 'S3', name: '跃出水面',   icon: '🐬', tag: TAG.EMERGENCY,
    desc: '立即清空槽位中数量最多的那种卡',
    apply: (c: Ctx) => { c.clearMostInSlot = true } },

  { id: 'S4', name: '洋流冲刷',   icon: '🌊', tag: TAG.RELIEF,
    desc: '随机移除棋盘上3张被压住的卡',
    apply: (c: Ctx) => { c.removeCoveredCards = 3 } },

  { id: 'S5', name: '珍珠幻化',   icon: '💎', tag: TAG.WILD,
    desc: '将槽位中一张卡变成万能珍珠',
    apply: (c: Ctx) => { c.transformToWild = 1 } },

  { id: 'S6', name: '贝壳护盾',   icon: '🐚', tag: TAG.LIFE_SAVER,
    desc: '下一次槽满时不失败，改为清空全部槽位',
    apply: (c: Ctx) => { c.slotOverflowShield = true } },

  { id: 'S7', name: '鱼跃冲刺',   icon: '🐟', tag: TAG.ENDURANCE,
    desc: '额外获得5步',
    apply: (c: Ctx) => { c.stepsRemaining += 5 } },

  { id: 'S8', name: '鱼网清除',   icon: '🎣', tag: TAG.CLEAR,
    desc: '指定一种卡，本局该种卡全部消除',
    apply: (c: Ctx) => { c.selectAndClear = true } },

  // ═══ 传说技能 (S9-S10, ~1/10 概率) ═══
  { id: 'S9', name: '龙门飞跃',   icon: '🐉', tag: TAG.LEGENDARY,
    desc: '本局取消步数限制，但槽位上限-2',
    apply: (c: Ctx) => {
      c.stepsUnlimited = true
      c.slotLimit = Math.max(3, c.slotLimit - 2)
    } },

  { id: 'S10', name: '深海自由', icon: '🐋', tag: TAG.LEGENDARY,
    desc: '本局槽位上限取消，但步数减半',
    apply: (c: Ctx) => {
      c.slotUnlimited = true
      c.stepsRemaining = Math.floor(c.stepsRemaining / 2)
    } },
]

/**
 * Pick `count` random skills. Legendary skills appear at ~1/10 the
 * probability of normal skills via weighted selection.
 */
export function getRandomSkills(count: number = 3): SkillConfig[] {
  const normal = SKILLS.filter(s => s.tag !== TAG.LEGENDARY)
  const legendary = SKILLS.filter(s => s.tag === TAG.LEGENDARY)

  // Build weighted pool: normal weight 10, legendary weight 1
  const pool: SkillConfig[] = []
  for (const s of normal) { for (let i = 0; i < 10; i++) pool.push(s) }
  for (const s of legendary) { pool.push(s) }

  // Fisher-Yates shuffle a copy of the weighted pool
  const arr = pool.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }

  // Pick unique skills
  const seen = new Set<string>()
  const result: SkillConfig[] = []
  for (const s of arr) {
    if (seen.has(s.id)) continue
    seen.add(s.id)
    result.push(s)
    if (result.length >= count) break
  }
  return result
}

export function getAllSkills(): SkillConfig[] {
  return SKILLS.slice()
}

export { TAG as SKILL_TAG }
