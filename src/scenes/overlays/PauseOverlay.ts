import * as PIXI from 'pixi.js-legacy'
import { Scene } from '../../engine/Scene'
import { Button } from '../../views/Button'

export class PauseOverlay extends Scene {
  onEnter(): void {
    const sysInfo = wx.getSystemInfoSync()
    const w = sysInfo.windowWidth
    const h = sysInfo.windowHeight

    const mask = new PIXI.Graphics()
    mask.beginFill(0x000000, 0.6)
    mask.drawRect(0, 0, w, h)
    mask.endFill()
    this.container.addChild(mask)

    const txt = new PIXI.Text('已暂停', {
      fontFamily: 'sans-serif', fontSize: 48, fill: '#FFFFFF', fontWeight: 'bold', align: 'center',
    } as any)
    txt.anchor.set(0.5)
    txt.x = w / 2
    txt.y = h * 0.38
    this.container.addChild(txt)

    const btnW = 260, btnH = 70
    const resumeBtn = new Button(
      Math.floor((w - btnW) / 2), Math.floor(h * 0.5), btnW, btnH,
      '继续游戏',
      { bgColor: '#27AE60', fontSize: 22, radius: 8, shadow: true }
    )
    this.container.addChild(resumeBtn.container)
    this.registerHitArea(resumeBtn.hitArea, () => {
      this.manager.pop()
    }, 20)
  }
}
