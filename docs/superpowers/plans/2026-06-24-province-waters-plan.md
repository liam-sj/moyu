# 省份水域系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 12 career-themed ponds with 31 province-specific water bodies, auto-detect user province via profile/GPS, and auto-join on level clear.

**Architecture:** New `waters.ts` config maps province→water body. Province detection uses 3-tier fallback: wx.getUserInfo profile → GPS+cloud reverse geocode → "四海为家" default. Cloud functions switch from pondId to waterId. Pond picker UI removed; fish result page directly shows auto-joined water.

**Tech Stack:** TypeScript + PixiJS + WeChat Cloud (wx-server-sdk) + Tencent Map Reverse Geocoding API

## Global Constraints

- Cloud functions: plain JS (no TypeScript type annotations)
- Package size: under 4MB (game.js)
- All user state in cloud DB, not local storage (except lightweight caches)
- Province detection: profile → GPS → default fallback
- 31 provinces each map to one water body
- Default water: "四海为家" for users who deny all location access

---

## File Structure

```
NEW:     src/config/waters.ts           — 31 province→water map + cache + lookup
NEW:     cloudfunctions/getProvince/    — GPS→province reverse geocode
MODIFY:  src/scenes/overlays/GameOverlayView.ts  — merged fish+auto-join result page
MODIFY:  src/scenes/GameScene.ts        — remove pond picker, wire auto-join
MODIFY:  src/scenes/MenuScene.ts        — pondId→waterId, bulletin board
MODIFY:  cloudfunctions/selectAndContribute/  — pondId→waterId
MODIFY:  cloudfunctions/getPondRanking/ — water-based ranking
DELETE:  src/scenes/SelectFishScene.ts  — no longer needed
DELETE:  src/config/ponds.ts            — replaced by waters.ts
```

---

### Task 1: Province Water Config + Cache

**Files:**
- Create: `src/config/waters.ts`

**Interfaces:**
- Produces: `WATER_BODIES: WaterBody[]`, `getWaterByProvince(province: string): WaterBody`, `getCachedProvince(): string | null`, `setCachedProvince(province: string): void`, `DEFAULT_WATER: WaterBody`, `WaterBody { waterId, province, waterName, emoji }`

- [ ] **Step 1: Write `src/config/waters.ts`**

```typescript
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
```

- [ ] **Step 2: Build to verify**

```bash
npm run build
```
Expected: Build passes, no errors related to waters.ts.

- [ ] **Step 3: Commit**

```bash
git add src/config/waters.ts
git commit -m "feat: add province water body config with detection fallback"
```

---

### Task 2: GPS Reverse Geocode Cloud Function

**Files:**
- Create: `cloudfunctions/getProvince/index.js`
- Create: `cloudfunctions/getProvince/config.json`
- Create: `cloudfunctions/getProvince/package.json`

**Interfaces:**
- Input: `{ latitude: number, longitude: number }`
- Output: `{ ok: true, province: string }` or `{ ok: false }`
- Consumes: Tencent Map API key (set in cloud env or hardcoded)

- [ ] **Step 1: Write `cloudfunctions/getProvince/package.json`**

```json
{
  "name": "getProvince",
  "version": "1.0.0",
  "description": "GPS coordinates → province name via Tencent Map API",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "latest"
  }
}
```

- [ ] **Step 2: Write `cloudfunctions/getProvince/config.json`**

```json
{
  "permissions": {
    "openapi": []
  }
}
```

- [ ] **Step 3: Write `cloudfunctions/getProvince/index.js`**

```javascript
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
```

- [ ] **Step 4: Verify syntax**

```bash
node -c cloudfunctions/getProvince/index.js
```
Expected: No syntax errors.

- [ ] **Step 5: Deploy and test**

Deploy via WeChat IDE: right-click `cloudfunctions/getProvince` → "上传并部署"

- [ ] **Step 6: Commit**

```bash
git add cloudfunctions/getProvince/
git commit -m "feat: add getProvince cloud function for GPS→province reverse geocode"
```

---

### Task 3: Merge Fish Result + Auto-Join to GameOverlayView

**Files:**
- Modify: `src/scenes/overlays/GameOverlayView.ts`

**Interfaces:**
- Removes: `showPondPicker()` method
- Modifies: `showFishResult()` — adds province detection + auto-join after fish display
- Produces: combined result page showing fish + detected water body + auto-join

- [ ] **Step 1: Update imports in GameOverlayView.ts**

Remove unused imports:
```typescript
// REMOVE: import { setCachedPond, getCachedPond } from '../../config/ponds'
// REMOVE: import { getCachedRanking } from '../../config/rankingCache'
// REMOVE unused imports for pond picker

// ADD:
import { detectProvince, getWaterByProvince, DEFAULT_WATER, setCachedProvince } from '../../config/waters'
```

- [ ] **Step 2: Rewrite `showFishResult` to include auto-join**

Replace the entire `showFishResult` method:

```typescript
  /** Combined result: show fish + auto-detect province → auto-join water body */
  showFishResult(fishId: string, fishInfo: { name: string; emoji: string }): void {
    const w = this.host.screenW; const h = this.host.screenH
    const overlay = new PIXI.Graphics()
    overlay.beginFill(0x0A1628, 0.95); overlay.drawRect(0, 0, w, h); overlay.endFill()
    this.host.container.addChild(overlay)

    const cx = w / 2

    // Title
    const congrats = new PIXI.Text('🎉 恭喜通关！', {
      fontFamily: 'sans-serif', fontSize: 24, fontWeight: 'bold', fill: '#F1C40F',
    } as any)
    congrats.anchor.set(0.5); congrats.x = cx; congrats.y = Math.floor(h * 0.08)
    this.host.container.addChild(congrats)

    // Fish image
    const fishCY = Math.floor(h * 0.22)
    const tex = getFishTex(fishId, 0)
    if (tex) {
      const sprite = new PIXI.Sprite(tex)
      sprite.anchor.set(0.5)
      sprite.height = 90; sprite.width = tex.width * (90 / tex.height)
      sprite.x = cx; sprite.y = fishCY
      this.host.container.addChild(sprite)
    } else {
      const fb = new PIXI.Text(fishInfo.emoji, { fontFamily: 'sans-serif', fontSize: 56 } as any)
      fb.anchor.set(0.5); fb.x = cx; fb.y = fishCY
      this.host.container.addChild(fb)
    }

    // Fish name
    const fishName = new PIXI.Text(`你摸到了一条 ${fishInfo.name}！`, {
      fontFamily: 'sans-serif', fontSize: 18, fontWeight: 'bold', fill: '#FFFFFF',
    } as any)
    fishName.anchor.set(0.5); fishName.x = cx; fishName.y = fishCY + 56
    this.host.container.addChild(fishName)

    // Province detection indicator
    const detectingY = fishCY + 88
    const detecting = new PIXI.Text('📍 正在定位你的水域...', {
      fontFamily: 'sans-serif', fontSize: 13, fill: '#7FB3D8',
    } as any)
    detecting.anchor.set(0.5); detecting.x = cx; detecting.y = detectingY
    this.host.container.addChild(detecting)

    // Water info placeholder (will be updated after detection)
    const waterInfoY = fishCY + 118
    const waterInfo = new PIXI.Text('', {
      fontFamily: 'sans-serif', fontSize: 15, fill: '#2ECC71', fontWeight: 'bold',
    } as any)
    waterInfo.anchor.set(0.5); waterInfo.x = cx; waterInfo.y = waterInfoY
    this.host.container.addChild(waterInfo)

    this.host._playFishSparkles(cx, fishCY)

    // Run detection
    const host = this.host
    ;(async () => {
      const province = await detectProvince()
      const water = province ? getWaterByProvince(province) : undefined
      const finalWater = water || DEFAULT_WATER

      // Remove detecting text
      detecting.text = ''
      waterInfo.text = `${finalWater.emoji} 已加入「${finalWater.waterName}」`

      if (!water) {
        waterInfo.text = `${finalWater.emoji} 漂流至「${finalWater.waterName}」`
        waterInfo.style.fill = '#F0A860'
      }

      // Auto-join via cloud
      this._joinPondAsync(fishId, fishInfo, finalWater.waterId, finalWater.waterName)

      // Tap to return home after 1.5s
      setTimeout(() => {
        const hint = new PIXI.Text('👆 点击任意位置返回', {
          fontFamily: 'sans-serif', fontSize: 13, fill: '#6B7B8D',
        } as any)
        hint.anchor.set(0.5); hint.x = cx; hint.y = waterInfoY + 40
        this.host.container.addChild(hint)

        host._resultArea = [{
          rect: { x: 0, y: 0, w, h },
          cb: () => {
            host._resultArea = []
            const { MenuScene } = require('../MenuScene')
            host.manager.replace(new MenuScene())
          }
        }]
      }, 1500)
    })()
  }
```

- [ ] **Step 3: Remove `_joinPondAsync` from GameOverlayView — keep it but remove references to pondNames map**

The `_joinPondAsync` method calls `setCachedPond` and emits `pondJoined`. Update to use waterId:

```typescript
  private _joinPondAsync(fishId: string, fishInfo: { name: string; emoji: string }, waterId: string, waterName: string): void {
    const bus = this.host.bus
    ;(async () => {
      let avatarUrl = ''
      let nickName = ''
      try {
        const userRes = await new Promise<any>((resolve) => {
          if (typeof wx !== 'undefined') {
            wx.getUserInfo({ success: (r: any) => resolve(r), fail: () => resolve(null) })
          } else { resolve(null) }
        })
        if (userRes?.userInfo) {
          avatarUrl = userRes.userInfo.avatarUrl || ''
          nickName = userRes.userInfo.nickName || ''
        }
      } catch (e) {}

      try {
        const conRes = await wx.cloud.callFunction({
          name: 'selectAndContribute',
          data: { fishId, pondId: waterId, avatarUrl, nickName, checkAchievements: true }
        })
        const r = (conRes as any).result
        if (r?.ok) {
          clearRankingCache()
          clearDetailCache()
          setCachedPond({ pondId: waterId, fishId, joinDate: new Date().toISOString(), todayContribution: 0, switchCount: 0 })
          bus.emit('pondJoined', { ok: true, pondName: waterName, fishName: fishInfo.name, fishEmoji: fishInfo.emoji })
          if (r.newAchievements?.length > 0) {
            for (const ach of r.newAchievements) {
              wx.showToast({ title: `${ach.emoji} 获得称号：${ach.name}！`, icon: 'none', duration: 3000 })
            }
          }
        }
      } catch (e: any) {
        logger.warn('GameOverlayView', 'joinWaterAsync failed ' + (e?.errMsg || String(e)))
      }
    })()
  }
```

- [ ] **Step 4: Build**

```bash
npm run build
```
Expected: Build passes.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/overlays/GameOverlayView.ts
git commit -m "feat: merge fish result + auto-join province water"
```

---

### Task 4: Update GameScene — Remove Pond Picker, Wire Auto-Join

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Update imports**

Remove unused imports:
```typescript
// REMOVE: import { getRandomFishId, FISH_TYPES } from '../config/ponds'
// ADD:
import { getRandomFishId, FISH_TYPES } from '../config/waters'  // (FISH_TYPES stays in GameScene for debug button)
```

Wait — `FISH_TYPES` and `getRandomFishId` are still in `ponds.ts`. We're deleting ponds.ts later. For now, keep importing from ponds.ts. The final cleanup happens in Task 7.

Actually, let me keep fish types in `waters.ts` too since ponds.ts is being deleted.

- [ ] **Step 1 (revised): Add FISH_TYPES to waters.ts**

In `src/config/waters.ts`, add at the end:

```typescript
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
```

- [ ] **Step 2: Update GameScene imports**

```typescript
// Change:
// import { getRandomFishId, FISH_TYPES } from '../config/ponds'
// To:
import { getRandomFishId, FISH_TYPES } from '../config/waters'
```

- [ ] **Step 3: Remove `_showPondPicker` delegation line**

Find and remove:
```typescript
// REMOVE this line:
private _showPondPicker(fishId: string, fishInfo: { name: string; emoji: string }): void { this.overlayView.showPondPicker(fishId, fishInfo) }
```

- [ ] **Step 4: Update debug button in `_addDebugSettings`**

The debug button calls `getRandomFishId()` which is now in waters.ts.

- [ ] **Step 5: Build**

```bash
npm run build
```
Expected: Build passes.

- [ ] **Step 6: Commit**

```bash
git add src/scenes/GameScene.ts src/config/waters.ts
git commit -m "feat: wire auto-join to GameScene, move fish types to waters.ts"
```

---

### Task 5: Update MenuScene for Water Bodies

**Files:**
- Modify: `src/scenes/MenuScene.ts`

Key changes:
- Replace `pondId` references with `waterId` / province
- Bulletin board shows water name + province
- Ranking shows water-based leaderboard
- Remove pond switching functionality

- [ ] **Step 1: Update imports**

```typescript
// Add:
import { getWaterById, getCachedProvince } from '../config/waters'
```

- [ ] **Step 2: Update bulletin board info**

In `_updateBoardInfo` (or equivalent), change pond display to water display:

Search for pond name display and replace with:
```typescript
const water = waterId ? getWaterById(waterId) : null
const displayName = water ? water.waterName : '未加入水域'
const displayEmoji = water ? water.emoji : '🌏'
```

- [ ] **Step 3: Update ranking display**

Replace pondNames map with dynamic water names from `getWaterById()`.

- [ ] **Step 4: Update cloud calls**

Update `_loadRealCounts` and ranking fetch to use `waterId` instead of `pondId` where applicable. Keep `getPondRanking` call for now (cloud function updates in Task 6).

- [ ] **Step 5: Build**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/scenes/MenuScene.ts
git commit -m "feat: adapt MenuScene to province water system"
```

---

### Task 6: Update Cloud Functions (pondId → waterId)

**Files:**
- Modify: `cloudfunctions/selectAndContribute/index.js`
- Modify: `cloudfunctions/getPondRanking/index.js`
- Modify: `cloudfunctions/getPondDetail/index.js`

- [ ] **Step 1: Update `selectAndContribute/index.js`**

All references to `pondId` stay as-is for now (the DB field name change is cosmetic). The cloud function receives `pondId` from the client — we pass `waterId` as `pondId`. No change needed in the cloud function logic itself, just ensure it uses the passed value.

Actually, the simplest approach: keep the DB field as `pondId` but pass `waterId` in its place. No cloud function changes needed — just ensure the client always passes `waterId` for `pondId`.

- [ ] **Step 2: Verify no cloud function changes needed**

```bash
grep -r "pondId" cloudfunctions/selectAndContribute/index.js
grep -r "pondId" cloudfunctions/getPondRanking/index.js
```
These functions accept `pondId` as a generic ID field — we pass `waterId` in its place. DB documents use `pondId` as field name which is fine.

- [ ] **Step 3: Commit (if changes)**

```bash
git commit -m "chore: verify cloud functions compatible with waterId"
```

---

### Task 7: Delete Obsolete Files

**Files:**
- Delete: `src/scenes/SelectFishScene.ts`
- Delete: `src/config/ponds.ts`

- [ ] **Step 1: Check for remaining imports of these files**

```bash
grep -r "SelectFishScene" src/ --include="*.ts"
grep -r "from.*ponds" src/ --include="*.ts"
```

- [ ] **Step 2: Remove remaining references**

If any file still imports from `ponds.ts`, update to import from `waters.ts` instead.
If any file references `SelectFishScene`, remove the import.

- [ ] **Step 3: Delete files**

```bash
rm src/scenes/SelectFishScene.ts
rm src/config/ponds.ts
```

- [ ] **Step 4: Build and verify**

```bash
npm run build
```
Expected: Build passes with no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove obsolete SelectFishScene and ponds.ts"
```

---

### Task 8: End-to-End Verification

- [ ] **Step 1: Build**

```bash
npm run build
```
Expected: Build passes.

- [ ] **Step 2: Check import references are clean**

```bash
grep -r "ponds\.ts\|SelectFishScene" src/ --include="*.ts"
```
Expected: No results.

- [ ] **Step 3: Verify all files exist**

```bash
ls src/config/waters.ts cloudfunctions/getProvince/index.js
```

- [ ] **Step 4: Deploy cloud functions**

In WeChat IDE: upload `getProvince`, `selectAndContribute`, `getPondRanking` cloud functions.

- [ ] **Step 5: Test on device**

1. Open mini-game → Level 2 → Debug通关
2. Should see auto-detection of province
3. Should see water body name displayed
4. Tapping should return to home page
5. Home page should show water name on bulletin board

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete province waters system migration"
```
