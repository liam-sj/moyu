import * as PIXI from 'pixi.js-legacy'
import { Scene } from '../engine/Scene'
import { getPondById } from '../config/ponds'

export class PondDetailScene extends Scene {
  private _pondId: string
  private _hitAreas: Array<{ rect: { x: number; y: number; w: number; h: number }; cb: () => void }> = []

  constructor(pondId: string) { super(); this._pondId = pondId }

  onEnter(): void {
    const sysInfo = wx.getSystemInfoSync()
    const w = sysInfo.windowWidth; const h = sysInfo.windowHeight
    const pond = getPondById(this._pondId)

    const bg = new PIXI.Graphics()
    bg.beginFill(0x1A252F, 0.95); bg.drawRect(0, 0, w, h); bg.endFill()
    this.container.addChild(bg)

    if (!pond) return

    const emoji = new PIXI.Text(pond.emoji, { fontFamily: 'sans-serif', fontSize: 48, align: 'center' } as any)
    emoji.anchor.set(0.5); emoji.x = w / 2; emoji.y = h * 0.12
    this.container.addChild(emoji)

    const name = new PIXI.Text(pond.name, { fontFamily: 'sans-serif', fontSize: 28, fontWeight: 'bold', fill: '#FFFFFF' } as any)
    name.anchor.set(0.5); name.x = w / 2; name.y = h * 0.22
    this.container.addChild(name)

    const slogan = new PIXI.Text(`"${pond.slogan}"`, { fontFamily: 'sans-serif', fontSize: 14, fill: '#BDC3C7' } as any)
    slogan.anchor.set(0.5); slogan.x = w / 2; slogan.y = h * 0.28
    this.container.addChild(slogan)

    // Close button
    const closeBg = new PIXI.Graphics()
    closeBg.beginFill(0x7F8C8D, 0.7)
    closeBg.drawRoundedRect((w - 120) / 2, h * 0.35, 120, 36, 8)
    closeBg.endFill()
    this.container.addChild(closeBg)
    const closeTxt = new PIXI.Text('关闭', { fontFamily: 'sans-serif', fontSize: 14, fill: '#FFFFFF' } as any)
    closeTxt.anchor.set(0.5); closeTxt.x = w / 2; closeTxt.y = h * 0.35 + 18
    this.container.addChild(closeTxt)
    this._hitAreas.push({ rect: { x: (w - 120) / 2, y: h * 0.35, w: 120, h: 36 }, cb: () => this.manager.pop() })

    // Fetch and show detail data
    this._loadDetail(w, h * 0.42)
  }

  private async _loadDetail(w: number, y: number): Promise<void> {
    try {
      const res = await wx.cloud.callFunction({ name: 'getPondDetail', data: { pondId: this._pondId } })
      const d = (res as any).result
      if (!d?.ok) return

      const lines = [
        `🏆 今日排行：第 ${d.rank} 名`,
        `🐟 今日鱼数：${d.dailyClears || 0}`,
        `👥 活跃人数：${d.activeMembers || 0}`,
        `📊 人均：${d.perCapita || 0} 条/人`
      ]
      for (let i = 0; i < lines.length; i++) {
        const t = new PIXI.Text(lines[i], { fontFamily: 'sans-serif', fontSize: 14, fill: '#BDC3C7' } as any)
        t.anchor.set(0.5); t.x = w / 2; t.y = y + i * 28
        this.container.addChild(t)
      }

      if (d.heroes?.length) {
        const heroTitle = new PIXI.Text('🏅 鱼塘英雄榜', { fontFamily: 'sans-serif', fontSize: 16, fontWeight: 'bold', fill: '#F39C12' } as any)
        heroTitle.anchor.set(0.5); heroTitle.x = w / 2; heroTitle.y = y + lines.length * 28 + 16
        this.container.addChild(heroTitle)
        for (let i = 0; i < Math.min(d.heroes.length, 10); i++) {
          const h = d.heroes[i]
          const ht = new PIXI.Text(`${i + 1}. 🐟 通关 ${h.todayClears || 0} 次`, { fontFamily: 'sans-serif', fontSize: 12, fill: '#95A5A6' } as any)
          ht.anchor.set(0.5); ht.x = w / 2; ht.y = y + lines.length * 28 + 40 + i * 22
          this.container.addChild(ht)
        }
      }
    } catch {}
  }

  onUpdate(_dt: number): void {
    for (const item of this._hitAreas) this.registerHitArea(item.rect, item.cb, 15)
  }
}
