import * as PIXI from 'pixi.js-legacy'
import { Scene } from '../engine/Scene'
import { Button } from '../views/Button'
import { PONDS } from '../config/ponds'
import { getCachedPond, setCachedPond, getWaterById, WATER_BODIES } from '../config/waters'
import { PondView } from '../views/PondView'
import { PopupView } from '../views/PopupView'
import logger from '../utils/Logger'
import { generatePoster } from '../utils/SharePoster'
import { screenPos, px, getDPR } from '../platform/PixiAdapter'
import { getCachedRanking, setCachedRanking, clearRankingCache, getCachedDetail, setCachedDetail } from '../config/rankingCache'

export class MenuScene extends Scene {
  private _startHitArea: { x: number; y: number; w: number; h: number } | null = null
  private _startCallback: (() => void) | null = null
  private _shareHitArea: { x: number; y: number; w: number; h: number } | null = null
  private _shareCallback: (() => void) | null = null
  private _rankListHitArea: { x: number; y: number; w: number; h: number } | null = null
  private _rankListCallback: (() => void) | null = null
  private _rankOverlay: PIXI.Container | null = null
  private _rankOverlayAreas: Array<{ rect: { x: number; y: number; w: number; h: number }; cb: () => void }> = []
  private _detailOverlay: PIXI.Container | null = null
  private _detailOverlayAreas: Array<{ rect: { x: number; y: number; w: number; h: number }; cb: () => void }> = []
  private _detailPopup: PopupView | null = null
  private _pondHitAreas: Array<{ rect: { x: number; y: number; w: number; h: number }; cb: () => void }> = []
  private _pondViews: PondView[] = []
  private _myCloudData: any = null
  private _rankingCloudData: any = null
  private _gridY = 0
  private _scrollCtn: PIXI.Container | null = null
  private _scrollY = 0
  private _scrollMax = 0
  private _lastTouchX = 0
  private _lastTouchY = 0
  private _touchStart: any = null
  private _touchScrollStart: any = null
  private _touchScrollMove: any = null
  private _authBtn: any = null
  private _privacyResolve: ((res: { event: string }) => void) | null = null
  private _screenW = 375
  private _boardNameTxt: PIXI.Text | null = null
  private _boardNameShadowTxt: PIXI.Text | null = null
  private _boardRankTxt: PIXI.Text | null = null
  private _boardRankHighlightTxt: PIXI.Text | null = null
  private _boardCtn: PIXI.Container | null = null
  private _boardHitArea: { x: number; y: number; w: number; h: number } | null = null

  onEnter(_params?: unknown): void {
    const sysInfo = wx.getSystemInfoSync()
    const w = sysInfo.windowWidth
    const h = sysInfo.windowHeight
    this._screenW = w

    // Full-screen home background image
    const homeImg = wx.createImage()
    homeImg.onload = () => {
      const canvas = wx.createCanvas(); canvas.width = homeImg.width; canvas.height = homeImg.height
      canvas.getContext('2d').drawImage(homeImg, 0, 0)
      const tex = PIXI.Texture.from(canvas)
      const bgSp = new PIXI.Sprite(tex)
      bgSp.width = w; bgSp.height = h
      this.container.addChildAt(bgSp, 0)
    }
    homeImg.src = 'assets/home.jpg'

    // Water body name overlaid on background's wooden bulletin board (left-center)
    const boardCtn = new PIXI.Container()
    boardCtn.x = 40; boardCtn.y = Math.floor(h * 0.49)
    this._boardCtn = boardCtn
    this.container.addChild(boardCtn)

    // Rank — top line, smaller
    const rankHighlight = new PIXI.Text('', {
      fontFamily: 'sans-serif', fontSize: 12, fontWeight: 'bold',
      fill: '#8E7355', align: 'center',
    } as any)
    rankHighlight.x = -1; rankHighlight.y = -5
    boardCtn.addChild(rankHighlight)

    const boardRank = new PIXI.Text('', {
      fontFamily: 'sans-serif', fontSize: 12, fontWeight: 'bold',
      fill: '#3D2615', align: 'center',
    } as any)
    boardRank.x = 0; boardRank.y = -4
    boardCtn.addChild(boardRank)
    this._boardRankTxt = boardRank
    this._boardRankHighlightTxt = rankHighlight

    // Water name — below rank, larger
    const boardHighlight = new PIXI.Text('···', {
      fontFamily: 'sans-serif', fontSize: 17, fontWeight: 'bold',
      fill: '#8E7355', align: 'center',
    } as any)
    boardHighlight.x = -1; boardHighlight.y = 11
    boardCtn.addChild(boardHighlight)

    const boardName = new PIXI.Text('···', {
      fontFamily: 'sans-serif', fontSize: 17, fontWeight: 'bold',
      fill: '#3D2615', align: 'center',
    } as any)
    boardName.x = 0; boardName.y = 12
    boardCtn.addChild(boardName)
    this._boardNameTxt = boardName
    this._boardNameShadowTxt = boardHighlight

    // Hit area for bulletin board — tap to open water body detail popup
    this._boardHitArea = { x: 26, y: Math.floor(h * 0.49) - 4, w: 130, h: 50 }

    const barY = 4
    // Single water body — will be created after cloud data loads
    this._loadRealCounts(w, barY)

    // Auth: cloud-stored avatar takes priority, fallback to local storage
    this._setupAuth(w, h)

    // Listen for async join-water-body result (fired from GameScene background task)
    this.listen<{ ok: boolean; pondName?: string; fishName?: string; fishEmoji?: string; reason?: string }>('pondJoined', (e) => {
      if (e.ok) {
        wx.showToast({ title: `🐟 加入${e.pondName}！摸到${e.fishName}`, icon: 'none', duration: 2500 })
        // Reload pond to show new fish
        this._loadRealCounts(this._screenW, 4)
      } else {
        wx.showToast({ title: `加入鱼塘失败: ${e.reason}`, icon: 'none', duration: 2000 })
      }
    })

    // Button: 鱼塘排行榜 (top)
    const btnW = 180; const btnH = 44; const btnX = (w - btnW) / 2; const btnY1 = Math.floor(h * 0.38)
    const rankBtn = new Button(btnX, btnY1, btnW, btnH, '🏆 水域排行榜', {
      bgColor: '#5C4033', textColor: '#FFFFFF', fontSize: 18, radius: 14, shadow: true,
    })
    this.container.addChild(rankBtn.container)
    this._rankListHitArea = rankBtn.hitArea
    this._rankListCallback = () => this._showRankingOverlay(w, h)

    // Button: 加入鱼塘 (bottom)
    const btn = new Button(btnX, btnY1 + btnH + 10, btnW, btnH, '加入鱼塘', {
      bgColor: '#E67E22', textColor: '#FFFFFF', fontSize: 20, radius: 14, shadow: true,
    })
    this.container.addChild(btn.container)
    this._startHitArea = btn.hitArea
    this._startCallback = () => {
      const { GameScene } = require('./GameScene')
      this.manager.replace(new GameScene(), { levelId: 'level1' })
    }

    // Touch scroll + track position for fish splash
    if (typeof wx !== 'undefined') {
      this._touchStart = (e: any) => {
        if (e.touches?.length) {
          this._lastTouchX = e.touches[0].clientX
          this._lastTouchY = e.touches[0].clientY
        }
      }
      wx.onTouchStart(this._touchStart)
      if (this._scrollMax > 0) {
        let startY = 0; let startScroll = 0
        this._touchScrollStart = (e: any) => { if (e.touches?.length) { startY = e.touches[0].clientY; startScroll = this._scrollY } }
        this._touchScrollMove = (e: any) => {
          if (e.touches?.length && this._scrollCtn) {
            this._scrollY = Math.max(-this._scrollMax, Math.min(0, startScroll + e.touches[0].clientY - startY))
            this._scrollCtn.y = this._scrollY
          }
        }
        wx.onTouchStart(this._touchScrollStart)
        wx.onTouchMove(this._touchScrollMove)
      }
    }
  }

  /** Setup privacy agreement + createUserInfoButton (参考猫密LoginScene/HomeScene) */
  private _setupAuth(screenW: number, screenH: number): void {
    if (typeof wx === 'undefined') return
    const self = this

    // 1. 隐私协议处理
    if (wx.onNeedPrivacyAuthorization) {
      wx.onNeedPrivacyAuthorization((resolve: any) => {
        self._privacyResolve = resolve
        wx.showModal({
          title: '隐私协议',
          content: '为了展示你的头像和昵称，我们需要获取你的公开信息。请阅读并同意《隐私保护指引》。',
          confirmText: '同意',
          cancelText: '拒绝',
          success: (res: any) => {
            if (res.confirm) {
              resolve({ event: 'agree' })
              self._privacyResolve = null
            }
          }
        })
      })
    }

    // 2. 创建原生授权按钮 — 覆盖"我的鱼塘"栏区域
    // 按钮透明，覆盖在顶部栏上，用户点击即触发授权
    const btnW = screenW - 24
    const btnH = 30
    const btnX = 12
    const btnY = 4

    this._authBtn = wx.createUserInfoButton({
      type: 'text',
      text: '',
      style: {
        left: btnX,
        top: btnY,
        width: btnW,
        height: btnH,
        lineHeight: btnH,
        backgroundColor: 'transparent',
        color: 'transparent',
        textAlign: 'center',
        fontSize: 1,
        borderRadius: 0,
      }
    })

    this._authBtn.onTap((res: any) => {
      logger.info('MenuScene', 'UserInfoButton tapped ' + JSON.stringify(res))
      if (res.errMsg === 'getUserInfo:ok' && res.userInfo) {
        const avatarUrl = res.userInfo.avatarUrl || ''
        const nickName = res.userInfo.nickName || ''
        // 销毁授权按钮
        if (self._authBtn) { self._authBtn.destroy(); self._authBtn = null }
        // Upload avatar to cloud + apply to pond
        self._applyAvatar(avatarUrl)
        logger.info('MenuScene', `授权成功 avatarUrl=${avatarUrl} nickName=${nickName}`)
      } else {
        logger.info('MenuScene', '授权失败或取消', res.errMsg)
      }
    })
  }

  /** 将头像URL上传到云端 + 应用到鱼塘视图 */
  private _applyAvatar(avatarUrl: string): void {
    if (!avatarUrl) return
    const cachedPond = getCachedPond()
    const pondId = cachedPond?.pondId

    // 1. 上传头像到云数据库 players
    if (pondId) {
      wx.cloud.callFunction({
        name: 'updateAvatar',
        data: { avatarUrl }
      }).then((res: any) => {
        logger.info('MenuScene', 'updateAvatar返回 ' + JSON.stringify((res as any).result))
      }).catch((e: any) => logger.warn('MenuScene', 'updateAvatar失败', e))
    }

    // 2. 本地展示：我的鱼塘显示头像
    if (pondId) {
      const myIdx = PONDS.findIndex(p => p.id === pondId)
      if (myIdx >= 0 && this._pondViews[myIdx]) {
        this._pondViews[myIdx].showContributors([{ url: avatarUrl, count: 1 }])
      }
    }
  }

  private async _loadRealCounts(w: number, barY: number): Promise<void> {
    let data: any = null
    // Check 5-minute ranking cache first
    const cached = getCachedRanking()
    if (cached) {
      data = cached
      this._rankingCloudData = data
      logger.info('MenuScene', 'getPondRanking CACHE HIT')
    } else {
      try {
        const res = await wx.cloud.callFunction({ name: 'getPondRanking', data: {} })
        data = (res as any).result
        if (data?.ok) setCachedRanking(data)
        this._rankingCloudData = data
        logger.info('MenuScene', 'getPondRanking返回 ' + JSON.stringify({ ok: data?.ok, myPond: data?.myPond?.pondId, fatPondLen: data?.fatPondRank?.length, contribKeys: Object.keys(data?.contributors || {}) }))
      } catch (e) { logger.warn('MenuScene', 'getPondRanking failed', e) }
    }
    if (data?.myPond) {
      this._myCloudData = data.myPond
      if (data.myPond.avatarUrl) this._applyAvatar(data.myPond.avatarUrl)
    }

    // Determine which pond to show: user selection > my pond > #1 ranked
    let targetPondId = this._currentPondId || data?.myPond?.pondId
    if (!targetPondId && data?.fatPondRank?.length > 0) {
      targetPondId = data.fatPondRank[0].pondId
    }
    if (!targetPondId) targetPondId = WATER_BODIES[0].waterId

    this._currentPondId = targetPondId
    this._rebuildPondView(targetPondId, w)
  }

  /** Build or rebuild the PondView + fish for a given water body using cached cloud data */
  private _rebuildPondView(waterId: string, w: number): void {
    const data = this._rankingCloudData
    const water = getWaterById(waterId) || getWaterById(WATER_BODIES[0].waterId)!
    this._currentPondId = waterId

    // Clean up old pond views first
    for (const pv of this._pondViews) { this.container.removeChild(pv.container); pv.container.destroy({ children: true }) }
    this._pondViews = []
    this._pondHitAreas = []

    // Compute rank from sorted cloud data (match ranking overlay sort order)
    let pondRank = 0; let fishCount = 0
    if (data?.fatPondRank) {
      const sorted = [...data.fatPondRank].sort((a: any, b: any) => (b.dailyClears || 0) - (a.dailyClears || 0))
      const info = sorted.find((d: any) => d.pondId === waterId)
      pondRank = info ? sorted.indexOf(info) + 1 : 0
      fishCount = info?.dailyClears || 0
    }
    this._updateBoardInfo(waterId, pondRank, fishCount)

    const screenH = (typeof wx !== 'undefined' ? wx.getSystemInfoSync().windowHeight : 667)
    const pondW = w
    const pondH = Math.floor(screenH / 3)
    const px = 0
    const py = screenH - pondH

    // Build PondConfig-compatible object from water data
    const pondCfg = {
      id: water.waterId, name: water.waterName, fishId: 'xiaojinyu',
      fishName: '小金鱼', emoji: water.emoji, careerHint: water.province,
      slogan: water.waterName, color: '#4A90D9', colorInt: 0x4A90D9,
    }
    const pv = new PondView(pondCfg, 0, px, py, pondW, pondH)
    this.container.addChild(pv.container)
    this._pondViews = [pv]
    this._pondHitAreas.push({
      rect: { x: px, y: py, w: pondW, h: 22 },
      cb: () => { this._showPondDetailOverlay(waterId) }
    })

    // Spawn fish: cloud data first, fallback to all default fish types
    let entries: Array<{ url: string; fishId: string }> = []
    if (data?.ok && data.fishEntries) {
      entries = data.fishEntries[waterId] || []
    }
    if (entries.length === 0) {
      // Show all 12 default fish types so pond never looks empty
      const allFish = ['xiaojinyu','xianyugan','jinli','hetun','moyu','haima','feiyu','zhangyu','bimuyu','pangxie','jianyu','haitun']
      for (const fid of allFish) {
        entries.push({ url: '', fishId: fid })
      }
    }
    logger.info('MenuScene', `spawnFish targetPondId=${waterId} fishCount=${entries.length}`)
    pv.spawnFromEntries(entries)
  }

  private _showRankingOverlay(w: number, h: number): void {
    if (this._rankOverlay) { this.container.removeChild(this._rankOverlay); this._rankOverlay.destroy({ children: true }) }
    const ctn = new PIXI.Container()
    this._rankOverlay = ctn
    this._rankOverlayAreas = []

    // Dark overlay background
    const mask = new PIXI.Graphics()
    mask.beginFill(0x000000, 0.7); mask.drawRect(0, 0, w, h); mask.endFill()
    ctn.addChild(mask)

    // Title
    const title = new PIXI.Text('🏆 水域排行榜', {
      fontFamily: 'sans-serif', fontSize: 22, fontWeight: 'bold', fill: '#F39C12',
    } as any)
    title.anchor.set(0.5); title.x = w / 2; title.y = h * 0.08
    ctn.addChild(title)

    const medals = ['🥇', '🥈', '🥉']
    const listY = h * 0.14; const cols = 2; const colGap = 8
    const colW = Math.floor((w - 32 - colGap) / cols); const rowH = 34; const rowGap = 2
    const cachedPond = getCachedPond()
    const self = this

    // Sort water bodies by fish count from cloud data (descending)
    const rankData = this._rankingCloudData?.fatPondRank
    const getCount = (waterId: string) => rankData?.find((r: any) => r.pondId === waterId)?.dailyClears || 0
    const sorted = [...WATER_BODIES].sort((a, b) => getCount(b.waterId) - getCount(a.waterId))
    const rows = Math.ceil(sorted.length / cols)

    for (let i = 0; i < sorted.length; i++) {
      const wb = sorted[i]
      const col = i % cols; const row = Math.floor(i / cols)
      const cx = 16 + col * (colW + colGap)
      const cy = listY + row * (rowH + rowGap)
      const isMyWater = cachedPond?.pondId === wb.waterId || this._currentPondId === wb.waterId

      const bg = new PIXI.Graphics()
      bg.beginFill(isMyWater ? 0x1A5276 : 0x2C3E50, isMyWater ? 0.9 : 0.7)
      bg.drawRoundedRect(cx, cy, colW, rowH, 7)
      bg.endFill()
      if (isMyWater) { bg.lineStyle(1, 0x3498DB, 0.5); bg.drawRoundedRect(cx, cy, colW, rowH, 7) }
      ctn.addChild(bg)

      const rx = cx + 6; const ry = cy + 2
      const rankTxt = new PIXI.Text(i < 3 ? medals[i] : `${i + 1}`, {
        fontFamily: 'sans-serif', fontSize: 11, fill: i < 3 ? '#F1C40F' : '#8B7355',
      } as any)
      rankTxt.x = rx; rankTxt.y = ry
      ctn.addChild(rankTxt)

      const nameTxt = new PIXI.Text(`${wb.emoji} ${wb.waterName}`, {
        fontFamily: 'sans-serif', fontSize: 11, fontWeight: 'bold', fill: '#FFFFFF',
      } as any)
      nameTxt.x = rx + 16; nameTxt.y = ry
      ctn.addChild(nameTxt)

      const wrapW = colW - 48
      const subTxt = new PIXI.Text(wb.province, {
        fontFamily: 'sans-serif', fontSize: 9, fill: '#7F8C8D',
        wordWrap: true, wordWrapWidth: wrapW,
      } as any)
      subTxt.x = rx + 16; subTxt.y = ry + 16
      ctn.addChild(subTxt)

      this._rankOverlayAreas.push({
        rect: { x: cx, y: cy, w: colW, h: rowH },
        cb: () => {
          self._rankOverlay?.destroy({ children: true })
          self._rankOverlay = null
          self._rankOverlayAreas = []
          // Switch home page to selected water body
          self._currentPondId = wb.waterId
          self._rebuildPondView(wb.waterId, w)
        }
      })
    }

    // Close button
    const closeY = listY + rows * (rowH + rowGap) + 10
    const closeBg = new PIXI.Graphics()
    closeBg.beginFill(0x7F8C8D, 0.7)
    closeBg.drawRoundedRect((w - 120) / 2, closeY, 120, 36, 8)
    closeBg.endFill()
    ctn.addChild(closeBg)
    const closeTxt = new PIXI.Text('关闭', { fontFamily: 'sans-serif', fontSize: 14, fill: '#FFFFFF' } as any)
    closeTxt.anchor.set(0.5); closeTxt.x = w / 2; closeTxt.y = closeY + 18
    ctn.addChild(closeTxt)
    this._rankOverlayAreas.push({
      rect: { x: (w - 120) / 2, y: closeY, w: 120, h: 36 },
      cb: () => {
        self._rankOverlay?.destroy({ children: true })
        self._rankOverlay = null; self._rankOverlayAreas = []
      }
    })

    this.container.addChild(ctn)
  }

  /** Show water body detail as an internal overlay (keeps fish swimming) */
  private _showPondDetailOverlay(waterId: string): void {
    if (this._detailOverlay) { this.container.removeChild(this._detailOverlay); this._detailOverlay.destroy({ children: true }) }
    const water = getWaterById(waterId) || WATER_BODIES[0]

    const h = (typeof wx !== 'undefined' ? wx.getSystemInfoSync().windowHeight : 667)
    const self = this
    const popup = new PopupView(this._screenW, h, Math.floor(h * 0.62), {
      width: this._screenW - 32, closable: true, closeOnBackdrop: true,
      onClose: () => { self._detailOverlay = null; self._detailOverlayAreas = []; self._detailPopup = null }
    })
    this._detailOverlay = popup.container
    this._detailOverlayAreas = popup.hitAreas
    this._detailPopup = popup

    const cx = (popup.cardW - 32) / 2; let cy = 16

    const emoji = new PIXI.Text(water.emoji, { fontFamily: 'sans-serif', fontSize: 36 } as any)
    emoji.anchor.set(0.5); emoji.x = cx; emoji.y = cy
    popup.content.addChild(emoji)

    cy += 40
    const nameTxt = new PIXI.Text(water.waterName, { fontFamily: 'sans-serif', fontSize: 22, fontWeight: 'bold', fill: '#FFFFFF' } as any)
    nameTxt.anchor.set(0.5); nameTxt.x = cx; nameTxt.y = cy
    popup.content.addChild(nameTxt)

    cy += 24
    const subTxt = new PIXI.Text(`${water.emoji} ${water.province}`, { fontFamily: 'sans-serif', fontSize: 12, fill: '#8BA0B0' } as any)
    subTxt.anchor.set(0.5); subTxt.x = cx; subTxt.y = cy
    popup.content.addChild(subTxt)

    this.container.addChild(popup.container)
    this._loadPondDetailData(popup, cy + 10, waterId)
  }

  /** Async load water body detail stats into the overlay */
  private async _loadPondDetailData(popup: PopupView, startY: number, waterId: string): Promise<void> {
    try {
      let d = getCachedDetail(waterId)
      if (!d) {
        const res = await wx.cloud.callFunction({ name: 'getPondDetail', data: { pondId: waterId } })
        d = (res as any).result
        if (d?.ok) setCachedDetail(waterId, d)
      }
      if (!d?.ok || !popup.container.parent) return

      const cx = (popup.cardW - 32) / 2; let cy = startY

      const divider = new PIXI.Graphics()
      divider.lineStyle(1, 0xFFFFFF, 0.10)
      divider.moveTo(cx - 80, cy); divider.lineTo(cx + 80, cy)
      popup.content.addChild(divider)
      cy += 12

      const lines = [
        `🏆 今日排行：第 ${d.rank} 名`,
        `🐟 今日鱼数：${d.dailyClears || 0}`,
        `👥 活跃人数：${d.activeMembers || 0}`,
        `📊 人均：${d.perCapita || 0} 条/人`
      ]
      for (const line of lines) {
        const t = new PIXI.Text(line, { fontFamily: 'sans-serif', fontSize: 13, fill: '#A8B8C8' } as any)
        t.anchor.set(0.5); t.x = cx; t.y = cy; cy += 24
        popup.content.addChild(t)
      }

      if (d.heroes?.length) {
        cy += 4
        const d2 = new PIXI.Graphics()
        d2.lineStyle(1, 0xFFFFFF, 0.08)
        d2.moveTo(cx - 60, cy); d2.lineTo(cx + 60, cy)
        popup.content.addChild(d2)
        cy += 14

        const ht = new PIXI.Text('🏅 鱼塘英雄榜', { fontFamily: 'sans-serif', fontSize: 14, fontWeight: 'bold', fill: '#E8B45A' } as any)
        ht.anchor.set(0.5); ht.x = cx; ht.y = cy; cy += 22
        popup.content.addChild(ht)

        for (let i = 0; i < Math.min(d.heroes.length, 10); i++) {
          const h = d.heroes[i]
          const t = new PIXI.Text(`${i + 1}. 🐟 通关 ${h.todayClears || 0} 次`, { fontFamily: 'sans-serif', fontSize: 12, fill: '#8BA0B0' } as any)
          t.anchor.set(0.5); t.x = cx; t.y = cy; cy += 18
          popup.content.addChild(t)
        }
      }
    } catch {}
  }

  private _currentPondId: string | null = null
  private _currentRank = 0

  /** Update water body name + rank on the wooden bulletin board */
  private _updateBoardInfo(waterId: string, rank: number, _fishCount: number): void {
    if (!this._boardNameTxt) return
    const water = getWaterById(waterId)
    const displayName = water ? water.waterName : '未加入水域'
    this._boardNameTxt.text = displayName
    if (this._boardNameShadowTxt) this._boardNameShadowTxt.text = displayName

    const medals = ['🥇', '🥈', '🥉']
    const rankText = rank > 0 ? (rank <= 3 ? `${medals[rank - 1]} 第${rank}名` : `No.${rank}`) : ''
    if (this._boardRankTxt) this._boardRankTxt.text = rankText
    if (this._boardRankHighlightTxt) this._boardRankHighlightTxt.text = rankText
  }

  onDestroy(): void {
    if (this._authBtn) { this._authBtn.destroy(); this._authBtn = null }
    if (typeof wx !== 'undefined') {
      if (this._touchStart) wx.offTouchStart(this._touchStart)
      if (this._touchScrollStart) wx.offTouchStart(this._touchScrollStart)
      if (this._touchScrollMove) wx.offTouchMove(this._touchScrollMove)
    }
  }

  private _announceIdx = 0
  private _announceTimer = 0

  onUpdate(dt: number): void {
    if (this._startHitArea && this._startCallback) this.registerHitArea(this._startHitArea, this._startCallback, 10)
    if (this._shareHitArea && this._shareCallback) this.registerHitArea(this._shareHitArea, this._shareCallback, 12)
    if (this._rankListHitArea && this._rankListCallback) this.registerHitArea(this._rankListHitArea, this._rankListCallback, 12)
    for (const item of this._rankOverlayAreas) this.registerHitArea(item.rect, item.cb, 25)
    if (this._boardHitArea && this._currentPondId) {
      const pondId = this._currentPondId
      this.registerHitArea(this._boardHitArea, () => { this._showPondDetailOverlay(pondId) }, 15)
    }
    for (const item of this._detailOverlayAreas) this.registerHitArea(item.rect, item.cb, 30)
    for (const item of this._pondHitAreas) this.registerHitArea(item.rect, item.cb, 10)
    for (const pv of this._pondViews) {
      pv.updateFish(dt)
      if (!pv.container || !pv.container.parent) continue
      const sp = screenPos(pv.container)
      const dpr = getDPR()
      const pw = this._screenW - 60
      // Hit areas in logical pixels (matching touch coordinates)
      this.registerHitArea({ x: sp.x / dpr + 8, y: sp.y / dpr + 22, w: pw - 16, h: 210 - 26 }, () => {
        pv.dashNear(this._lastTouchX - sp.x / dpr, this._lastTouchY - sp.y / dpr, 60)
      }, 16)
      for (const item of pv.getFishHitAreas()) this.registerHitArea(item.rect, item.cb, 20)
    }
  }
}
