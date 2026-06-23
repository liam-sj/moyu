import * as PIXI from 'pixi.js-legacy'
import { Scene } from '../engine/Scene'
import { PONDS, PondConfig, setCachedPond } from '../config/ponds'
import { clearRankingCache, clearDetailCache } from '../config/rankingCache'

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
    // 关键节点1: 获取用户头像昵称
    console.log('[SelectFish] 开始选鱼流程, pondId=', pond.id)
    let avatarUrl = ''
    let infoRes: any = null
    try {
      infoRes = await new Promise((resolve) => {
        wx.getUserInfo({ success: (r: any) => resolve(r), fail: () => resolve(null) })
      })
      if (infoRes?.userInfo) {
        avatarUrl = infoRes.userInfo.avatarUrl || ''
        console.log('[SelectFish] 获取头像成功 avatarUrl=', avatarUrl)
      } else {
        console.log('[SelectFish] 获取头像失败，使用空值')
      }
    } catch (e) { console.log('[SelectFish] 获取头像异常', e) }

    try {
      const res = await wx.cloud.callFunction({
        name: 'selectAndContribute',
        data: { fishId: pond.fishId, pondId: pond.id, avatarUrl, nickName: infoRes?.userInfo?.nickName || '', fishSelectionShown: true }
      })
      const data = (res as any).result
      console.log('[SelectFish] 云函数返回', JSON.stringify(data))
      if (data.ok) {
        setCachedPond({ pondId: pond.id, fishId: pond.fishId, joinDate: new Date().toISOString(), todayContribution: 0, switchCount: 0 })
        clearRankingCache(); clearDetailCache()
        // Return to menu — data is now ready
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
