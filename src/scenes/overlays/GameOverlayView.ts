import * as PIXI from 'pixi.js-legacy'
import type { GameLogic } from '../../core/GameLogic'
import type { SkillConfig, GameResult, BoardCard, FuncCardConfig } from '../../core/types'
import { CardView } from '../../views/CardView'
import { getFishTex } from '../../views/FishView'
import { PopupView } from '../../views/PopupView'
import { getCachedPond, setCachedPond } from '../../config/ponds'
import { getCachedRanking, clearRankingCache, clearDetailCache } from '../../config/rankingCache'
import { AudioManager } from '../../utils/AudioManager'
import logger from '../../utils/Logger'
import type { EventBus } from '../../engine/EventBus'
import type { SceneManager } from '../../engine/SceneManager'

function hexToInt(hex: string): number {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result) {
    return (parseInt(result[1], 16) << 16) | (parseInt(result[2], 16) << 8) | parseInt(result[3], 16)
  }
  return 0x95A5A6
}

export interface OverlayHost {
  container: PIXI.Container
  screenW: number; screenH: number
  logic: GameLogic
  levelId: string
  cardViews: Map<string, CardView>
  bus: EventBus
  manager: SceneManager
  registerHitArea(rect: { x: number; y: number; w: number; h: number }, cb: () => void, layer: number): void
  renderHUD(): void
  renderSlotBar(): void
  onSkillSelected(skill: SkillConfig): void
  // Settings state
  _musicOn: boolean; _vibrateOn: boolean
  _saveSettings(): void
  // Skill panel state
  pendingSkills: SkillConfig[] | null
  skillOverlay: PIXI.Graphics | null
  skillPopupElements: PIXI.Container[]
  skillHitAreas: Array<{ rect: { x: number; y: number; w: number; h: number }; callback: () => void }>
  _dismissSkillPanel(): void
  // Result / pond picker state
  _resultArea: Array<{ rect: { x: number; y: number; w: number; h: number }; cb: () => void }>
  _pondPickerAreas: Array<{ rect: { x: number; y: number; w: number; h: number }; cb: () => void }>
  _celebrationAreas: Array<{ rect: { x: number; y: number; w: number; h: number }; cb: () => void }>
  _joiningPond: boolean
  // Settings overlay
  _settingsOverlay: PIXI.Container | null
  _settingsAreas: Array<{ rect: { x: number; y: number; w: number; h: number }; cb: () => void }>
  _closeSettingsPopup(): void
  // Effects
  _playFishSparkles(x: number, y: number): void
  _effects: Array<{
    particles: PIXI.Text[]
    elapsed: number
    duration: number
    origins: Array<{ x: number; y: number; angle: number }>
  }>
}

export class GameOverlayView {
  constructor(private host: OverlayHost) {}

  /** Difficulty notification slide-in for Level 2 */
  showDifficultyWarning(): void {
    const w = this.host.screenW
    const panelW = 240; const panelH = 100
    const px = (w - panelW) / 2; const py = 40

    const panel = new PIXI.Container()
    panel.x = w
    panel.y = py

    const bg = new PIXI.Graphics()
    bg.beginFill(0x1A2A3A, 0.88)
    bg.drawRoundedRect(0, 0, panelW, panelH, 16)
    bg.endFill()
    bg.lineStyle(1.5, 0xFFFFFF, 0.20)
    bg.drawRoundedRect(0.5, 0.5, panelW - 1, panelH - 1, 16)
    bg.beginFill(0xFFFFFF, 0.10)
    bg.drawRoundedRect(4, 2, panelW - 8, Math.floor(panelH * 0.35), 12)
    bg.endFill()
    panel.addChild(bg)

    const title = new PIXI.Text('⚠️ 难度飙升', {
      fontFamily: 'sans-serif', fontSize: 22, fontWeight: 'bold', fill: '#F39C12',
    } as any)
    title.anchor.set(0.5); title.x = panelW / 2; title.y = 36
    panel.addChild(title)

    const desc = new PIXI.Text('通关后可加入鱼塘', {
      fontFamily: 'sans-serif', fontSize: 14, fill: '#A0B8C8',
    } as any)
    desc.anchor.set(0.5); desc.x = panelW / 2; desc.y = 68
    panel.addChild(desc)

    this.host.container.addChild(panel)

    const startTime = Date.now()
    const slideInDur = 500; const holdDur = 2000; const slideOutDur = 500
    const totalDur = slideInDur + holdDur + slideOutDur

    const ticker = PIXI.Ticker.shared
    const tick = () => {
      const elapsed = Date.now() - startTime
      if (elapsed < slideInDur) {
        const t = 1 - Math.pow(1 - elapsed / slideInDur, 2)
        panel.x = px + (w - px) * (1 - t)
      } else if (elapsed < slideInDur + holdDur) {
        panel.x = px
      } else if (elapsed < totalDur) {
        const t = Math.pow((elapsed - slideInDur - holdDur) / slideOutDur, 2)
        panel.x = px - (px + panelW) * t
        panel.alpha = 1 - t
      } else {
        ticker.remove(tick)
        this.host.container.removeChild(panel)
        panel.destroy({ children: true })
      }
    }
    ticker.add(tick)
  }

  /** Func card reveal popup — shows card result, user taps "知道了" to dismiss */
  showFuncCardReveal(card: BoardCard, onDismiss: () => void): void {
    const w = this.host.screenW; const h = this.host.screenH
    const config = card.config as FuncCardConfig
    const ww = 260; const wh = 200
    const px = (w - ww) / 2; const py = (h - wh) / 2 - 30

    // Dim overlay
    const overlay = new PIXI.Graphics()
    overlay.beginFill(0x000000, 0.60); overlay.drawRect(0, 0, w, h); overlay.endFill()

    const panel = new PIXI.Container()
    panel.x = px; panel.y = py

    // Frosted glass card
    const bg = new PIXI.Graphics()
    bg.beginFill(0x1A2A3A, 0.92)
    bg.drawRoundedRect(0, 0, ww, wh, 16)
    bg.endFill()
    bg.lineStyle(1.5, 0xFFFFFF, 0.18)
    bg.drawRoundedRect(0.5, 0.5, ww - 1, wh - 1, 16)
    bg.beginFill(0xFFFFFF, 0.08)
    bg.drawRoundedRect(4, 2, ww - 8, Math.floor(wh * 0.3), 12)
    bg.endFill()
    panel.addChild(bg)

    // Type badge
    const typeLabel = config.type === 'negative' ? '⚠️ 减益' : config.type === 'positive' ? '✨ 增益' : '🌀 干扰'
    const typeColor = config.type === 'negative' ? '#E87461' : config.type === 'positive' ? '#2ECC71' : '#F0A860'
    const badgeTxt = new PIXI.Text(typeLabel, {
      fontFamily: 'sans-serif', fontSize: 11, fontWeight: 'bold', fill: typeColor,
    } as any)
    badgeTxt.anchor.set(0.5); badgeTxt.x = ww / 2; badgeTxt.y = 22
    panel.addChild(badgeTxt)

    // Big emoji
    const emojiTxt = new PIXI.Text(config.revealIcon, {
      fontFamily: 'sans-serif', fontSize: 48, align: 'center',
    } as any)
    emojiTxt.anchor.set(0.5); emojiTxt.x = ww / 2; emojiTxt.y = 72
    panel.addChild(emojiTxt)

    // Card name
    const nameTxt = new PIXI.Text(config.revealName, {
      fontFamily: 'sans-serif', fontSize: 20, fontWeight: 'bold', fill: '#FFFFFF',
    } as any)
    nameTxt.anchor.set(0.5); nameTxt.x = ww / 2; nameTxt.y = 112
    panel.addChild(nameTxt)

    // Effect description
    const descMap: Record<string, string> = {
      boss_patrol: '随机替换卡槽中的一张牌为鲨鱼',
      wild_card: '万能牌，可与任意2张牌消除',
      swap_board_cards: '随机调换棋盘上2张牌的位置',
    }
    const descTxt = new PIXI.Text(descMap[config.effect] || '未知效果', {
      fontFamily: 'sans-serif', fontSize: 13, fill: '#8BA0B0',
    } as any)
    descTxt.anchor.set(0.5); descTxt.x = ww / 2; descTxt.y = 140
    panel.addChild(descTxt)

    this.host.container.addChild(overlay)
    this.host.container.addChild(panel)

    // Auto-dismiss after 1.5s, or tap to dismiss
    const hostAny = this.host as any
    let dismissed = false
    const cleanup = () => {
      if (dismissed) return
      dismissed = true
      this.host.container.removeChild(overlay)
      this.host.container.removeChild(panel)
      overlay.destroy()
      panel.destroy({ children: true })
      // Clear host state
      hostAny._funcCardRevealOverlay = null
      hostAny._funcCardRevealPanel = null
      hostAny._funcCardRevealHitRect = null
      hostAny._funcCardRevealCallback = null
      hostAny._funcCardRevealFullScreen = false
      onDismiss()
    }

    hostAny._funcCardRevealOverlay = overlay
    hostAny._funcCardRevealPanel = panel
    hostAny._funcCardRevealCallback = cleanup
    hostAny._funcCardRevealHitRect = null
    hostAny._funcCardRevealFullScreen = true

    // Auto-dismiss timer
    const startTime = Date.now()
    const ticker = PIXI.Ticker.shared
    const tick = () => {
      if (dismissed) { ticker.remove(tick); return }
      if (Date.now() - startTime >= 1500) {
        ticker.remove(tick)
        cleanup()
      }
    }
    ticker.add(tick)
  }
  showSettingsPopup(): void {
    if (this.host._settingsOverlay) return
    const self = this
    const popup = new PopupView(this.host.screenW, this.host.screenH, 180, {
      title: '⚙️ 设置', width: 240, closable: true,
      onClose: () => { this.host._settingsOverlay = null; this.host._settingsAreas = [] }
    })
    this.host._settingsOverlay = popup.container
    this.host._settingsAreas = popup.hitAreas

    const cw = popup.cardW - 32

    const drawRow = (y: number, label: string, value: string, valueColor: string, onClick?: () => void) => {
      const rowH = 36
      const bg = new PIXI.Graphics()
      bg.beginFill(0xFFFFFF, 0.08)
      bg.drawRoundedRect(0, y, cw, rowH, 8)
      bg.endFill()
      popup.content.addChild(bg)

      const lt = new PIXI.Text(label, { fontFamily: 'sans-serif', fontSize: 15, fill: '#FFFFFF' } as any)
      lt.x = 12; lt.y = y + (rowH - 15) / 2
      popup.content.addChild(lt)

      const vt = new PIXI.Text(value, { fontFamily: 'sans-serif', fontSize: 13, fill: valueColor } as any)
      vt.anchor.set(1, 0); vt.x = cw - 12; vt.y = y + (rowH - 13) / 2
      popup.content.addChild(vt)

      if (onClick) popup.addHitArea(0, y, cw, rowH, onClick)
      return y + rowH + 4
    }

    let cy = 0
    cy = drawRow(cy, '🎵 音乐', this.host._musicOn ? '🟢 开' : '⚫ 关',
      this.host._musicOn ? '#2ECC71' : '#7F8C8D', () => {
        this.host._musicOn = !this.host._musicOn; this.host._saveSettings()
        if (this.host._musicOn) AudioManager.resume(); else AudioManager.pause()
        this.host._closeSettingsPopup(); this.showSettingsPopup()
      })
    cy = drawRow(cy, '📳 震动', this.host._vibrateOn ? '🟢 开' : '⚫ 关',
      this.host._vibrateOn ? '#2ECC71' : '#7F8C8D', () => {
        this.host._vibrateOn = !this.host._vibrateOn; this.host._saveSettings()
        this.host._closeSettingsPopup(); this.showSettingsPopup()
      })

    cy += 8
    const btnBg = new PIXI.Graphics()
    btnBg.beginFill(0xE74C3C, 0.75)
    btnBg.drawRoundedRect(0, cy, cw, 38, 8)
    btnBg.endFill()
    popup.content.addChild(btnBg)
    const btnTxt = new PIXI.Text('🚪 放弃挑战', { fontFamily: 'sans-serif', fontSize: 15, fontWeight: 'bold', fill: '#FFFFFF' } as any)
    btnTxt.anchor.set(0.5); btnTxt.x = cw / 2; btnTxt.y = cy + 19
    popup.content.addChild(btnTxt)
    popup.addHitArea(0, cy, cw, 38, () => {
      this.host._closeSettingsPopup()
      this.host.logic.skillSystem.destroy()
      const { MenuScene } = require('../MenuScene')
      this.host.manager.replace(new MenuScene())
    })

    this.host.container.addChild(popup.container)
  }

  /** Skill selection panel — frost glass with 2-col grid */
  showSkillSelection(skills: SkillConfig[]): void {
    this.host.pendingSkills = skills
    this.host.skillHitAreas = []

    const w = this.host.screenW; const h = this.host.screenH
    const overlay = new PIXI.Graphics()
    overlay.beginFill(0x000000, 0.65); overlay.drawRect(0, 0, w, h); overlay.endFill()
    this.host.container.addChild(overlay)
    this.host.skillOverlay = overlay

    const charges = this.host.logic.skillSystem.charges
    const canUse = charges > 0
    const titleText = canUse
      ? '🎯 选择技能 (' + skills.length + '个可用, 充能×' + charges + ')'
      : '🎯 技能列表 (消除3组获得充能)'
    const titleTxt = new PIXI.Text(titleText, {
      fontFamily: 'sans-serif', fontSize: 16, fontWeight: 'bold',
      fill: canUse ? '#F39C12' : '#7F8C8D', align: 'center',
    } as any)
    titleTxt.anchor.set(0.5); titleTxt.x = w / 2; titleTxt.y = h * 0.06
    this.host.container.addChild(titleTxt)
    this.host.skillPopupElements.push(titleTxt)

    const cols = 2
    const margin = 12
    const gap = 10
    const cardW = Math.floor((w - margin * 2 - gap) / cols)
    const cardH = 72
    const startY = h * 0.12
    const host = this.host

    for (let i = 0; i < skills.length; i++) {
      const skill = skills[i]
      const col = i % cols
      const row = Math.floor(i / cols)
      const cx = margin + col * (cardW + gap)
      const cy = startY + row * (cardH + gap)
      const isLegendary = skill.tag === '传说型'

      const sc = new PIXI.Container()

      const bg = new PIXI.Graphics()
      const alpha = canUse ? 0.95 : 0.55
      if (isLegendary) {
        bg.lineStyle(1.5, 0xF1C40F, canUse ? 0.8 : 0.3)
        bg.beginFill(0x2C1A0A, alpha)
      } else {
        bg.beginFill(0x5C4033, alpha)
      }
      bg.drawRoundedRect(cx, cy, cardW, cardH, 10)
      bg.endFill()
      if (!isLegendary) {
        bg.lineStyle(1, 0xA08060, 0.3)
        bg.drawRoundedRect(cx, cy, cardW, cardH, 10)
      }
      sc.addChild(bg)

      const iconTxt = new PIXI.Text(skill.icon, {
        fontFamily: 'sans-serif', fontSize: 26, align: 'center',
      } as any)
      iconTxt.anchor.set(0.5); iconTxt.x = cx + 30; iconTxt.y = cy + cardH / 2
      sc.addChild(iconTxt)

      const nameColor = isLegendary ? '#F1C40F' : '#FFFFFF'
      const nameTxt = new PIXI.Text(skill.name, {
        fontFamily: 'sans-serif', fontSize: 14, fontWeight: 'bold', fill: nameColor,
      } as any)
      nameTxt.x = cx + 52; nameTxt.y = cy + 12
      sc.addChild(nameTxt)

      const descTxt = new PIXI.Text(skill.desc, {
        fontFamily: 'sans-serif', fontSize: 10,
        fill: isLegendary ? '#E8C870' : '#9B8B7A',
        wordWrap: true, wordWrapWidth: cardW - 56, breakWords: true,
      } as any)
      descTxt.x = cx + 52; descTxt.y = cy + 32
      sc.addChild(descTxt)

      if (isLegendary) {
        const badgeTxt = new PIXI.Text('传说', {
          fontFamily: 'sans-serif', fontSize: 9, fontWeight: 'bold', fill: '#F1C40F',
        } as any)
        badgeTxt.anchor.set(1, 0); badgeTxt.x = cx + cardW - 6; badgeTxt.y = cy + 4
        sc.addChild(badgeTxt)
      }

      host.container.addChild(sc)
      host.skillPopupElements.push(sc)

      host.skillHitAreas.push({
        rect: { x: cx, y: cy, w: cardW, h: cardH },
        callback: () => {
          if (host.logic.skillSystem.charges > 0) {
            host.onSkillSelected(skill)
          }
        },
      })
    }

    const closeY = startY + Math.ceil(skills.length / cols) * (cardH + gap) + 12
    const closeBtnW = 120, closeBtnH = 36
    const closeBg = new PIXI.Graphics()
    closeBg.beginFill(0x8B7355, 0.7)
    closeBg.drawRoundedRect((w - closeBtnW) / 2, closeY, closeBtnW, closeBtnH, 8)
    closeBg.endFill()
    host.container.addChild(closeBg)
    host.skillPopupElements.push(closeBg)

    const closeTxt = new PIXI.Text('关闭', {
      fontFamily: 'sans-serif', fontSize: 14, fill: '#FFFFFF',
    } as any)
    closeTxt.anchor.set(0.5); closeTxt.x = w / 2; closeTxt.y = closeY + closeBtnH / 2
    host.container.addChild(closeTxt)
    host.skillPopupElements.push(closeTxt)

    host.skillHitAreas.push({
      rect: { x: (w - closeBtnW) / 2, y: closeY, w: closeBtnW, h: closeBtnH },
      callback: () => host._dismissSkillPanel(),
    })
  }

  /** S8 card-type selection grid (3 cols) */
  showCardTypeSelection(cardTypes: string[]): void {
    this.host.skillHitAreas = []
    this.host.pendingSkills = null

    const w = this.host.screenW; const h = this.host.screenH
    const overlay = new PIXI.Graphics()
    overlay.beginFill(0x000000, 0.65); overlay.drawRect(0, 0, w, h); overlay.endFill()
    this.host.container.addChild(overlay)
    this.host.skillOverlay = overlay

    const titleTxt = new PIXI.Text('🪝 选择要消除的鱼类', {
      fontFamily: 'sans-serif', fontSize: 18, fontWeight: 'bold',
      fill: '#7FB3D8', align: 'center',
    } as any)
    titleTxt.anchor.set(0.5); titleTxt.x = w / 2; titleTxt.y = h * 0.18
    this.host.container.addChild(titleTxt)
    this.host.skillPopupElements.push(titleTxt)

    const cols = 3, btnW = 88, btnH = 82, gap = 12
    const totalW = cols * btnW + (cols - 1) * gap
    const startX = (w - totalW) / 2
    const startY = h * 0.26
    const host = this.host

    for (let i = 0; i < cardTypes.length; i++) {
      const cardId = cardTypes[i]
      const col = i % cols; const row = Math.floor(i / cols)
      const bx = startX + col * (btnW + gap)
      const by = startY + row * (btnH + gap)

      const bg = new PIXI.Graphics()
      bg.beginFill(0x1A2A3A, 0.85)
      bg.drawRoundedRect(bx, by, btnW, btnH, 10)
      bg.endFill()
      bg.lineStyle(1.5, 0xFFFFFF, 0.15)
      bg.drawRoundedRect(bx + 0.5, by + 0.5, btnW - 1, btnH - 1, 10)
      host.container.addChild(bg)
      host.skillPopupElements.push(bg)

      const { NORMAL_CARDS } = require('../../config/cards')
      const cardCfg = NORMAL_CARDS.find((c: any) => c.id === cardId)
      const icon = cardCfg ? cardCfg.icon : '🐟'
      const name = cardCfg ? cardCfg.name : cardId

      const fishTex = getFishTex(cardId, 0)
      if (fishTex) {
        const fishSprite = new PIXI.Sprite(fishTex)
        fishSprite.anchor.set(0.5)
        fishSprite.width = 42; fishSprite.height = 42
        fishSprite.x = bx + btnW / 2; fishSprite.y = by + btnH * 0.44
        host.container.addChild(fishSprite)
        host.skillPopupElements.push(fishSprite as any)
      } else {
        const iconTxt = new PIXI.Text(icon, {
          fontFamily: 'sans-serif', fontSize: 28, align: 'center',
        } as any)
        iconTxt.anchor.set(0.5); iconTxt.x = bx + btnW / 2; iconTxt.y = by + btnH * 0.44
        host.container.addChild(iconTxt)
        host.skillPopupElements.push(iconTxt)
      }

      const nameTxt = new PIXI.Text(name, {
        fontFamily: 'sans-serif', fontSize: 10, fill: '#8BA0B0', align: 'center',
      } as any)
      nameTxt.anchor.set(0.5); nameTxt.x = bx + btnW / 2; nameTxt.y = by + btnH * 0.82
      host.container.addChild(nameTxt)
      host.skillPopupElements.push(nameTxt)

      host.skillHitAreas.push({
        rect: { x: bx, y: by, w: btnW, h: btnH },
        callback: () => {
          if (host.skillOverlay) { host.container.removeChild(host.skillOverlay); host.skillOverlay = null }
          for (const el of host.skillPopupElements) { host.container.removeChild(el) }
          host.skillPopupElements = []
          host.skillHitAreas = []

          const ctx = host.logic.getSkillContext()
          ctx.selectAndClearTarget = cardId
          host.renderHUD()
        },
      })
    }
  }

  /** Show fish result — big sprite, name, tap to continue */
  showFishResult(fishId: string, fishInfo: { name: string; emoji: string }): void {
    const w = this.host.screenW; const h = this.host.screenH

    const overlay = new PIXI.Graphics()
    overlay.beginFill(0x0A1628, 0.94); overlay.drawRect(0, 0, w, h); overlay.endFill()
    this.host.container.addChild(overlay)

    const congrats = new PIXI.Text('🎉 恭喜通关！', {
      fontFamily: 'sans-serif', fontSize: 28, fontWeight: 'bold', fill: '#F1C40F',
    } as any)
    congrats.anchor.set(0.5); congrats.x = w / 2; congrats.y = h * 0.10
    this.host.container.addChild(congrats)

    const fishSize = 140
    const tex = getFishTex(fishId, 0)
    const fishCtn = new PIXI.Container()
    fishCtn.x = w / 2; fishCtn.y = h * 0.32
    if (tex) {
      const sprite = new PIXI.Sprite(tex)
      sprite.anchor.set(0.5)
      sprite.height = fishSize
      sprite.width = tex.width * (fishSize / tex.height)
      fishCtn.addChild(sprite)
    } else {
      const fallback = new PIXI.Text(fishInfo.emoji, { fontFamily: 'sans-serif', fontSize: 80 } as any)
      fallback.anchor.set(0.5)
      fishCtn.addChild(fallback)
    }
    this.host.container.addChild(fishCtn)

    const fishNameTxt = new PIXI.Text(`你摸到了一条 ${fishInfo.name}！`, {
      fontFamily: 'sans-serif', fontSize: 22, fontWeight: 'bold', fill: '#FFFFFF',
    } as any)
    fishNameTxt.anchor.set(0.5); fishNameTxt.x = w / 2; fishNameTxt.y = h * 0.52
    this.host.container.addChild(fishNameTxt)

    const hint = new PIXI.Text('👆 点击任意位置选择鱼塘', {
      fontFamily: 'sans-serif', fontSize: 14, fill: '#6B7B8D',
    } as any)
    hint.anchor.set(0.5); hint.x = w / 2; hint.y = h * 0.62
    this.host.container.addChild(hint)

    this.host._playFishSparkles(w / 2, h * 0.32)

    const self = this
    this.host._resultArea = [{
      rect: { x: 0, y: 0, w, h },
      cb: () => {
        this.host._resultArea = []
        self.showPondPicker(fishId, fishInfo)
      }
    }]
  }

  /** Pond picker — choose which pond to join, ranked by real cloud data */
  showPondPicker(fishId: string, fishInfo: { name: string; emoji: string }): void {
    const w = this.host.screenW; const h = this.host.screenH

    const cardX = 12; const cardY = Math.floor(h * 0.06); const cardW = w - 24; const cardH = Math.floor(h * 0.88)
    const card = new PIXI.Graphics()
    card.beginFill(0x0D1B2A, 0.88)
    card.drawRoundedRect(cardX, cardY, cardW, cardH, 16)
    card.endFill()
    card.lineStyle(1.5, 0xFFFFFF, 0.15)
    card.drawRoundedRect(cardX + 0.5, cardY + 0.5, cardW - 1, cardH - 1, 16)
    this.host.container.addChild(card)

    const cx = w / 2

    const fishTex = getFishTex(fishId, 0)
    if (fishTex) {
      const fishSprite = new PIXI.Sprite(fishTex)
      fishSprite.anchor.set(0.5)
      fishSprite.width = 44; fishSprite.height = 44
      fishSprite.x = cx; fishSprite.y = cardY + 36
      this.host.container.addChild(fishSprite)
    } else {
      const fallback = new PIXI.Text(fishInfo.emoji, { fontFamily: 'sans-serif', fontSize: 36 } as any)
      fallback.anchor.set(0.5); fallback.x = cx; fallback.y = cardY + 36
      this.host.container.addChild(fallback)
    }

    const fishNameTxt = new PIXI.Text(`你摸到了 ${fishInfo.name}！`, {
      fontFamily: 'sans-serif', fontSize: 16, fontWeight: 'bold', fill: '#F1C40F',
    } as any)
    fishNameTxt.anchor.set(0.5); fishNameTxt.x = cx; fishNameTxt.y = cardY + 72
    this.host.container.addChild(fishNameTxt)

    const title = new PIXI.Text('选择鱼塘加入', {
      fontFamily: 'sans-serif', fontSize: 13, fill: '#6B7B8D',
    } as any)
    title.anchor.set(0.5); title.x = cx; title.y = cardY + 96
    this.host.container.addChild(title)

    const host = this.host
    const listY = cardY + 116; const listH = cardY + cardH - listY - 12
    this.host._joiningPond = false

    const pondNames: Record<string, string> = {
      moyutang:'摸鱼塘', xianyutang:'咸鱼塘', jinlitang:'锦鲤塘', hetuntang:'河豚塘',
      moyutang2:'墨鱼塘', haimatang:'海马塘', feiyutang:'飞鱼塘', zhangyutang:'章鱼塘',
      bimuyutang:'比目鱼塘', pangxietang:'螃蟹塘', jianyutang:'剑鱼塘', haituntang:'海豚塘'
    }
    const allIds = Object.keys(pondNames)
    const medals = ['🥇','🥈','🥉']

    ;(async () => {
      let ranked: Array<{ pondId: string; rank: number; dailyClears: number }> = []
      try {
        let d = getCachedRanking()
        if (!d) {
          const res = await wx.cloud.callFunction({ name: 'getPondRanking', data: {} })
          d = (res as any).result
        }
        if (d?.ok && d.fatPondRank) {
          ranked = d.fatPondRank.map((r: any) => ({ pondId: r.pondId, rank: r.rank, dailyClears: r.dailyClears }))
          for (const id of allIds) {
            if (!ranked.find(r => r.pondId === id)) ranked.push({ pondId: id, rank: ranked.length + 1, dailyClears: 0 })
          }
        }
      } catch {}
      if (ranked.length === 0) {
        ranked = allIds.map((id, i) => ({ pondId: id, rank: i + 1, dailyClears: 0 }))
      }

      const rowH = 36; const gap = 4
      for (let i = 0; i < ranked.length; i++) {
        const r = ranked[i]
        const ry = listY + i * (rowH + gap)
        if (ry + rowH > listY + listH) break
        const pondName = pondNames[r.pondId] || r.pondId

        const rowBg = new PIXI.Graphics()
        const isTop3 = r.rank <= 3
        rowBg.beginFill(isTop3 ? 0x1A2A3A : 0x152535, isTop3 ? 0.85 : 0.65)
        rowBg.drawRoundedRect(cardX + 8, ry, cardW - 16, rowH, 8)
        rowBg.endFill()
        if (isTop3) {
          rowBg.lineStyle(1, 0xF1C40F, 0.35)
          rowBg.drawRoundedRect(cardX + 8.5, ry + 0.5, cardW - 17, rowH - 1, 8)
        }
        host.container.addChild(rowBg)

        const rankStr = r.rank <= 3 ? medals[r.rank - 1] : `${r.rank}`
        const rankTxt = new PIXI.Text(rankStr, {
          fontFamily: 'sans-serif', fontSize: r.rank <= 3 ? 18 : 12, fontWeight: 'bold',
          fill: r.rank <= 3 ? '#F1C40F' : '#7F8C8D',
        } as any)
        rankTxt.anchor.set(0.5); rankTxt.x = cardX + 28; rankTxt.y = ry + rowH / 2
        host.container.addChild(rankTxt)

        const nameTxt = new PIXI.Text(pondName, {
          fontFamily: 'sans-serif', fontSize: 14, fontWeight: 'bold',
          fill: isTop3 ? '#FFFFFF' : '#A0B0C0',
        } as any)
        nameTxt.x = cardX + 50; nameTxt.y = ry + 4
        host.container.addChild(nameTxt)

        const countTxt = new PIXI.Text(`🐟${r.dailyClears}`, {
          fontFamily: 'sans-serif', fontSize: 11, fill: '#7FB3D8',
        } as any)
        countTxt.x = cardX + 50; countTxt.y = ry + rowH - 16
        host.container.addChild(countTxt)

        host._pondPickerAreas.push({
          rect: { x: cardX + 8, y: ry, w: cardW - 16, h: rowH },
          cb: () => {
            if (host._joiningPond) return
            host._joiningPond = true
            setCachedPond({ pondId: r.pondId, fishId, joinDate: new Date().toISOString(), todayContribution: 0, switchCount: 0 })
            this._joinPondAsync(fishId, fishInfo, r.pondId, pondName)
            host._pondPickerAreas = []
            const { MenuScene } = require('../MenuScene')
            host.manager.replace(new MenuScene())
          }
        })
      }
    })()
  }

  /** Fire-and-forget: collect avatar, call cloud, emit result */
  private _joinPondAsync(fishId: string, fishInfo: { name: string; emoji: string }, pondId: string, pondName: string): void {
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
          data: { fishId, pondId, avatarUrl, nickName, checkAchievements: true }
        })
        const r = (conRes as any).result
        if (r?.ok) {
          clearRankingCache()
          clearDetailCache()
          bus.emit('pondJoined', { ok: true, pondName, fishName: fishInfo.name, fishEmoji: fishInfo.emoji })
          if (r.newAchievements?.length > 0) {
            for (const ach of r.newAchievements) {
              wx.showToast({ title: `${ach.emoji} 获得称号：${ach.name}！`, icon: 'none', duration: 3000 })
            }
          }
        } else {
          bus.emit('pondJoined', { ok: false, reason: r?.reason || 'unknown' })
        }
      } catch (e: any) {
        logger.warn('GameOverlayView', 'joinPondAsync failed ' + (e?.errMsg || String(e)))
        bus.emit('pondJoined', { ok: false, reason: e?.errMsg || 'network_error' })
      }
    })()
  }
}
