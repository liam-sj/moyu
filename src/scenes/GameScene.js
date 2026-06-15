// src/scenes/GameScene.js

import Scene from '../core/Scene';
import Board from '../game/Board';
import SlotBar from '../game/SlotBar';
import StepManager from '../game/StepManager';
import SkillSystem from '../game/SkillSystem';
import { log } from '../utils/Logger';

var TAG = 'GameScene';

export default class GameScene extends Scene {
  onEnter(params) {
    this.params = params;
    this.levelId = params.levelId || 'level1';
    this.onBackToMenu = params.onBackToMenu;
    this.onGameOver = params.onGameOver;

    this.container = new PIXI.Container();
    this.stage.addChild(this.container);

    this.board = new Board(this.container);
    this.slotBar = new SlotBar(this.container, this);
    this.stepManager = new StepManager(this);
    this.skillSystem = new SkillSystem(this);

    this.happyValue = 0;
    this.eliminateGroupCount = 0;
    this.pendingSkills = null;
    this.skillButtons = [];
    this.consecutiveNegative = 0;
    this._happyMultiplier = null;
    this._happyMultiplierSteps = 0;

    var screenW = this.stage.width;
    var screenH = this.stage.height;
    this.board.calcLayout(screenW, screenH, 5, 5);
    this.slotBar.calcLayout(screenW, screenH);

    this._initGame();
    log(TAG, 'GameScene entered, level=' + this.levelId);
  }

  _initGame() {
    this.happyValue = 0;
    this.eliminateGroupCount = 0;
    this.board.generate(this.levelId);
    this.slotBar.renderEmpty();
    this.stepManager.init(this.board.levelConfig);
    this.skillSystem.init();
    this._renderHUD();
    this._bindCardClicks();
  }

  _bindCardClicks() {
    var clickable = this.board.getClickableCards();
    var self = this;
    for (var i = 0; i < clickable.length; i++) {
      (function (card) {
        if (!card.container) return;
        card.container.interactive = true;
        card.container.buttonMode = true;
        card.container.off('pointertap');
        card.container.on('pointertap', function () { self._onCardClicked(card); });
      })(clickable[i]);
    }
  }

  _onCardClicked(card) {
    if (this.pendingSkills) return;

    // 1. 消耗步数
    if (!this.stepManager.useStep()) { this._endGame(false, '步数耗尽！'); return; }

    // 2. 事件卡揭示
    if (card.type === 'event' && !card.isRevealed) this._revealEventCard(card);

    // 3. 飞入槽位
    if (this.stepManager.occupiesSlot()) {
      if (!this.slotBar.addCard(card)) { this._checkFailure(); return; }
    } else {
      this.slotBar.addCard(card);
    }

    // 4. 从棋盘移除
    this.board.removeCard(card);

    // 5. 更新效果
    this.stepManager.tick();

    // 6. 重新绑定点击
    this._bindCardClicks();

    // 7. 检查胜利
    if (!this.board.hasCards()) { this._endGame(true, '棋盘清空！'); return; }

    // 8. 检查失败
    this._checkFailure();

    // 9. 刷新HUD
    this._renderHUD();
  }

  _revealEventCard(card) {
    // 保底机制：连续3次负面后第4次必正面
    if (this.consecutiveNegative >= 3) {
      var positiveCards = ['paid_leave', 'colleague_coffee', 'early_leave', 'boss_favor', 'reimburse'];
      var pick = positiveCards[Math.floor(Math.random() * positiveCards.length)];
      var FUNC_CARDS = require('../data/cards').FUNC_CARDS;
      for (var i = 0; i < FUNC_CARDS.length; i++) {
        if (FUNC_CARDS[i].id === pick) { card.config = FUNC_CARDS[i]; break; }
      }
      this.consecutiveNegative = 0;
    }
    card.reveal();
    this._applyFuncEffect(card);
    if (card.config.type === 'negative') this.consecutiveNegative++;
    else this.consecutiveNegative = 0;
    this.board._renderAll();
    this._bindCardClicks();
    this.slotBar._drawAll();
  }

  _applyFuncEffect(card) {
    var effect = card.config.effect;
    switch (effect) {
      case 'boss_patrol':
        var slots = this.slotBar.slots;
        var nonNull = [];
        for (var i = 0; i < slots.length; i++) { if (slots[i]) nonNull.push(i); }
        if (nonNull.length > 0) {
          var target = nonNull[Math.floor(Math.random() * nonNull.length)];
          slots[target].cardId = 'boss_patrol'; slots[target].name = '老板巡视'; slots[target].icon = '⚠️';
        }
        this.slotBar._drawAll();
        break;
      case 'slot_limit_down': this.stepManager.slotLimit = Math.max(3, this.stepManager.slotLimit - 1); break;
      case 'shuffle_slots': this.slotBar.shuffleSlots(); break;
      case 'remove_most': this.slotBar.clearMostCardType(); break;
      case 'add_steps_3': this.stepManager.stepsRemaining += 3; break;
      case 'double_happy_10': this._happyMultiplier = 2; this._happyMultiplierSteps = 10; break;
      default: break;
    }
  }

  onEliminate(count) {
    var baseHappy = 10;
    if (this._happyMultiplier && this._happyMultiplierSteps > 0) {
      baseHappy *= this._happyMultiplier;
      this._happyMultiplierSteps--;
      if (this._happyMultiplierSteps <= 0) this._happyMultiplier = null;
    }
    this.happyValue += baseHappy;
    this.eliminateGroupCount++;
    this.skillSystem.onEliminate();
    this._renderHUD();
  }

  showSkillSelection(skills) {
    this.pendingSkills = skills;
    this.skillButtons = [];
    this._renderSkillPopup(skills);
  }

  _renderSkillPopup(skills) {
    var w = this.stage.width, h = this.stage.height;

    var overlay = new PIXI.Graphics();
    overlay.beginFill(0x000000, 0.6); overlay.drawRect(0, 0, w, h); overlay.endFill();
    overlay.interactive = true;
    this.container.addChild(overlay);
    this._skillOverlay = overlay;

    var popupTitle = new PIXI.Text('🎯 选择技能', {
      fontFamily: 'sans-serif', fontSize: 24, fontWeight: 'bold', fill: '#F39C12', align: 'center',
    });
    popupTitle.anchor.set(0.5); popupTitle.x = w / 2; popupTitle.y = h * 0.15;
    this.container.addChild(popupTitle);
    this._skillPopupTitle = popupTitle;

    var self = this;
    var btnW = w - 60, btnH = 80, startY = h * 0.25, gap = 20;

    for (var i = 0; i < skills.length; i++) {
      (function (skill, idx) {
        var y = startY + idx * (btnH + gap);
        var sc = new PIXI.Container();

        var bg = new PIXI.Graphics();
        bg.beginFill(0x34495E); bg.drawRoundedRect(30, y, btnW, btnH, 8); bg.endFill();
        bg.interactive = true; bg.buttonMode = true;
        sc.addChild(bg);

        var iconTxt = new PIXI.Text(skill.icon, { fontFamily: 'sans-serif', fontSize: 28, align: 'center' });
        iconTxt.anchor.set(0.5); iconTxt.x = 70; iconTxt.y = y + btnH / 2;
        sc.addChild(iconTxt);

        var nameTxt = new PIXI.Text(skill.name, {
          fontFamily: 'sans-serif', fontSize: 18, fontWeight: 'bold', fill: '#FFFFFF', align: 'left',
        });
        nameTxt.x = 100; nameTxt.y = y + 12;
        sc.addChild(nameTxt);

        var descTxt = new PIXI.Text(skill.desc, {
          fontFamily: 'sans-serif', fontSize: 13, fill: '#BDC3C7', align: 'left',
        });
        descTxt.x = 100; descTxt.y = y + 40;
        sc.addChild(descTxt);

        var tagTxt = new PIXI.Text(skill.tag, {
          fontFamily: 'sans-serif', fontSize: 11, fill: '#F39C12', align: 'right',
        });
        tagTxt.anchor.set(1, 0.5); tagTxt.x = 30 + btnW - 15; tagTxt.y = y + btnH / 2;
        sc.addChild(tagTxt);

        bg.on('pointertap', function () { self._onSkillSelected(skill); });
        self.container.addChild(sc);
        self.skillButtons.push(sc);
      })(skills[i], i);
    }
  }

  _onSkillSelected(skill) {
    if (this._skillOverlay) { this.container.removeChild(this._skillOverlay); this._skillOverlay = null; }
    if (this._skillPopupTitle) { this.container.removeChild(this._skillPopupTitle); this._skillPopupTitle = null; }
    for (var i = 0; i < this.skillButtons.length; i++) this.container.removeChild(this.skillButtons[i]);
    this.skillButtons = [];
    this.pendingSkills = null;
    this.skillSystem.selectSkill(skill);
    this._renderHUD();
  }

  getSkillContext() {
    var self = this;
    return {
      get slotFreeClicks() { return self.stepManager.slotFreeClicks; },
      set slotFreeClicks(v) { self.stepManager.slotFreeClicks = v; },
      get slotLimit() { return self.stepManager.slotLimit; },
      set slotLimit(v) { self.stepManager.slotLimit = v; },
      get clearMostInSlot() { return false; },
      set clearMostInSlot(v) { if (v) self.slotBar.clearMostCardType(); },
      get removeCoveredCards() { return 0; },
      set removeCoveredCards(v) { self.board.removeCoveredCards(v); },
      get transformToWild() { return 0; },
      set transformToWild(v) { if (v) self.slotBar.transformToWild(); },
      get slotOverflowShield() { return self.stepManager.slotOverflowShield; },
      set slotOverflowShield(v) { self.stepManager.slotOverflowShield = v; },
      get stepsRemaining() { return self.stepManager.stepsRemaining; },
      set stepsRemaining(v) { self.stepManager.stepsRemaining = v; },
      get noMoreBossPatrol() { return self.stepManager.noMoreBossPatrol; },
      set noMoreBossPatrol(v) { self.stepManager.noMoreBossPatrol = v; },
      get revealAllEvents() { return false; },
      set revealAllEvents(v) { if (v) self.board.revealAllEvents(); },
      get tempSlotLimit9() { return self.stepManager.tempSlotLimit9; },
      set tempSlotLimit9(v) { self.stepManager.tempSlotLimit9 = v; },
      get stepsUnlimited() { return self.stepManager.stepsUnlimited; },
      set stepsUnlimited(v) { self.stepManager.stepsUnlimited = v; },
      get slotUnlimited() { return self.stepManager.slotUnlimited; },
      set slotUnlimited(v) { self.stepManager.slotUnlimited = v; },
      selectAndClear: false,
      clearRandomRare: false,
      swapTwoInSlot: false,
      gainWildCard: false,
      extraSkillTrigger: false,
    };
  }

  onSkillApplied(skill) {
    this.happyValue += 5;
    this._renderHUD();
  }

  _checkFailure() {
    var slotFull = this.slotBar.isFull();
    var canEliminate = this._canEliminateInSlot();
    var result = this.stepManager.checkFailure(slotFull, canEliminate);
    if (result.shieldActivated) { this.slotBar.renderEmpty(); this._renderHUD(); return; }
    if (result.isFailed) {
      var reason = result.reason === 'steps' ? '步数耗尽！' : '被老板发现！';
      this._endGame(false, reason);
    }
  }

  _canEliminateInSlot() {
    var counts = {};
    for (var i = 0; i < this.slotBar.maxSlots; i++) {
      var card = this.slotBar.slots[i];
      if (!card) continue;
      counts[card.cardId] = (counts[card.cardId] || 0) + 1;
    }
    for (var k in counts) { if (counts[k] >= 3) return true; }
    var wildCount = 0;
    for (var j = 0; j < this.slotBar.maxSlots; j++) {
      var c = this.slotBar.slots[j];
      if (c && c.type === 'event' && c.config.effect === 'wild_card' && c.isRevealed) wildCount++;
    }
    for (var k2 in counts) { if (counts[k2] + wildCount >= 3) return true; }
    return false;
  }

  _endGame(won, reason) {
    var bonusHappy = 0;
    if (won) {
      bonusHappy += this.stepManager.stepsRemaining * 10;
      if (this.slotBar.getVacantCount() >= 3) bonusHappy += 20;
    }
    this.happyValue += bonusHappy;
    log(TAG, 'Game over: won=' + won + ', happy=' + this.happyValue + ', reason=' + reason);
    this.onGameOver({
      won: won, happyValue: this.happyValue,
      reason: reason, levelId: this.levelId,
      stepsUsed: this.stepManager.maxSteps - this.stepManager.stepsRemaining,
    });
  }

  _renderHUD() {
    if (this._hudContainer) this.container.removeChild(this._hudContainer);
    this._hudContainer = new PIXI.Container();
    this.container.addChild(this._hudContainer);
    var screenW = this.stage.width;

    var levelName = this.board.levelConfig ? this.board.levelConfig.name : '';
    var levelText = new PIXI.Text(levelName, { fontFamily: 'sans-serif', fontSize: 14, fill: '#BDC3C7' });
    levelText.x = 10; levelText.y = 8;
    this._hudContainer.addChild(levelText);

    var stepsColor = this.stepManager.stepsRemaining <= 5 ? '#E74C3C' : '#FFFFFF';
    var stepsText = new PIXI.Text('步数: ' + this.stepManager.stepsRemaining, {
      fontFamily: 'sans-serif', fontSize: 18, fontWeight: 'bold', fill: stepsColor,
    });
    stepsText.anchor.set(0.5, 0); stepsText.x = screenW / 2; stepsText.y = 5;
    this._hudContainer.addChild(stepsText);

    var happyText = new PIXI.Text('😊 ' + this.happyValue, {
      fontFamily: 'sans-serif', fontSize: 16, fontWeight: 'bold', fill: '#F1C40F',
    });
    happyText.anchor.set(1, 0); happyText.x = screenW - 10; happyText.y = 8;
    this._hudContainer.addChild(happyText);

    var slotStatus = this.slotBar.getVacantCount() + ' 空格';
    if (this.stepManager.slotFreeClicks > 0) slotStatus += ' | 🛡️飞行中×' + this.stepManager.slotFreeClicks;
    if (this.stepManager.tempSlotLimit9 > 0) slotStatus += ' | 💤装死中×' + this.stepManager.tempSlotLimit9;
    var slotText = new PIXI.Text(slotStatus, { fontFamily: 'sans-serif', fontSize: 13, fill: '#95A5A6', align: 'center' });
    slotText.anchor.set(0.5); slotText.x = screenW / 2; slotText.y = this.slotBar.startY - 25;
    this._hudContainer.addChild(slotText);
  }

  update(dt) {}
  render(container) { container.addChild(this.container); }
  onExit() { this.stage.removeChild(this.container); }
}
