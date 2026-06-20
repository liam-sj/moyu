# Fish Pond System Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Implement the fish pond (鱼塘) selection and basic ranking system with WeChat Cloud Development.

**Architecture:** Cloud DB stores player fish choices and pond stats. 3 cloud functions handle data operations. New SelectFishScene for picking fish. MenuScene updated with "My Pond" card. GameScene reports contribution on pass-through.

**Tech Stack:** TypeScript + PIXI.js (existing), WeChat Cloud Development (wx.cloud)

## Global Constraints

- All cloud DB writes go through cloud functions (never direct from client)
- Fish selection triggers after FIRST completion of Level 2 only
- Weekly fish change limit enforced server-side
- Local cache of player pond data for fast reads (wx.getStorageSync)
- Pond rankings refresh max every 30 seconds

---

## File Structure

```
cloudfunctions/
  selectFish/       ← Select/change fish, write player_ponds + pond_stats
    index.js
    package.json
  contribute/       ← Record pass-through contribution
    index.js
    package.json
  getPondRanking/   ← Get today's rankings
    index.js
    package.json

src/
  config/
    ponds.ts        ← 12 fish pond static data (NEW)
  scenes/
    SelectFishScene.ts  ← Fish selection UI (NEW)
    FishPondCard.ts     ← "My Pond" card component (NEW)
    MenuScene.ts        ← Add pond card + ranking bar (MODIFY)
    GameScene.ts        ← Add contribution on win (MODIFY)
  main.minigame.ts      ← Cloud init (MODIFY)

project.config.json    ← Add cloudfunctionRoot (MODIFY)
```

---

### Task 1: Cloud Infrastructure Setup

**Files:**
- Modify: `project.config.json:1-58`
- Create: `cloudfunctions/selectFish/index.js`
- Create: `cloudfunctions/selectFish/package.json`
- Create: `cloudfunctions/contribute/index.js`
- Create: `cloudfunctions/contribute/package.json`
- Create: `cloudfunctions/getPondRanking/index.js`
- Create: `cloudfunctions/getPondRanking/package.json`

**Interfaces:**
- Produces: Cloud functions `selectFish`, `contribute`, `getPondRanking`
- Produces: DB collections `player_ponds` and `pond_stats`

- [ ] **Step 1: Add cloudfunctionRoot to project.config.json**

```json
"cloudfunctionRoot": "cloudfunctions/",
```

- [ ] **Step 2: Create cloudfunctions/selectFish/package.json**

```json
{
  "name": "selectFish",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "latest"
  }
}
```

- [ ] **Step 3: Create cloudfunctions/selectFish/index.js**

```javascript
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { action, fishId, pondId, openId } = event
  const _ = db.command

  if (action === 'select') {
    // First time selecting a fish
    const existing = await db.collection('player_ponds').where({ openId }).get()
    if (existing.data.length > 0) {
      return { ok: false, reason: 'already_selected' }
    }
    await db.collection('player_ponds').add({
      data: {
        openId, fishId, pondId,
        joinDate: new Date(),
        lastSwitchDate: null,
        switchCount: 0,
        visitedPonds: [pondId],
        todayContribution: 0,
        totalContribution: { [pondId]: 0 }
      }
    })
    await db.collection('pond_stats').where({ pondId, date: todayStr() }).update({
      data: { totalMembers: _.inc(1) }
    })
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
```

- [ ] **Step 4: Create cloudfunctions/contribute/package.json**

```json
{
  "name": "contribute",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "latest"
  }
}
```

- [ ] **Step 5: Create cloudfunctions/contribute/index.js**

```javascript
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { openId } = event
  const player = await db.collection('player_ponds').where({ openId }).get()
  if (player.data.length === 0) return { ok: false, reason: 'no_pond' }

  const p = player.data[0]
  const pondId = p.pondId
  const date = todayStr()

  // Increment player contribution
  await db.collection('player_ponds').where({ openId }).update({
    data: {
      todayContribution: _.inc(1),
      [`totalContribution.${pondId}`]: _.inc(1)
    }
  })

  // Increment pond daily clears
  const pond = await db.collection('pond_stats').where({ pondId, date }).get()
  if (pond.data.length === 0) {
    await db.collection('pond_stats').add({
      data: { pondId, date, dailyClears: 1, activeMembers: 1 }
    })
  } else {
    await db.collection('pond_stats').where({ pondId, date }).update({
      data: { dailyClears: _.inc(1) }
    })
  }

  // Get updated player data for feedback
  const updated = await db.collection('player_ponds').where({ openId }).get()
  const pondData = await db.collection('pond_stats').where({ pondId, date }).get()
  const allPonds = await db.collection('pond_stats').where({ date }).orderBy('dailyClears', 'desc').get()
  const rank = allPonds.data.findIndex(r => r.pondId === pondId) + 1

  return {
    ok: true,
    pondName: POND_NAMES[pondId] || pondId,
    fishEmoji: FISH_EMOJIS[pondId] || '🐟',
    todayContribution: updated.data[0].todayContribution,
    pondClears: pondData.data[0].dailyClears,
    rank
  }
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

const POND_NAMES = {
  moyutang:'摸鱼塘',xianyutang:'咸鱼塘',jinlitang:'锦鲤塘',hetuntang:'河豚塘',
  moyutang2:'墨鱼塘',haimatang:'海马塘',feiyutang:'飞鱼塘',zhangyutang:'章鱼塘',
  bimuyutang:'比目鱼塘',pangxietang:'螃蟹塘',jianyutang:'剑鱼塘',haituntang:'海豚塘'
}
const FISH_EMOJIS = {
  moyutang:'🐟',xianyutang:'🦐',jinlitang:'🐠',hetuntang:'🐡',
  moyutang2:'🦑',haimatang:'🐬',feiyutang:'🦅',zhangyutang:'🐙',
  bimuyutang:'🐟',pangxietang:'🦀',jianyutang:'⚔️',haituntang:'🐬'
}
```

- [ ] **Step 6: Create cloudfunctions/getPondRanking/package.json**

```json
{
  "name": "getPondRanking",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "latest"
  }
}
```

- [ ] **Step 7: Create cloudfunctions/getPondRanking/index.js**

```javascript
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const date = todayStr()
  const ponds = await db.collection('pond_stats').where({ date }).orderBy('dailyClears', 'desc').get()

  // Get player's rank if openId provided
  let myPond = null
  if (event.openId) {
    const player = await db.collection('player_ponds').where({ openId: event.openId }).get()
    if (player.data.length > 0) {
      const p = player.data[0]
      const rank = ponds.data.findIndex(r => r.pondId === p.pondId) + 1
      myPond = {
        pondId: p.pondId, fishId: p.fishId,
        rank, todayContribution: p.todayContribution,
        joinDate: p.joinDate, switchCount: p.switchCount
      }
    }
  }

  return {
    ok: true,
    rankings: ponds.data.slice(0, 12).map((p, i) => ({
      pondId: p.pondId, rank: i + 1, dailyClears: p.dailyClears, date: p.date
    })),
    myPond
  }
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
```

- [ ] **Step 8: Install cloud function dependencies**

```bash
cd cloudfunctions/selectFish && npm install
cd ../contribute && npm install
cd ../getPondRanking && npm install
```

---

### Task 2: Fish Pond Config + Cloud Init

**Files:**
- Create: `src/config/ponds.ts`
- Modify: `src/main.minigame.ts:1-50`

**Interfaces:**
- Produces: `PONDS` (array of 12 fish pond objects), `getPondById(id)`
- Produces: `initCloud()` function

- [ ] **Step 1: Create src/config/ponds.ts**

```typescript
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
```

- [ ] **Step 2: Add cloud init to src/main.minigame.ts**

Add after `installPolyfills()`:

```typescript
// ── 云开发初始化 ──
if (typeof wx !== 'undefined' && wx.cloud) {
  wx.cloud.init({ env: 'your-env-id' })  // ← replace with actual env ID
}
```

- [ ] **Step 3: Add local cache helpers in src/config/ponds.ts**

```typescript
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
```

---

### Task 3: SelectFishScene — Fish Selection UI

**Files:**
- Create: `src/scenes/SelectFishScene.ts`

**Interfaces:**
- Consumes: `PONDS` from `src/config/ponds.ts`
- Produces: Scene that displays 3×4 grid, returns selected pond

- [ ] **Step 1: Create src/scenes/SelectFishScene.ts**

```typescript
import * as PIXI from 'pixi.js-legacy'
import { Scene } from '../engine/Scene'
import { PONDS, PondConfig, setCachedPond } from '../config/ponds'

export class SelectFishScene extends Scene {
  private _hitAreas: Array<{ rect: { x: number; y: number; w: number; h: number }; cb: () => void }> = []

  onEnter(): void {
    const sysInfo = wx.getSystemInfoSync()
    const w = sysInfo.windowWidth; const h = sysInfo.windowHeight

    // Background
    const bg = new PIXI.Graphics()
    bg.beginFill(0x1A252F, 0.95); bg.drawRect(0, 0, w, h); bg.endFill()
    this.container.addChild(bg)

    // Title
    const title = new PIXI.Text('🎉 选择你的鱼，加入鱼塘', {
      fontFamily: 'sans-serif', fontSize: 20, fontWeight: 'bold', fill: '#F39C12', align: 'center',
    } as any)
    title.anchor.set(0.5); title.x = w / 2; title.y = h * 0.06
    this.container.addChild(title)

    const sub = new PIXI.Text('选鱼 = 选鱼塘 + 选阵营 （每周可换一次）', {
      fontFamily: 'sans-serif', fontSize: 11, fill: '#95A5A6', align: 'center',
    } as any)
    sub.anchor.set(0.5); sub.x = w / 2; sub.y = h * 0.12
    this.container.addChild(sub)

    // 3×4 grid
    const cols = 3; const rows = 4
    const cardW = 105; const cardH = 120; const gap = 10
    const gridW = cols * cardW + (cols - 1) * gap
    const gridH = rows * cardH + (rows - 1) * gap
    const startX = (w - gridW) / 2; const startY = h * 0.17

    const self = this
    for (let i = 0; i < PONDS.length; i++) {
      const pond = PONDS[i]
      const col = i % cols; const row = Math.floor(i / cols)
      const cx = startX + col * (cardW + gap)
      const cy = startY + row * (cardH + gap)

      // Card bg
      const card = new PIXI.Graphics()
      card.beginFill(0x2C3E50, 0.9)
      card.drawRoundedRect(cx, cy, cardW, cardH, 10)
      card.endFill()
      card.lineStyle(2, pond.colorInt, 0.7)
      card.drawRoundedRect(cx, cy, cardW, cardH, 10)
      this.container.addChild(card)

      // Emoji
      const emoji = new PIXI.Text(pond.emoji, {
        fontFamily: 'sans-serif', fontSize: 36, align: 'center',
      } as any)
      emoji.anchor.set(0.5); emoji.x = cx + cardW / 2; emoji.y = cy + 30
      this.container.addChild(emoji)

      // Name
      const name = new PIXI.Text(pond.name, {
        fontFamily: 'sans-serif', fontSize: 14, fontWeight: 'bold', fill: '#FFFFFF', align: 'center',
      } as any)
      name.anchor.set(0.5); name.x = cx + cardW / 2; name.y = cy + 60
      this.container.addChild(name)

      // Slogan
      const slogan = new PIXI.Text(pond.slogan, {
        fontFamily: 'sans-serif', fontSize: 9, fill: '#BDC3C7', align: 'center',
      } as any)
      slogan.anchor.set(0.5); slogan.x = cx + cardW / 2; slogan.y = cy + 82
      this.container.addChild(slogan)

      // Fish name
      const fish = new PIXI.Text(pond.fishName, {
        fontFamily: 'sans-serif', fontSize: 10, fill: '#7FB3D8', align: 'center',
      } as any)
      fish.anchor.set(0.5); fish.x = cx + cardW / 2; fish.y = cy + 100
      this.container.addChild(fish)

      this._hitAreas.push({
        rect: { x: cx, y: cy, w: cardW, h: cardH },
        cb: () => self._onSelect(pond)
      })
    }
  }

  private _onSelect(pond: PondConfig): void {
    // Confirm dialog
    wx.showModal({
      title: '选择鱼塘',
      content: `选择${pond.emoji}${pond.fishName}，加入${pond.name}？\n\n"${pond.slogan}"`,
      success: (res) => {
        if (res.confirm) {
          this._doSelect(pond)
        }
      }
    })
  }

  private async _doSelect(pond: PondConfig): Promise<void> {
    try {
      const res = await wx.cloud.callFunction({
        name: 'selectFish',
        data: { action: 'select', fishId: pond.fishId, pondId: pond.id }
      })
      const data = (res as any).result
      if (data.ok) {
        setCachedPond({ pondId: pond.id, fishId: pond.fishId, joinDate: new Date().toISOString(), todayContribution: 0, switchCount: 0 })
        // Return to menu
        const { MenuScene } = require('./MenuScene')
        this.manager.replace(new MenuScene())
      }
    } catch (e) {
      console.error('Select fish failed', e)
    }
  }

  onUpdate(_dt: number): void {
    for (const item of this._hitAreas) {
      this.registerHitArea(item.rect, item.cb, 10)
    }
  }
}
```

---

### Task 4: MenuScene — Add "My Pond" Card + Ranking Bar

**Files:**
- Modify: `src/scenes/MenuScene.ts:1-81`

**Interfaces:**
- Consumes: `getCachedPond`, `PONDS`, `getPondById` from `src/config/ponds.ts`
- Produces: Updated home screen with fish pond card

- [ ] **Step 1: Add fish pond card to MenuScene.onEnter**

Insert after the subtitle, before the card sprites:

```typescript
    // ── Fish Pond Card ──
    const cachedPond = getCachedPond()
    const pondCfg = cachedPond ? getPondById(cachedPond.pondId) : null
    const pondCardY = h * 0.30
    const pondCardH = pondCfg ? 65 : 40

    if (pondCfg && cachedPond) {
      // Has pond: show card
      const cardBg = new PIXI.Graphics()
      cardBg.beginFill(0x2C3E50, 0.9)
      cardBg.drawRoundedRect(16, pondCardY, w - 32, pondCardH, 10)
      cardBg.endFill()
      cardBg.lineStyle(2, pondCfg.colorInt, 0.6)
      cardBg.drawRoundedRect(16, pondCardY, w - 32, pondCardH, 10)
      this.container.addChild(cardBg)

      const pondIcon = new PIXI.Text(pondCfg.emoji + ' ' + pondCfg.name, {
        fontFamily: 'sans-serif', fontSize: 18, fontWeight: 'bold', fill: '#FFFFFF',
      } as any)
      pondIcon.x = 28; pondIcon.y = pondCardY + 10
      this.container.addChild(pondIcon)

      const sloganTxt = new PIXI.Text(pondCfg.slogan, {
        fontFamily: 'sans-serif', fontSize: 11, fill: '#BDC3C7',
      } as any)
      sloganTxt.x = 28; sloganTxt.y = pondCardY + 38
      this.container.addChild(sloganTxt)
    } else {
      // No pond yet: show prompt
      const promptBg = new PIXI.Graphics()
      promptBg.beginFill(0x2C3E50, 0.6)
      promptBg.drawRoundedRect(16, pondCardY, w - 32, pondCardH, 10)
      promptBg.endFill()
      this.container.addChild(promptBg)

      const promptTxt = new PIXI.Text('🐟 通关后选择你的鱼，加入鱼塘', {
        fontFamily: 'sans-serif', fontSize: 14, fill: '#95A5A6', align: 'center',
      } as any)
      promptTxt.anchor.set(0.5); promptTxt.x = w / 2; promptTxt.y = pondCardY + pondCardH / 2
      this.container.addChild(promptTxt)
    }
```

- [ ] **Step 2: Add ranking bar below pond card**

```typescript
    // ── Ranking Bar (simple local cache version) ──
    const rankingY = pondCardY + pondCardH + 12
    this._loadRankingBar(w, rankingY)
```

- [ ] **Step 3: Add _loadRankingBar method**

```typescript
  private _rankingContainer: PIXI.Container | null = null

  private async _loadRankingBar(w: number, y: number): Promise<void> {
    if (this._rankingContainer) {
      this.container.removeChild(this._rankingContainer)
      this._rankingContainer.destroy({ children: true })
    }
    const ctn = new PIXI.Container()
    this._rankingContainer = ctn
    this.container.addChild(ctn)

    try {
      const res = await wx.cloud.callFunction({ name: 'getPondRanking', data: {} })
      const data = (res as any).result
      if (!data.ok || !data.rankings) return
      const top = data.rankings.slice(0, 5)
      const startX = 16; const barY = y
      const medals = ['🥇', '🥈', '🥉']

      const label = new PIXI.Text('🏆 今日最肥鱼塘', {
        fontFamily: 'sans-serif', fontSize: 11, fill: '#F39C12', fontWeight: 'bold',
      } as any)
      label.x = startX; label.y = barY
      ctn.addChild(label)

      let rx = startX + 110
      for (let i = 0; i < top.length; i++) {
        const pond = getPondById(top[i].pondId)
        if (!pond) continue
        const txt = new PIXI.Text(`${medals[i] || ''}${pond.emoji}${top[i].dailyClears}`, {
          fontFamily: 'sans-serif', fontSize: 11, fill: '#BDC3C7',
        } as any)
        txt.x = rx; txt.y = barY
        ctn.addChild(txt)
        rx += txt.width + 16
      }
    } catch (e) {
      // Cloud call failed — skip ranking
    }
  }
```

- [ ] **Step 4: Adjust existing content positions**

Move the card sprites down to `h * 0.45` and the button to `h * 0.64`:

```typescript
    const startY = h * 0.45  // was 0.36
    // ...
    Math.floor(h * 0.64)  // was 0.58
    // ...
    const tip Y changed to h * 0.86  // was 0.82
```

- [ ] **Step 5: Trigger fish selection on return from Level 2 win**

In the start callback, check if player just cleared Level 2 and needs to select fish:

```typescript
    this._startCallback = () => {
      const cached = getCachedPond()
      if (!cached) {
        // No pond yet — check if they've cleared level 2 before
        const hasClearedL2 = wx.getStorageSync('cleared_level2')
        if (hasClearedL2 && !wx.getStorageSync('fish_selection_shown')) {
          const { SelectFishScene } = require('./SelectFishScene')
          this.manager.replace(new SelectFishScene())
          return
        }
      }
      const { GameScene } = require('./GameScene')
      this.manager.replace(new GameScene(), { levelId: 'level1' })
    }
```

---

### Task 5: GameScene — Contribution on Pass-Through

**Files:**
- Modify: `src/scenes/GameScene.ts` (onGameOver method)

**Interfaces:**
- Consumes: `getCachedPond` from `src/config/ponds.ts`
- Produces: Contribution cloud call + visual feedback

- [ ] **Step 1: Add contribution call in onGameOver**

Modify the `onGameOver` method to call contribute when the player wins:

```typescript
  private onGameOver(result: GameResult): void {
    if (result.won) {
      // Set cleared level 2 flag
      if (this.levelId === 'level2') {
        wx.setStorageSync('cleared_level2', true)
      }

      // Report contribution
      const cachedPond = getCachedPond()
      if (cachedPond) {
        wx.cloud.callFunction({
          name: 'contribute',
          data: {}
        }).then((res: any) => {
          if (res.result && res.result.ok) {
            const d = res.result
            setCachedPond({ ...cachedPond, todayContribution: d.todayContribution })
            // Show brief feedback
            wx.showToast({ title: `🐟 你为${d.pondName}+1条鱼！`, icon: 'none', duration: 2000 })
          }
        }).catch(() => {})
      }

      // Level 1 auto-advances to Level 2 on win
      if (result.levelId === 'level1') {
        this._pendingTransition = { levelId: 'level2' }
        return
      }
    }
    const { ResultOverlay } = require('./overlays/ResultOverlay')
    this.manager.push(new ResultOverlay(result, () => {
      this.logic.revive()
      this.renderSlotBar()
      this.renderHUD()
    }))
  }
```

- [ ] **Step 2: Check if player needs to select fish after clearing Level 2**

After Level 2 clear AND no fish selected, redirect to SelectFishScene:

```typescript
      if (this.levelId === 'level2' && !getCachedPond()) {
        wx.setStorageSync('fish_selection_shown', true)
        const { SelectFishScene } = require('./SelectFishScene')
        this.manager.replace(new SelectFishScene())
        return
      }
```

Insert this BEFORE the contribution call to prioritize fish selection.

---

### Task 6: Build and Verify

- [ ] **Step 1: Build the project**

```bash
npm run build
```

- [ ] **Step 2: Upload and test cloud functions in WeChat DevTools**

Right-click each cloud function folder → Upload & Deploy

- [ ] **Step 3: Test flow end-to-end**

1. Start game → play Level 1 → win → auto to Level 2
2. Clear Level 2 → fish selection screen appears
3. Select a fish → confirm → back to menu
4. Menu shows "My Pond" card with correct data
5. Play again → clear any level → contribution toast appears
```

