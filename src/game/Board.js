// src/game/Board.js

import Card from './Card';
import { NORMAL_CARDS, FUNC_CARDS, FUNC_TYPE } from '../data/cards';
import { getLevelConfig } from '../data/levels';
import { log } from '../utils/Logger';

var TAG = 'Board';

export default class Board {
  constructor(stage) {
    this.stage = stage;
    this.grid = [];
    this.levelConfig = null;
    this.container = new PIXI.Container();
    this.container.name = 'board';
    stage.addChild(this.container);
    this.cardWidth = 64;
    this.cardHeight = 80;
    this.offsetX = 0;
    this.offsetY = 0;
    this.layerOffsetX = 4;
    this.layerOffsetY = 4;
    this.gap = 8;
  }

  calcLayout(screenW, screenH, rows, cols) {
    var areaTop = 20;
    var areaBottom = 180;
    var areaH = screenH - areaTop - areaBottom;
    var areaW = screenW - 20;
    var gap = 8;
    this.cardWidth = Math.floor((areaW - gap * (cols + 1)) / cols);
    this.cardHeight = Math.floor(this.cardWidth * 1.25);
    this.offsetX = Math.floor((screenW - (this.cardWidth * cols + gap * (cols - 1))) / 2);
    this.offsetY = areaTop + Math.floor((areaH - (this.cardHeight * rows + gap * (rows - 1))) / 2);
    this.gap = gap;
    this.layerOffsetX = Math.floor(this.cardWidth * 0.08);
    this.layerOffsetY = Math.floor(this.cardHeight * 0.06);
  }

  generate(levelId) {
    this.container.removeChildren();
    this.grid = [];
    var config = getLevelConfig(levelId);
    this.levelConfig = config;
    var layers = config.layers, rows = config.gridRows, cols = config.gridCols;

    // 初始化grid
    for (var l = 0; l < layers; l++) {
      this.grid[l] = [];
      for (var r = 0; r < rows; r++) {
        this.grid[l][r] = [];
        for (var c = 0; c < cols; c++) this.grid[l][r][c] = null;
      }
    }

    var cardList = this._buildCardList(config);
    this._fillGrid(cardList, layers, rows, cols);
    this._updateCoveredState();
    this._renderAll();
    log(TAG, 'Board generated: ' + cardList.length + ' cards, ' + layers + ' layers');
  }

  _buildCardList(config) {
    var list = [];
    var normalCount = config.totalCards - config.funcCardCount;

    // 普通卡
    var usedNormalTypes = NORMAL_CARDS.slice(0, config.normalCardTypes);
    var perType = Math.floor(normalCount / config.normalCardTypes);
    perType = perType - (perType % 3);
    for (var i = 0; i < usedNormalTypes.length; i++) {
      for (var j = 0; j < perType; j++) {
        list.push({ type: 'normal', config: usedNormalTypes[i], isEvent: false });
      }
    }
    // 补齐剩余
    var remain = normalCount - list.length;
    for (var k = 0; k < remain; k++) {
      list.push({ type: 'normal', config: usedNormalTypes[0], isEvent: false });
    }

    // 功能卡
    var funcTypes = config.funcTypes;
    var funcRatio = config.funcRatio || { negative: 1, positive: 0, dual: 0 };
    var negCount = Math.floor(config.funcCardCount * (funcRatio.negative || 0.5));
    var posCount = Math.floor(config.funcCardCount * (funcRatio.positive || 0.25));
    var dualCount = config.funcCardCount - negCount - posCount;

    this._addFuncCards(list, FUNC_TYPE.NEGATIVE, negCount);
    this._addFuncCards(list, FUNC_TYPE.POSITIVE, posCount);
    this._addFuncCards(list, FUNC_TYPE.DUAL, dualCount);
    this._shuffle(list);
    return list;
  }

  _addFuncCards(list, funcType, count) {
    var pool = FUNC_CARDS.filter(function (c) { return c.type === funcType; });
    for (var i = 0; i < count; i++) {
      var pick = pool[Math.floor(Math.random() * pool.length)];
      list.push({ type: 'event', config: pick, isEvent: true });
    }
  }

  _shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
  }

  _fillGrid(cardList, layers, rows, cols) {
    // 分离事件卡和普通卡
    var eventCards = [], normalCards = [];
    for (var i = 0; i < cardList.length; i++) {
      if (cardList[i].isEvent) eventCards.push(cardList[i]);
      else normalCards.push(cardList[i]);
    }
    // 稀有卡排在前面（在底层）
    normalCards.sort(function (a, b) {
      var order = { rare: 0, uncommon: 1, common: 2 };
      return (order[a.config.rarity] || 2) - (order[b.config.rarity] || 2);
    });

    for (var l = 0; l < layers; l++) {
      var coverage;
      if (layers === 1) coverage = 0.95;
      else if (l === 0) coverage = 0.9;
      else if (l === layers - 1) coverage = 0.3;
      else coverage = 0.5;

      var needed = Math.floor(rows * cols * coverage);
      var placed = 0;
      for (var r = 0; r < rows && placed < needed; r++) {
        for (var c = 0; c < cols && placed < needed; c++) {
          if (this.grid[l][r][c] !== null) continue;
          var cardData;
          if (l === layers - 1 && eventCards.length > 0) cardData = eventCards.shift();
          else if (normalCards.length > 0) cardData = normalCards.shift();
          else if (eventCards.length > 0) cardData = eventCards.shift();
          else break;
          var card = new Card({ id: 'card_' + l + '_' + r + '_' + c, type: cardData.type, config: cardData.config, layer: l, row: r, col: c });
          this.grid[l][r][c] = card;
          placed++;
        }
      }
    }
  }

  _updateCoveredState() {
    var self = this;
    for (var l = 0; l < this.grid.length; l++) {
      for (var r = 0; r < this.grid[l].length; r++) {
        for (var c = 0; c < this.grid[l][r].length; c++) {
          var card = this.grid[l][r][c];
          if (!card) continue;
          card.isCovered = self._isCovered(card);
        }
      }
    }
  }

  _isCovered(card) {
    var upperLayer = card.layer + 1;
    if (upperLayer >= this.grid.length) return false;
    var checkPositions = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]];
    for (var i = 0; i < checkPositions.length; i++) {
      var dr = checkPositions[i][0], dc = checkPositions[i][1];
      var rr = card.row + dr, cc = card.col + dc;
      if (rr >= 0 && rr < this.grid[upperLayer].length &&
          cc >= 0 && cc < this.grid[upperLayer][0].length &&
          this.grid[upperLayer][rr][cc] !== null) return true;
    }
    return false;
  }

  getClickableCards() {
    var result = [];
    for (var l = 0; l < this.grid.length; l++)
      for (var r = 0; r < this.grid[l].length; r++)
        for (var c = 0; c < this.grid[l][r].length; c++) {
          var card = this.grid[l][r][c];
          if (card && !card.isRemoved && !card.isCovered) result.push(card);
        }
    return result;
  }

  removeCard(card) {
    if (!card || card.isRemoved) return null;
    card.isRemoved = true;
    this.grid[card.layer][card.row][card.col] = null;
    if (card.container) { card.container.alpha = 0; card.container.interactive = false; }
    this._updateCoveredState();
    return card;
  }

  revealAllEvents() {
    for (var l = 0; l < this.grid.length; l++)
      for (var r = 0; r < this.grid[l].length; r++)
        for (var c = 0; c < this.grid[l][r].length; c++) {
          var card = this.grid[l][r][c];
          if (card && card.type === 'event' && !card.isRevealed) card.reveal();
        }
    this._renderAll();
  }

  removeCoveredCards(count) {
    var covered = [];
    for (var l = 0; l < this.grid.length; l++)
      for (var r = 0; r < this.grid[l].length; r++)
        for (var c = 0; c < this.grid[l][r].length; c++) {
          var card = this.grid[l][r][c];
          if (card && card.isCovered && !card.isRemoved) covered.push(card);
        }
    this._shuffle(covered);
    var toRemove = covered.slice(0, count);
    for (var i = 0; i < toRemove.length; i++) this.removeCard(toRemove[i]);
    return toRemove;
  }

  hasCards() {
    for (var l = 0; l < this.grid.length; l++)
      for (var r = 0; r < this.grid[l].length; r++)
        for (var c = 0; c < this.grid[l][r].length; c++)
          if (this.grid[l][r][c] && !this.grid[l][r][c].isRemoved) return true;
    return false;
  }

  getCardCounts() {
    var counts = {};
    for (var l = 0; l < this.grid.length; l++)
      for (var r = 0; r < this.grid[l].length; r++)
        for (var c = 0; c < this.grid[l][r].length; c++) {
          var card = this.grid[l][r][c];
          if (card && !card.isRemoved) {
            var key = card.type === 'event' ? ('func_' + card.cardId) : card.cardId;
            counts[key] = (counts[key] || 0) + 1;
          }
        }
    return counts;
  }

  // ============= 渲染 =============

  _renderAll() {
    this.container.removeChildren();
    for (var l = 0; l < this.grid.length; l++)
      for (var r = 0; r < this.grid[l].length; r++)
        for (var c = 0; c < this.grid[l][r].length; c++) {
          var card = this.grid[l][r][c];
          if (card && !card.isRemoved) this._renderCardAt(card, r, c);
        }
  }

  _renderCardAt(card, row, col) {
    var container = new PIXI.Container();
    var w = this.cardWidth, h = this.cardHeight;
    var x = this.offsetX + col * (w + this.gap) + card.layer * this.layerOffsetX;
    var y = this.offsetY + row * (h + this.gap) - card.layer * this.layerOffsetY;
    container.x = x; container.y = y;

    var bg = new PIXI.Graphics();
    var bgColor = card.isCovered ? 0xBDC3C7 : 0xFFFFFF;
    bg.beginFill(bgColor);
    bg.drawRoundedRect(0, 0, w, h, 6);
    bg.endFill();
    bg.lineStyle(1.5, card.getColor(), card.isCovered ? 0.3 : 0.8);
    bg.drawRoundedRect(0, 0, w, h, 6);
    container.addChild(bg);

    if (card.isCovered) {
      var mask = new PIXI.Graphics();
      mask.beginFill(0x000000, 0.3);
      mask.drawRoundedRect(0, 0, w, h, 6);
      mask.endFill();
      container.addChild(mask);
    }

    var displayIcon = (card.type === 'event' && !card.isRevealed) ? '❓' : card.icon;
    var iconText = new PIXI.Text(displayIcon, { fontFamily: 'sans-serif', fontSize: 28, align: 'center' });
    iconText.anchor.set(0.5); iconText.x = w / 2; iconText.y = h * 0.35;
    container.addChild(iconText);

    var displayName = (card.type === 'event' && !card.isRevealed) ? '事件' : card.name;
    var nameText = new PIXI.Text(displayName, { fontFamily: 'sans-serif', fontSize: 13,
      fill: card.isCovered ? '#999999' : '#333333', align: 'center' });
    nameText.anchor.set(0.5); nameText.x = w / 2; nameText.y = h * 0.7;
    container.addChild(nameText);

    var bar = new PIXI.Graphics();
    bar.beginFill(card.getColor(), card.isCovered ? 0.4 : 0.9);
    bar.drawRect(4, h - 6, w - 8, 4);
    bar.endFill();
    container.addChild(bar);

    card.container = container;
    this.container.addChild(container);
    // 点击由 EventManager hit area 处理，不依赖 PIXI 事件系统
  }

  getCardScreenPos(card) {
    if (!card || !card.container) return { x: 0, y: 0 };
    return { x: card.container.x + this.cardWidth / 2, y: card.container.y + this.cardHeight / 2 };
  }
}
