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

    // Dim backdrop
    const dim = new PIXI.Graphics()
    dim.beginFill(0x000000, 0.35); dim.drawRect(0, 0, w, h); dim.endFill()
    this.container.addChild(dim)

    if (!pond) return

    // Frosted glass card
    const cardW = w - 32; const cardH = h * 0.60
    const cardX = 16; const cardY = Math.floor(h * 0.08)
    const card = new PIXI.Graphics()
    // Frosted base
    card.beginFill(0x1A2A3A, 0.72)
    card.drawRoundedRect(cardX, cardY, cardW, cardH, 16)
    card.endFill()
    // Glass border
    card.lineStyle(1.5, 0xFFFFFF, 0.18)
    card.drawRoundedRect(cardX + 0.5, cardY + 0.5, cardW - 1, cardH - 1, 16)
    this.container.addChild(card)

    const cx = w / 2  // center x of card
    let cy = cardY + 36

    const emoji = new PIXI.Text(pond.emoji, { fontFamily: 'sans-serif', fontSize: 40, align: 'center' } as any)
    emoji.anchor.set(0.5); emoji.x = cx; emoji.y = cy
    this.container.addChild(emoji)

    cy += 48
    const name = new PIXI.Text(pond.name, { fontFamily: 'sans-serif', fontSize: 24, fontWeight: 'bold', fill: '#FFFFFF' } as any)
    name.anchor.set(0.5); name.x = cx; name.y = cy
    this.container.addChild(name)

    cy += 28
    const slogan = new PIXI.Text(`"${pond.slogan}"`, { fontFamily: 'sans-serif', fontSize: 13, fill: '#8BA0B0' } as any)
    slogan.anchor.set(0.5); slogan.x = cx; slogan.y = cy
    this.container.addChild(slogan)

    // Close button — frosted style
    cy += 38
    const closeBg = new PIXI.Graphics()
    closeBg.beginFill(0xFFFFFF, 0.12)
    closeBg.drawRoundedRect(cx - 60, cy, 120, 34, 8)
    closeBg.endFill()
    closeBg.lineStyle(1, 0xFFFFFF, 0.25)
    closeBg.drawRoundedRect(cx - 59.5, cy + 0.5, 119, 33, 8)
    this.container.addChild(closeBg)
    const closeTxt = new PIXI.Text('关闭', { fontFamily: 'sans-serif', fontSize: 14, fill: '#FFFFFF' } as any)
    closeTxt.anchor.set(0.5); closeTxt.x = cx; closeTxt.y = cy + 17
    this.container.addChild(closeTxt)
    this._hitAreas.push({ rect: { x: cx - 60, y: cy, w: 120, h: 34 }, cb: () => this.manager.pop() })

    // Fetch and show detail data
    this._loadDetail(w, cy + 46)
  }

  private async _loadDetail(w: number, y: number): Promise<void> {
    try {
      const res = await wx.cloud.callFunction({ name: 'getPondDetail', data: { pondId: this._pondId } })
      const d = (res as any).result
      if (!d?.ok) return

      const cx = w / 2
      const lines = [
        `🏆 今日排行：第 ${d.rank} 名`,
        `🐟 今日鱼数：${d.dailyClears || 0}`,
        `👥 活跃人数：${d.activeMembers || 0}`,
        `📊 人均：${d.perCapita || 0} 条/人`
      ]
      // Divider line
      const divider = new PIXI.Graphics()
      divider.lineStyle(1, 0xFFFFFF, 0.12)
      divider.moveTo(cx - 100, y); divider.lineTo(cx + 100, y)
      this.container.addChild(divider)

      for (let i = 0; i < lines.length; i++) {
        const t = new PIXI.Text(lines[i], { fontFamily: 'sans-serif', fontSize: 13, fill: '#A8B8C8' } as any)
        t.anchor.set(0.5); t.x = cx; t.y = y + 12 + i * 26
        this.container.addChild(t)
      }
      let nextY = y + 12 + lines.length * 26 + 12

      if (d.heroes?.length) {
        const div2 = new PIXI.Graphics()
        div2.lineStyle(1, 0xFFFFFF, 0.10)
        div2.moveTo(cx - 80, nextY); div2.lineTo(cx + 80, nextY)
        this.container.addChild(div2)
        nextY += 14

        const heroTitle = new PIXI.Text('🏅 鱼塘英雄榜', { fontFamily: 'sans-serif', fontSize: 14, fontWeight: 'bold', fill: '#E8B45A' } as any)
        heroTitle.anchor.set(0.5); heroTitle.x = cx; heroTitle.y = nextY
        this.container.addChild(heroTitle)
        nextY += 24

        for (let i = 0; i < Math.min(d.heroes.length, 10); i++) {
          const h = d.heroes[i]
          const ht = new PIXI.Text(`${i + 1}. 🐟 通关 ${h.todayClears || 0} 次`, { fontFamily: 'sans-serif', fontSize: 12, fill: '#8BA0B0' } as any)
          ht.anchor.set(0.5); ht.x = cx; ht.y = nextY + i * 20
          this.container.addChild(ht)
        }
      }
    } catch {}
  }

  onUpdate(_dt: number): void {
    for (const item of this._hitAreas) this.registerHitArea(item.rect, item.cb, 15)
  }
}
