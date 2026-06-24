import * as PIXI from 'pixi.js-legacy'
import { Scene } from '../engine/Scene'
import { Button } from '../views/Button'
import { getPondById, PONDS, PondConfig } from '../config/ponds'
import { getCachedPond, setCachedPond } from '../config/waters'
import { getWaterById } from '../config/waters'
import { PondView } from '../views/PondView'
import { PopupView } from '../views/PopupView'
import logger from '../utils/Logger'
import { getFishTex } from '../views/FishView'
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

    // Water body name — carved dark lettering on wood (top)
    const boardHighlight = new PIXI.Text('···', {
      fontFamily: 'sans-serif', fontSize: 16, fontWeight: 'bold',
      fill: '#8E7355', align: 'center',
    } as any)
    boardHighlight.x = -1; boardHighlight.y = -1
    boardCtn.addChild(boardHighlight)

    const boardName = new PIXI.Text('···', {
      fontFamily: 'sans-serif', fontSize: 16, fontWeight: 'bold',
      fill: '#3D2615', align: 'center',
    } as any)
    boardName.x = 0; boardName.y = 0
    boardCtn.addChild(boardName)
    this._boardNameTxt = boardName
    this._boardNameShadowTxt = boardHighlight

    // Rank + fish count on same line — below water body name
    const rankHighlight = new PIXI.Text('', {
      fontFamily: 'sans-serif', fontSize: 11, fontWeight: 'bold',
      fill: '#8E7355', align: 'center',
    } as any)
    rankHighlight.x = -1; rankHighlight.y = 17
    boardCtn.addChild(rankHighlight)

    const boardRank = new PIXI.Text('', {
      fontFamily: 'sans-serif', fontSize: 11, fontWeight: 'bold',
      fill: '#3D2615', align: 'center',
    } as any)
    boardRank.x = 0; boardRank.y = 18
    boardCtn.addChild(boardRank)
    this._boardRankTxt = boardRank
    this._boardRankHighlightTxt = rankHighlight

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
    if (!targetPondId) targetPondId = PONDS[0].id

    // Clean up old pond views first
    for (const pv of this._pondViews) { this.container.removeChild(pv.container); pv.container.destroy({ children: true }) }
    this._pondViews = []
    this._pondHitAreas = []

    const pondCfg = getPondById(targetPondId) || PONDS[0]
    this._currentPondId = targetPondId
    // Compute rank + fish count from cloud data
    let pondRank = 0; let fishCount = 0
    if (data?.fatPondRank) {
      const info = data.fatPondRank.find((d: any) => d.pondId === targetPondId)
      pondRank = info?.rank || (info ? data.fatPondRank.indexOf(info) + 1 : 0)
      fishCount = info?.dailyClears || 0
    }
    this._updateBoardInfo(targetPondId, pondRank, fishCount)

    const screenH = (typeof wx !== 'undefined' ? wx.getSystemInfoSync().windowHeight : 667)
    const pondW = w  // full width
    const pondH = Math.floor(screenH / 3)  // exactly bottom 1/3
    const px = 0
    const py = screenH - pondH  // bottom edge

    const pv = new PondView(pondCfg, 0, px, py, pondW, pondH)
    this.container.addChild(pv.container)
    this._pondViews = [pv]
    this._pondHitAreas.push({
      rect: { x: px, y: py, w: pondW, h: 22 },
      cb: () => { this._showPondDetailOverlay(targetPondId) }
    })

    // Spawn fish if data available
    if (data?.ok && data.fatPondRank) {
      const info = data.fatPondRank.find((d: any) => d.pondId === targetPondId)
      const entries = (data.fishEntries && data.fishEntries[targetPondId]) || []
      logger.info('MenuScene', `spawnFish targetPondId=${targetPondId} fishCount=${entries.length}`)
      pv.spawnFromEntries(entries)
      if (info) { const rank = info.rank || (data.fatPondRank.indexOf(info) + 1); pv.updateRank?.(rank) }
    }
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
    const listY = h * 0.16; const rowH = 46; const gap = 2
    const cachedPond = getCachedPond()
    const self = this

    // Sort ponds by cloud data, append missing ponds with 0 count
    const rankedIds = new Set<string>()
    const pondList: PondConfig[] = []
    if (this._rankingCloudData?.fatPondRank) {
      for (const r of this._rankingCloudData.fatPondRank) {
        const cfg = getPondById(r.pondId)
        if (cfg) { pondList.push(cfg); rankedIds.add(r.pondId) }
      }
    }
    // Add ponds not in cloud data
    for (const p of PONDS) {
      if (!rankedIds.has(p.id)) pondList.push(p)
    }

    for (let i = 0; i < pondList.length; i++) {
      const pond = pondList[i]!
      const ry = listY + i * (rowH + gap)
      const isMyPond = cachedPond?.pondId === pond.id || this._currentPondId === pond.id

      const bg = new PIXI.Graphics()
      bg.beginFill(isMyPond ? pond.colorInt : 0x2C3E50, 0.8)
      bg.drawRoundedRect(16, ry, w - 32, rowH, 8)
      bg.endFill()
      if (isMyPond) { bg.lineStyle(2, 0xF39C12, 0.6); bg.drawRoundedRect(16, ry, w - 32, rowH, 8) }
      ctn.addChild(bg)

      const rank = new PIXI.Text(i < 3 ? medals[i] : `${i + 1}`, {
        fontFamily: 'sans-serif', fontSize: i < 3 ? 22 : 16, fill: i < 3 ? '#F1C40F' : '#8B7355',
      } as any)
      rank.x = 28; rank.y = i < 3 ? ry + 8 : ry + 12
      ctn.addChild(rank)

      // Fish sprite from atlas
      const fishTex = getFishTex(pond.fishId)
      if (fishTex) {
        const fishSp = new PIXI.Sprite(fishTex)
        fishSp.width = 28; fishSp.height = 28
        fishSp.x = 24; fishSp.y = ry + 8
        ctn.addChild(fishSp)
      }
      const water = getWaterById(pond.id)
      const waterName = water ? water.waterName : pond.name
      const name = new PIXI.Text(waterName, {
        fontFamily: 'sans-serif', fontSize: 15, fontWeight: 'bold', fill: '#FFFFFF',
      } as any)
      name.x = 60; name.y = ry + 6
      ctn.addChild(name)

      // Fish count from cloud data
      const cloudInfo = this._rankingCloudData?.fatPondRank?.find((r: any) => r.pondId === pond.id)
      const fishCount = cloudInfo?.dailyClears || 0
      const countTxt = new PIXI.Text(`${fishCount}🐟`, {
        fontFamily: 'sans-serif', fontSize: 14, fontWeight: 'bold', fill: '#F39C12',
      } as any)
      countTxt.anchor.set(1, 0); countTxt.x = w - 24; countTxt.y = ry + 12
      ctn.addChild(countTxt)

      const subInfo = water ? `${water.emoji} ${water.province}` : pond.slogan
      const subTxt = new PIXI.Text(subInfo, {
        fontFamily: 'sans-serif', fontSize: 10, fill: '#A09080',
      } as any)
      subTxt.x = 60; subTxt.y = ry + 28
      ctn.addChild(subTxt)

      this._rankOverlayAreas.push({
        rect: { x: 16, y: ry, w: w - 32, h: rowH },
        cb: () => {
          logger.info('MenuScene', '排行榜选中鱼塘 ' + pond.id)
          self._rankOverlay?.destroy({ children: true })
          self._rankOverlay = null
          self._rankOverlayAreas = []
        }
      })
    }

    // Close button
    const closeY = listY + pondList.length * (rowH + gap) + 10
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
    const pond = getPondById(waterId)
    if (!pond) return

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

    // Header: water body info
    const water = getWaterById(waterId)
    const displayEmoji = water ? water.emoji : pond.emoji
    const emoji = new PIXI.Text(displayEmoji, { fontFamily: 'sans-serif', fontSize: 36 } as any)
    emoji.anchor.set(0.5); emoji.x = cx; emoji.y = cy
    popup.content.addChild(emoji)

    cy += 40
    const displayName = water ? water.waterName : pond.name
    const nameTxt = new PIXI.Text(displayName, { fontFamily: 'sans-serif', fontSize: 22, fontWeight: 'bold', fill: '#FFFFFF' } as any)
    nameTxt.anchor.set(0.5); nameTxt.x = cx; nameTxt.y = cy
    popup.content.addChild(nameTxt)

    cy += 24
    const subInfo = water ? `${water.emoji} ${water.province}` : ('"' + pond.slogan + '"')
    const subTxt = new PIXI.Text(subInfo, { fontFamily: 'sans-serif', fontSize: 12, fill: '#8BA0B0' } as any)
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

  /** Update water body name + rank + fish count on the wooden bulletin board */
  private _updateBoardInfo(waterId: string, rank: number, fishCount: number): void {
    if (!this._boardNameTxt) return
    const water = getWaterById(waterId)
    const displayName = water ? water.waterName : '未加入水域'
    const displayEmoji = water ? water.emoji : '🌏'
    const provinceInfo = water ? water.province : ''
    const text = provinceInfo ? `${displayEmoji} ${displayName}（${provinceInfo}）` : `${displayEmoji} ${displayName}`
    this._boardNameTxt.text = text
    if (this._boardNameShadowTxt) this._boardNameShadowTxt.text = text

    // Rank + fish count on one line
    const medals = ['🥇', '🥈', '🥉']
    const parts: string[] = []
    if (rank > 0) {
      parts.push(rank <= 3 ? `${medals[rank - 1]} 第${rank}名` : `No.${rank}`)
    }
    if (fishCount > 0) parts.push(`🐟${fishCount}条`)
    const line = parts.join(' · ')
    if (this._boardRankTxt) this._boardRankTxt.text = line
    if (this._boardRankHighlightTxt) this._boardRankHighlightTxt.text = line
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
