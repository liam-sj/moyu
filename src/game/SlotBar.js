// src/game/SlotBar.js

import { log } from '../utils/Logger';

var TAG = 'SlotBar';

export default class SlotBar {
  constructor(stage, gameScene) {
    this.stage = stage;
    this.gameScene = gameScene;
    this.slots = [];
    this.maxSlots = 7;
    this.container = new PIXI.Container();
    this.container.name = 'slotBar';
    stage.addChild(this.container);
    this.slotWidth = 56;
    this.slotHeight = 72;
    this.gap = 6;
  }

  calcLayout(screenW, screenH) {
    var totalW = this.maxSlots * this.slotWidth + (this.maxSlots - 1) * this.gap;
    this.startX = Math.floor((screenW - totalW) / 2);
    this.startY = screenH - 140;
  }

  renderEmpty() {
    this.slots = [];
    for (var i = 0; i < this.maxSlots; i++) this.slots.push(null);
    this._drawAll();
  }

  addCard(card) {
    var emptyIdx = -1;
    for (var i = 0; i < this.maxSlots; i++) { if (this.slots[i] === null) { emptyIdx = i; break; } }
    if (emptyIdx === -1) { log(TAG, 'Slot full'); return false; }
    this.slots[emptyIdx] = card;
    this._drawAll();
    this._checkMatch(card);
    return true;
  }

  getVacantCount() {
    var c = 0;
    for (var i = 0; i < this.maxSlots; i++) { if (this.slots[i] === null) c++; }
    return c;
  }

  isFull() { return this.getVacantCount() === 0; }

  _checkMatch(card) {
    var cardId = card.cardId;
    var wildCards = [], sameCards = [];
    for (var i = 0; i < this.maxSlots; i++) {
      var s = this.slots[i];
      if (!s) continue;
      if (s.cardId === cardId) sameCards.push(i);
      if (s.type === 'event' && s.config.effect === 'wild_card' && s.isRevealed) wildCards.push(i);
    }
    if (sameCards.length >= 3) { this._eliminate(sameCards.slice(0, 3)); return sameCards.length >= 6 ? 2 : 1; }
    if (wildCards.length > 0 && (sameCards.length + wildCards.length) >= 3) {
      var needed = 3 - sameCards.length;
      this._eliminate(sameCards.slice(0).concat(wildCards.slice(0, needed)));
      return 1;
    }
    return 0;
  }

  _eliminate(indices) {
    for (var i = 0; i < indices.length; i++) this.slots[indices[i]] = null;
    this._drawAll();
    if (this.gameScene && this.gameScene.onEliminate) this.gameScene.onEliminate(indices.length);
  }

  clearMostCardType() {
    var counts = {};
    for (var i = 0; i < this.maxSlots; i++) {
      var s = this.slots[i]; if (!s) continue;
      var key = s.cardId;
      if (!counts[key]) counts[key] = [];
      counts[key].push(i);
    }
    var maxKey = null, maxCount = 0;
    for (var k in counts) { if (counts[k].length > maxCount) { maxCount = counts[k].length; maxKey = k; } }
    if (maxKey) this._eliminate(counts[maxKey]);
  }

  shuffleSlots() {
    var cards = [];
    for (var i = 0; i < this.maxSlots; i++) { if (this.slots[i]) cards.push(this.slots[i]); }
    for (var j = cards.length - 1; j > 0; j--) { var k = Math.floor(Math.random() * (j + 1)); var tmp = cards[j]; cards[j] = cards[k]; cards[k] = tmp; }
    var ci = 0;
    for (var s = 0; s < this.maxSlots; s++) { if (this.slots[s]) this.slots[s] = cards[ci++]; }
    this._drawAll();
  }

  transformToWild() {
    for (var i = 0; i < this.maxSlots; i++) {
      if (this.slots[i] && this.slots[i].type !== 'event') {
        var c = this.slots[i];
        c.type = 'event'; c.cardId = 'paid_leave'; c.icon = '🌟'; c.name = '万能卡';
        c.config = { id: 'paid_leave', effect: 'wild_card', type: 'positive' };
        c.isRevealed = true;
        break;
      }
    }
    this._drawAll();
  }

  _drawAll() {
    this.container.removeChildren();
    for (var i = 0; i < this.maxSlots; i++) {
      var x = this.startX + i * (this.slotWidth + this.gap);
      var y = this.startY;
      var slotBg = new PIXI.Graphics();
      if (this.slots[i]) {
        var card = this.slots[i];
        slotBg.beginFill(0xFFFFFF);
        slotBg.drawRoundedRect(x, y, this.slotWidth, this.slotHeight, 4);
        slotBg.endFill();
        slotBg.lineStyle(1.5, card.getColor(), 0.8);
        slotBg.drawRoundedRect(x, y, this.slotWidth, this.slotHeight, 4);
        var icon = card.icon;
        if (card.type === 'event' && !card.isRevealed) icon = '❓';
        var iconText = new PIXI.Text(icon, { fontFamily: 'sans-serif', fontSize: 22, align: 'center' });
        iconText.anchor.set(0.5); iconText.x = x + this.slotWidth / 2; iconText.y = y + this.slotHeight * 0.4;
        this.container.addChild(iconText);
        var nameText = new PIXI.Text(card.name, { fontFamily: 'sans-serif', fontSize: 10, fill: '#333', align: 'center' });
        nameText.anchor.set(0.5); nameText.x = x + this.slotWidth / 2; nameText.y = y + this.slotHeight * 0.75;
        this.container.addChild(nameText);
      } else {
        slotBg.lineStyle(1, 0xBDC3C7, 0.5);
        slotBg.drawRoundedRect(x, y, this.slotWidth, this.slotHeight, 4);
      }
      this.container.addChild(slotBg);
    }
  }
}
