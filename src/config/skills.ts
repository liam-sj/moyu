import type { SkillConfig, SkillContext } from '../core/types'

export const SKILL_TAG = {
  RHYTHM: '节奏型',
  TOLERANCE: '容错型',
  EMERGENCY: '救急型',
  RELIEF: '减压型',
  WILD: '万能型',
  LIFE_SAVER: '保命型',
  ENDURANCE: '续航型',
  BURDEN: '减负型',
  INFO: '信息型',
  CLEAR: '定向清除',
  STRATEGY: '策略型',
  LEGENDARY: '传说型',
} as const

const SKILLS: SkillConfig[] = [
  { id: 'S1',  name: '飞行模式',     icon: '📵', tag: SKILL_TAG.RHYTHM,
    desc: '接下来3次点击不占槽位',
    apply: (ctx: SkillContext) => { ctx.slotFreeClicks = 3 } },
  { id: 'S2',  name: '同事掩护',     icon: '🤝', tag: SKILL_TAG.TOLERANCE,
    desc: '本局槽位上限+1',
    apply: (ctx: SkillContext) => { ctx.slotLimit += 1 } },
  { id: 'S3',  name: '提前下班',     icon: '⏰', tag: SKILL_TAG.EMERGENCY,
    desc: '立即清空槽位中数量最多的那种卡',
    apply: (ctx: SkillContext) => { ctx.clearMostInSlot = true } },
  { id: 'S4',  name: '清理桌面',     icon: '🗑️', tag: SKILL_TAG.RELIEF,
    desc: '随机移除棋盘上3张被压住的卡',
    apply: (ctx: SkillContext) => { ctx.removeCoveredCards = 3 } },
  { id: 'S5',  name: '假装工作',     icon: '🎭', tag: SKILL_TAG.WILD,
    desc: '将槽位中一张卡变成万能卡',
    apply: (ctx: SkillContext) => { ctx.transformToWild = 1 } },
  { id: 'S6',  name: '周报护体',     icon: '📊', tag: SKILL_TAG.LIFE_SAVER,
    desc: '下一次槽满时不失败，改为清空全部槽位',
    apply: (ctx: SkillContext) => { ctx.slotOverflowShield = true } },
  { id: 'S7',  name: '极限逃生',     icon: '🏃', tag: SKILL_TAG.ENDURANCE,
    desc: '额外获得5步',
    apply: (ctx: SkillContext) => { ctx.stepsRemaining += 5 } },
  { id: 'S8',  name: '老板出差',     icon: '👔', tag: SKILL_TAG.BURDEN,
    desc: '本局不再生成"老板巡视"卡',
    apply: (ctx: SkillContext) => { ctx.noMoreBossPatrol = true } },
  { id: 'S9',  name: '茶水间情报',   icon: '🍵', tag: SKILL_TAG.INFO,
    desc: '揭示所有❓事件卡身份',
    apply: (ctx: SkillContext) => { ctx.revealAllEvents = true } },
  { id: 'S10', name: '屏幕切换',     icon: '💻', tag: SKILL_TAG.CLEAR,
    desc: '指定一种卡，本局该种卡全部消除',
    apply: (ctx: SkillContext) => { ctx.selectAndClear = true } },
  { id: 'S11', name: '团建请假',     icon: '🎉', tag: SKILL_TAG.CLEAR,
    desc: '随机移除一种稀有卡的全部',
    apply: (ctx: SkillContext) => { ctx.clearRandomRare = true } },
  { id: 'S12', name: '带薪转岗',     icon: '🔄', tag: SKILL_TAG.STRATEGY,
    desc: '槽内任意两张卡互换位置',
    apply: (ctx: SkillContext) => { ctx.swapTwoInSlot = true } },
  { id: 'S13', name: '装死模式',     icon: '💤', tag: SKILL_TAG.TOLERANCE,
    desc: '接下来5步内，槽满上限临时变为9',
    apply: (ctx: SkillContext) => { ctx.tempSlotLimit9 = 5 } },
  { id: 'S14', name: '工作记忆',     icon: '🧠', tag: SKILL_TAG.WILD,
    desc: '获得一张万能卡进槽',
    apply: (ctx: SkillContext) => { ctx.gainWildCard = true } },
  { id: 'S15', name: '年度最佳员工', icon: '🏆', tag: SKILL_TAG.LEGENDARY,
    desc: '本局槽位上限+1，且技能触发次数+1',
    apply: (ctx: SkillContext) => { ctx.slotLimit += 1; ctx.extraSkillTrigger = true } },
  { id: 'S16', name: '忘记打卡',     icon: '🦄', tag: SKILL_TAG.LEGENDARY,
    desc: '本局取消步数限制，但槽位上限-2',
    apply: (ctx: SkillContext) => { ctx.stepsUnlimited = true; ctx.slotLimit = Math.max(3, ctx.slotLimit - 2) } },
  { id: 'S17', name: '无人办公室',   icon: '🔓', tag: SKILL_TAG.LEGENDARY,
    desc: '本局槽位上限取消，但步数减半',
    apply: (ctx: SkillContext) => { ctx.slotUnlimited = true; ctx.stepsRemaining = Math.floor(ctx.stepsRemaining / 2) } },
]

export function getRandomSkills(count: number = 3): SkillConfig[] {
  const pool = SKILLS.slice()
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  let hasLegendary = Math.random() < 0.2
  const result: SkillConfig[] = []
  for (let k = 0; k < pool.length && result.length < count; k++) {
    if (pool[k].tag === SKILL_TAG.LEGENDARY && !hasLegendary) continue
    if (pool[k].tag === SKILL_TAG.LEGENDARY) hasLegendary = false
    result.push(pool[k])
  }
  return result
}
