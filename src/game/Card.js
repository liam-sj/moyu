// src/game/Card.js

export default class Card {
  constructor(opts) {
    this.id = opts.id;
    this.type = opts.type;           // 'normal' | 'event'
    this.config = opts.config;
    this.cardId = opts.config.id;
    this.icon = opts.config.icon;
    this.name = opts.config.name;
    this.layer = opts.layer;
    this.row = opts.row;
    this.col = opts.col;
    this.isRevealed = false;
    this.isRemoved = false;
    this.isCovered = true;
    this.container = null;
  }

  reveal() {
    if (this.type !== 'event' || this.isRevealed) return;
    this.isRevealed = true;
    if (this.config.revealIcon) this.icon = this.config.revealIcon;
    if (this.config.revealName) this.name = this.config.revealName;
  }

  getColor() {
    if (this.type === 'event' && !this.isRevealed) return 0x9B59B6;
    if (this.type === 'event' && this.isRevealed) {
      var t = this.config.type;
      if (t === 'negative') return 0xE74C3C;
      if (t === 'positive') return 0x2ECC71;
      if (t === 'dual') return 0xF39C12;
    }
    var r = this.config.rarity;
    if (r === 'rare') return 0xF1C40F;
    if (r === 'uncommon') return 0x3498DB;
    return 0x95A5A6;
  }

  getRarityText() {
    if (this.type === 'event') return '';
    var r = this.config.rarity;
    if (r === 'common') return '普通';
    if (r === 'uncommon') return '少见';
    if (r === 'rare') return '稀有';
    return '';
  }
}
