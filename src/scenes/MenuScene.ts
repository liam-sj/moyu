import * as PIXI from 'pixi.js-legacy'
import { Scene } from '../engine/Scene'
import { Button } from '../views/Button'
import { getCachedPond, getPondById, PONDS } from '../config/ponds'
import { PondView } from '../views/PondView'
import { generatePoster } from '../utils/SharePoster'

export class MenuScene extends Scene {
  private _startHitArea: { x: number; y: number; w: number; h: number } | null = null
  private _startCallback: (() => void) | null = null
  private _shareHitArea: { x: number; y: number; w: number; h: number } | null = null
  private _shareCallback: (() => void) | null = null
  private _pondHitAreas: Array<{ rect: { x: number; y: number; w: number; h: number }; cb: () => void }> = []
  private _pondViews: PondView[] = []
  private _myCloudData: any = null
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

  onEnter(_params?: unknown): void {
    const sysInfo = wx.getSystemInfoSync()
    const w = sysInfo.windowWidth
    const h = sysInfo.windowHeight

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
    homeImg.src = 'assets/home.png'

    const barY = 4
    // Single pond — will be created after cloud data loads
    this._loadRealCounts(w, barY)

    // Auth: cloud-stored avatar takes priority, fallback to local storage
    this._setupAuth(w, h)

    // Button
    const btnW = 200; const btnH = 44
    const btn = new Button(Math.floor((w - btnW) / 2), Math.floor(h * 0.41), btnW, btnH, '加入鱼塘', {
      bgColor: '#E67E22', textColor: '#FFFFFF', fontSize: 20, radius: 8, shadow: true,
    })
    this.container.addChild(btn.container)
    this._startHitArea = btn.hitArea
    this._startCallback = () => {
      const c = getCachedPond()
      if (!c) {
        // Check cloud data for fish selection eligibility
        if (this._myCloudData?.clearedLevel2 && !this._myCloudData?.fishSelectionShown) {
          const { SelectFishScene } = require('./SelectFishScene')
          this.manager.replace(new SelectFishScene())
          return
        }
      }
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
      console.log('[MenuScene] UserInfoButton tapped', JSON.stringify(res))
      if (res.errMsg === 'getUserInfo:ok' && res.userInfo) {
        const avatarUrl = res.userInfo.avatarUrl || ''
        const nickName = res.userInfo.nickName || ''
        // 销毁授权按钮
        if (self._authBtn) { self._authBtn.destroy(); self._authBtn = null }
        // Upload avatar to cloud + apply to pond
        self._applyAvatar(avatarUrl)
        console.log('[MenuScene] 授权成功 avatarUrl=', avatarUrl, 'nickName=', nickName)
      } else {
        console.log('[MenuScene] 授权失败或取消', res.errMsg)
      }
    })
  }

  /** 将头像URL上传到云端 + 应用到鱼塘视图 */
  private _applyAvatar(avatarUrl: string): void {
    if (!avatarUrl) return
    const cachedPond = getCachedPond()
    const pondId = cachedPond?.pondId

    // 1. 上传头像到云数据库 player_ponds
    if (pondId) {
      wx.cloud.callFunction({
        name: 'updateAvatar',
        data: { avatarUrl }
      }).then((res: any) => {
        console.log('[MenuScene] updateAvatar返回', JSON.stringify((res as any).result))
      }).catch((e: any) => console.log('[MenuScene] updateAvatar失败', e))
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
    try {
      const res = await wx.cloud.callFunction({ name: 'getPondRanking', data: {} })
      data = (res as any).result
      console.log('[MenuScene] getPondRanking返回', JSON.stringify({ ok: data?.ok, myPond: data?.myPond?.pondId }))
      if (data.myPond) {
        this._myCloudData = data.myPond
        if (data.myPond.avatarUrl) this._applyAvatar(data.myPond.avatarUrl)
      }
    } catch (e) { console.log('[MenuScene] getPondRanking failed', e) }

    // Determine which pond to show: user's pond or #1 ranked
    let targetPondId = data?.myPond?.pondId
    if (!targetPondId && data?.fatPondRank?.length > 0) {
      targetPondId = data.fatPondRank[0].pondId
    }
    if (!targetPondId) targetPondId = PONDS[0].id

    const pondCfg = getPondById(targetPondId) || PONDS[0]
    const pondW = w  // full width
    const pondH = (typeof wx !== 'undefined' ? wx.getSystemInfoSync().windowHeight : 667) - barY - 80
    const px = (w - pondW) / 2  // = 0
    const py = (typeof wx !== 'undefined' ? wx.getSystemInfoSync().windowHeight : 667) - pondH - 60  // bottom aligned

    const pv = new PondView(pondCfg, 0, px, py, pondW, pondH)
    this.container.addChild(pv.container)
    this._pondViews = [pv]
    this._pondHitAreas.push({
      rect: { x: px, y: py, w: pondW, h: 22 },
      cb: () => { const { PondDetailScene } = require('./PondDetailScene'); this.manager.push(new PondDetailScene(targetPondId)) }
    })

    // Spawn fish if data available
    if (data?.ok && data.fatPondRank) {
      const info = data.fatPondRank.find((d: any) => d.pondId === targetPondId)
      const count = info ? Math.min(info.dailyClears, 30) : 0
      const contribs = (data.contributors && data.contributors[targetPondId]?.length) ? data.contributors[targetPondId] : undefined
      if (count > 0) pv.spawnFish(count, contribs)
      pv.setBadge(info ? `${info.dailyClears}条` : '0条')
      if (info) { const rank = info.rank || (data.fatPondRank.indexOf(info) + 1); pv.updateRank?.(rank) }
    }
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
    for (const item of this._pondHitAreas) this.registerHitArea(item.rect, item.cb, 10)
    for (const pv of this._pondViews) {
      pv.updateFish(dt)
      if (!pv.container || !pv.container.parent) continue
      const gp = (pv.container as any).getGlobalPosition()
      const pw = (typeof wx !== 'undefined' ? wx.getSystemInfoSync().windowWidth : 375) - 60
      this.registerHitArea({ x: gp.x + 8, y: gp.y + 22, w: pw - 16, h: 210 - 26 }, () => {
        pv.dashNear(this._lastTouchX - gp.x, this._lastTouchY - gp.y, 60)
      }, 16)
      for (const item of pv.getFishHitAreas(gp.x, gp.y)) this.registerHitArea(item.rect, item.cb, 20)
    }
  }
}
