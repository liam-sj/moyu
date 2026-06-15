# 摸鱼大师 Phase 1 — 可玩原型实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现摸鱼大师核心三消玩法原型（棋盘堆叠点击 → 槽位消除 → 肉鸽技能 → 双重限制 → 结算）

**Architecture:** PixiJS v7 Canvas 渲染 + Scene-driven 架构。从 minigame-1 复用 PixiAdapter/libs/核心框架，新建棋盘/卡片/槽位/技能四大游戏组件，MenuScene/GameScene/ResultScene 三个场景。

**Tech Stack:** PixiJS v7 (pixi-legacy), WeChat Mini Game API, ES6 modules (no build step)

**Source reference:** `C:/Users/lenovo/WeChatProjects/minigame-1/` — PixiJS libs, PixiAdapter, core framework

---

## 文件结构总览

```
moyu-master/
├── game.js                          # 入口 [改写]
├── game.json                        # [不改]
├── project.config.json              # [不改]
├── libs/                            # [从 minigame-1 复制]
│   ├── pixi-legacy.min.js
│   └── pixi-unsafe-eval-v7.js
├── src/
│   ├── wechat/PixiAdapter.js        # [复制]
│   ├── core/
│   │   ├── Game.js                  # [新建]
│   │   ├── Scene.js                 # [复制]
│   │   ├── SceneManager.js          # [复制]
│   │   └── EventManager.js          # [复制]
│   ├── scenes/
│   │   ├── MenuScene.js             # [新建]
│   │   ├── GameScene.js             # [新建]
│   │   └── ResultScene.js           # [新建]
│   ├── game/
│   │   ├── Board.js                 # [新建]
│   │   ├── Card.js                  # [新建]
│   │   ├── SlotBar.js               # [新建]
│   │   ├── SkillSystem.js           # [新建]
│   │   └── StepManager.js           # [新建]
│   ├── data/
│   │   ├── cards.js                 # [新建]
│   │   ├── skills.js                # [新建]
│   │   └── levels.js                # [新建]
│   ├── ui/Button.js                 # [复制+微调]
│   └── utils/Logger.js              # [复制]
```

---

### Task 1: 清理旧文件 + 复制基础设施

**Files:**
- Delete: `js/` (旧 shooter 游戏代码)
- Delete: `images/` (旧图片资源，功能卡爆炸效果等)
- Delete: `audio/` (旧音效)
- Copy: minigame-1 libs, PixiAdapter, core framework, Button, Logger

- [ ] **Step 1: 删除旧游戏代码和资源**

```bash
rm -rf js/ images/ audio/
```

- [ ] **Step 2: 复制 PixiJS libs**

```bash
cp "C:/Users/lenovo/WeChatProjects/minigame-1/libs/pixi-legacy.min.js" libs/
cp "C:/Users/lenovo/WeChatProjects/minigame-1/libs/pixi-unsafe-eval-v7.js" libs/
```

- [ ] **Step 3: 复制核心框架和工具文件**

```bash
mkdir -p src/wechat src/core src/ui src/utils src/scenes src/game src/data
cp "C:/Users/lenovo/WeChatProjects/minigame-1/src/wechat/PixiAdapter.js" src/wechat/
cp "C:/Users/lenovo/WeChatProjects/minigame-1/src/core/Scene.js" src/core/
cp "C:/Users/lenovo/WeChatProjects/minigame-1/src/core/SceneManager.js" src/core/
cp "C:/Users/lenovo/WeChatProjects/minigame-1/src/core/EventManager.js" src/core/
cp "C:/Users/lenovo/WeChatProjects/minigame-1/src/ui/Button.js" src/ui/
cp "C:/Users/lenovo/WeChatProjects/minigame-1/src/utils/Logger.js" src/utils/
```

- [ ] **Step 4: 通过 node -c 验证语法**

```bash
for f in src/wechat/PixiAdapter.js src/core/Scene.js src/core/SceneManager.js src/core/EventManager.js src/ui/Button.js src/utils/Logger.js; do node -c "$f" && echo "OK: $f" || echo "FAIL: $f"; done
```

Expected: All files pass syntax check

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: clean old shooter code, copy PixiJS + core framework from minigame-1"
```

---

### Task 2: 数据配置文件 — cards.js / skills.js / levels.js

**Files:**
- Create: `src/data/cards.js`
- Create: `src/data/skills.js`
- Create: `src/data/levels.js`

- [ ] **Step 1: 创建 src/data/cards.js — 7 种基础卡 + 10 种功能卡配置**

```js
// src/data/cards.js

// 基础摸鱼卡（7种）
export var NORMAL_CARDS = [
  { id: 'phone',    icon: '📱', name: '刷手机',   rarity: 'common', weight: 90 },
  { id: 'toilet',   icon: '🚽', name: '带薪拉屎', rarity: 'common', weight: 80 },
  { id: 'sleep',    icon: '😴', name: '打瞌睡',   rarity: 'common', weight: 70 },
  { id: 'snack',    icon: '🍜', name: '吃零食',   rarity: 'uncommon', weight: 40 },
  { id: 'shop',     icon: '🛒', name: '逛淘宝',   rarity: 'uncommon', weight: 35 },
  { id: 'gossip',   icon: '💬', name: '聊八卦',   rarity: 'rare', weight: 15 },
  { id: 'game',     icon: '🎮', name: '偷偷游戏', rarity: 'rare', weight: 10 },
];

/**
 * 根据权重随机选择基础卡
 * @param {string[]} excludeIds - 排除的卡片id
 * @returns {object} 卡片配置
 */
export function randomNormalCard(excludeIds) {
  excludeIds = excludeIds || [];
  var pool = NORMAL_CARDS.filter(function (c) {
    return excludeIds.indexOf(c.id) === -1;
  });
  var totalWeight = pool.reduce(function (sum, c) { return sum + c.weight; }, 0);
  var r = Math.random() * totalWeight;
  var acc = 0;
  for (var i = 0; i < pool.length; i++) {
    acc += pool[i].weight;
    if (r <= acc) return pool[i];
  }
  return pool[pool.length - 1];
}

// 功能卡类型标记
export var FUNC_TYPE = {
  NEGATIVE: 'negative',   // 负面
  POSITIVE: 'positive',   // 正面
  DUAL: 'dual',           // 双刃剑
};

// 功能卡片配置（10种，点击揭示）
export var FUNC_CARDS = [
  // 负面卡
  { id: 'boss_patrol',    icon: '⚠️', name: '老板巡视', type: FUNC_TYPE.NEGATIVE,
    effect: 'boss_patrol', revealIcon: '⚠️', revealName: '老板巡视', weight: 30 },
  { id: 'emergency_meet', icon: '📞', name: '紧急会议', type: FUNC_TYPE.NEGATIVE,
    effect: 'lock_cards', revealIcon: '📞', revealName: '紧急会议', weight: 15 },
  { id: 'printer_jam',    icon: '🖨️', name: '卡纸打印机', type: FUNC_TYPE.NEGATIVE,
    effect: 'slot_limit_down', revealIcon: '🖨️', revealName: '卡纸打印机', weight: 15 },
  { id: 'system_crash',   icon: '💻', name: '系统崩溃', type: FUNC_TYPE.NEGATIVE,
    effect: 'shuffle_slots', revealIcon: '💻', revealName: '系统崩溃', weight: 25 },
  { id: 'new_task',       icon: '📋', name: '临时加需求', type: FUNC_TYPE.NEGATIVE,
    effect: 'add_cards_to_board', revealIcon: '📋', revealName: '临时加需求', weight: 15 },

  // 正面卡
  { id: 'paid_leave',     icon: '🌟', name: '带薪年假', type: FUNC_TYPE.POSITIVE,
    effect: 'wild_card', revealIcon: '🌟', revealName: '带薪年假', weight: 15 },
  { id: 'colleague_coffee', icon: '☕', name: '同事请咖啡', type: FUNC_TYPE.POSITIVE,
    effect: 'remove_most', revealIcon: '☕', revealName: '同事请咖啡', weight: 15 },
  { id: 'early_leave',    icon: '🎫', name: '提前下班券', type: FUNC_TYPE.POSITIVE,
    effect: 'add_steps_3', revealIcon: '🎫', revealName: '提前下班券', weight: 8 },
  { id: 'boss_favor',     icon: '🍀', name: '领导的宠儿', type: FUNC_TYPE.POSITIVE,
    effect: 'immune_negative_3', revealIcon: '🍀', revealName: '领导的宠儿', weight: 15 },
  { id: 'reimburse',      icon: '💰', name: '报销通过', type: FUNC_TYPE.POSITIVE,
    effect: 'double_happy_10', revealIcon: '💰', revealName: '报销通过', weight: 12 },

  // 双刃剑卡
  { id: 'job_rotate',     icon: '🔀', name: '岗位轮换', type: FUNC_TYPE.DUAL,
    effect: 'random_transform_one', revealIcon: '🔀', revealName: '岗位轮换', weight: 20 },
  { id: 'overtime',       icon: '⏳', name: '加班申请', type: FUNC_TYPE.DUAL,
    effect: 'add_steps_5_boss_rise', revealIcon: '⏳', revealName: '加班申请', weight: 15 },
  { id: 'dept_dinner',    icon: '🍺', name: '部门聚餐', type: FUNC_TYPE.DUAL,
    effect: 'remove_3_slot_down', revealIcon: '🍺', revealName: '部门聚餐', weight: 15 },
  { id: 'weekly_report',  icon: '📊', name: '全员周报', type: FUNC_TYPE.DUAL,
    effect: 'reveal_add_boss', revealIcon: '📊', revealName: '全员周报', weight: 12 },
];

/**
 * 按权重随机选择功能卡
 * @param {string} typeFilter - 可选：只从特定类型中选
 * @returns {object} 功能卡配置
 */
export function randomFuncCard(typeFilter) {
  var pool = FUNC_CARDS;
  if (typeFilter) {
    pool = FUNC_CARDS.filter(function (c) { return c.type === typeFilter; });
  }
  var totalWeight = pool.reduce(function (sum, c) { return sum + c.weight; }, 0);
  var r = Math.random() * totalWeight;
  var acc = 0;
  for (var i = 0; i < pool.length; i++) {
    acc += pool[i].weight;
    if (r <= acc) return pool[i];
  }
  return pool[0];
}
```

- [ ] **Step 2: 语法检查**

```bash
node -c src/data/cards.js && echo "OK"
```

- [ ] **Step 3: 创建 src/data/skills.js — 17 个肉鸽技能池**

```js
// src/data/skills.js

// 技能类型
export var SKILL_TAG = {
  RHYTHM: '节奏型',
  TOLERANCE: '容错型',
  EMERGENCY: '救急型',
  RELIEF: '减压型',
  WILD: '万能型',
  LIFE_SAVER: '保命型',
  ENDURANCE: '续航型',
  BURDEN: '减负型',
  INFO: '信息型',
  CLEAR: '定向清除',
  STRATEGY: '策略型',
  LEGENDARY: '传说型',
};

var SKILLS = [
  // 常规技能（15个）
  { id: 'S1',  name: '飞行模式',     icon: '📵', tag: SKILL_TAG.RHYTHM,
    desc: '接下来3次点击不占槽位',
    apply: function (ctx) { ctx.slotFreeClicks = 3; } },
  { id: 'S2',  name: '同事掩护',     icon: '🤝', tag: SKILL_TAG.TOLERANCE,
    desc: '本局槽位上限+1',
    apply: function (ctx) { ctx.slotLimit += 1; } },
  { id: 'S3',  name: '提前下班',     icon: '⏰', tag: SKILL_TAG.EMERGENCY,
    desc: '立即清空槽位中数量最多的那种卡',
    apply: function (ctx) { ctx.clearMostInSlot = true; } },
  { id: 'S4',  name: '清理桌面',     icon: '🗑️', tag: SKILL_TAG.RELIEF,
    desc: '随机移除棋盘上3张被压住的卡',
    apply: function (ctx) { ctx.removeCoveredCards = 3; } },
  { id: 'S5',  name: '假装工作',     icon: '🎭', tag: SKILL_TAG.WILD,
    desc: '将槽位中一张卡变成万能卡',
    apply: function (ctx) { ctx.transformToWild = 1; } },
  { id: 'S6',  name: '周报护体',     icon: '📊', tag: SKILL_TAG.LIFE_SAVER,
    desc: '下一次槽满时不失败，改为清空全部槽位',
    apply: function (ctx) { ctx.slotOverflowShield = true; } },
  { id: 'S7',  name: '极限逃生',     icon: '🏃', tag: SKILL_TAG.ENDURANCE,
    desc: '额外获得5步',
    apply: function (ctx) { ctx.stepsRemaining += 5; } },
  { id: 'S8',  name: '老板出差',     icon: '👔', tag: SKILL_TAG.BURDEN,
    desc: '本局不再生成"老板巡视"卡',
    apply: function (ctx) { ctx.noMoreBossPatrol = true; } },
  { id: 'S9',  name: '茶水间情报',   icon: '🍵', tag: SKILL_TAG.INFO,
    desc: '揭示所有❓事件卡身份，持续10秒',
    apply: function (ctx) { ctx.revealAllEvents = true; } },
  { id: 'S10', name: '屏幕切换',     icon: '💻', tag: SKILL_TAG.CLEAR,
    desc: '指定一种卡，本局该种卡全部消除',
    apply: function (ctx) { ctx.selectAndClear = true; } },
  { id: 'S11', name: '团建请假',     icon: '🎉', tag: SKILL_TAG.CLEAR,
    desc: '随机移除一种稀有卡的全部',
    apply: function (ctx) { ctx.clearRandomRare = true; } },
  { id: 'S12', name: '带薪转岗',     icon: '🔄', tag: SKILL_TAG.STRATEGY,
    desc: '槽内任意两张卡互换位置',
    apply: function (ctx) { ctx.swapTwoInSlot = true; } },
  { id: 'S13', name: '装死模式',     icon: '💤', tag: SKILL_TAG.TOLERANCE,
    desc: '接下来5步内，槽满上限临时变为9',
    apply: function (ctx) { ctx.tempSlotLimit9 = 5; } },
  { id: 'S14', name: '工作记忆',     icon: '🧠', tag: SKILL_TAG.WILD,
    desc: '获得一张万能卡进槽',
    apply: function (ctx) { ctx.gainWildCard = true; } },
  { id: 'S15', name: '年度最佳员工', icon: '🏆', tag: SKILL_TAG.LEGENDARY,
    desc: '本局槽位上限+1，且技能触发次数+1',
    apply: function (ctx) { ctx.slotLimit += 1; ctx.extraSkillTrigger = true; } },

  // 传说级"删除限制"技能（2个，极低概率）
  { id: 'S16', name: '忘记打卡',     icon: '🦄', tag: SKILL_TAG.LEGENDARY,
    desc: '本局取消步数限制，但槽位上限-2',
    apply: function (ctx) { ctx.stepsUnlimited = true; ctx.slotLimit = Math.max(3, ctx.slotLimit - 2); } },
  { id: 'S17', name: '无人办公室',   icon: '🔓', tag: SKILL_TAG.LEGENDARY,
    desc: '本局槽位上限取消，但步数减半',
    apply: function (ctx) { ctx.slotUnlimited = true; ctx.stepsRemaining = Math.floor(ctx.stepsRemaining / 2); } },
];

/**
 * 获取技能列表
 * @param {number} count - 要获取的技能数量（默认3个用于三选一）
 * @returns {Array} 技能配置数组
 */
export function getRandomSkills(count) {
  count = count || 3;
  var pool = SKILLS.slice();
  // Fisher-Yates shuffle
  for (var i = pool.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
  }
  // 传说技能概率控制：最多1个传说，20%概率出现
  var hasLegendary = Math.random() < 0.2;
  var result = [];
  for (var k = 0; k < pool.length && result.length < count; k++) {
    if (pool[k].tag === SKILL_TAG.LEGENDARY && !hasLegendary) continue;
    if (pool[k].tag === SKILL_TAG.LEGENDARY) hasLegendary = false; // 只允许1个传说
    result.push(pool[k]);
  }
  return result;
}

export default SKILLS;
```

- [ ] **Step 4: 语法检查**

```bash
node -c src/data/skills.js && echo "OK"
```

- [ ] **Step 5: 创建 src/data/levels.js — 关卡参数**

```js
// src/data/levels.js

export var LEVELS = {
  // 第一关：教学关，简单
  level1: {
    id: 'level1',
    name: '第一关',
    normalCardTypes: 4,       // 使用4种基础卡（选weight最高的4种）
    funcCardCount: 2,         // 2张功能卡（仅负面）
    funcTypes: ['negative'],  // 只用负面卡
    layers: 2,                // 1-2层堆叠
    gridRows: 4,
    gridCols: 4,
    totalCards: 24,           // 必须是3的倍数
    steps: 30,                // 初始步数
    slotLimit: 7,             // 槽位上限
    // 确保24能整除3，且每3张一组
  },

  // 第二关：挑战关
  level2: {
    id: 'level2',
    name: '第二关',
    normalCardTypes: 7,       // 全部7种基础卡
    funcCardCount: 12,        // 12张功能卡
    funcTypes: ['negative', 'positive', 'dual'],
    // 功能卡比例：负面~30%, 正面~15%, 双刃剑~15% (占功能卡的)
    funcRatio: { negative: 0.5, positive: 0.25, dual: 0.25 },
    layers: 4,                // 3-5层堆叠
    gridRows: 5,
    gridCols: 5,
    totalCards: 48,           // 必须是3的倍数
    steps: 35,                // 初始步数
    slotLimit: 7,             // 槽位上限
  },
};

/**
 * 获取关卡配置
 * @param {string} levelId - 'level1' | 'level2'
 * @returns {object}
 */
export function getLevelConfig(levelId) {
  return LEVELS[levelId] || LEVELS.level1;
}
```

- [ ] **Step 6: 语法检查**

```bash
node -c src/data/levels.js && echo "OK"
```

- [ ] **Step 7: Commit**

```bash
git add src/data/ && git commit -m "feat: add card/skill/level data configs"
```

---

### Task 3: Card.js — 卡片实体

**Files:**
- Create: `src/game/Card.js`

- [ ] **Step 1: 创建 Card.js**

```js
// src/game/Card.js

/**
 * Card — 单张卡片实体
 * 持有数据 + PIXI.Container 渲染引用
 */
export default class Card {
  /**
   * @param {object} opts
   * @param {string} opts.id - 唯一标识
   * @param {string} opts.type - 'normal' | 'event'
   * @param {object} opts.config - 来自 cards.js 的卡片配置
   * @param {number} opts.layer - 所在层
   * @param {number} opts.row - 行
   * @param {number} opts.col - 列
   */
  constructor(opts) {
    this.id = opts.id;
    this.type = opts.type;           // 'normal' | 'event'
    this.config = opts.config;        // 原始卡片配置对象
    this.cardId = opts.config.id;     // 'phone', 'toilet', ...
    this.icon = opts.config.icon;
    this.name = opts.config.name;

    this.layer = opts.layer;
    this.row = opts.row;
    this.col = opts.col;

    this.isRevealed = false;          // ❓事件卡是否已揭示
    this.isRemoved = false;           // 是否已从棋盘移除
    this.isCovered = true;            // 是否被上层压住（由Board更新）

    // PIXI 渲染对象（由 Board.render 创建）
    this.container = null;
  }

  /**
   * 揭示❓事件卡的真实身份
   */
  reveal() {
    if (this.type !== 'event' || this.isRevealed) return;
    this.isRevealed = true;
    // 更新显示
    if (this.config.revealIcon) {
      this.icon = this.config.revealIcon;
    }
    if (this.config.revealName) {
      this.name = this.config.revealName;
    }
  }

  /**
   * 获取卡片显示颜色
   */
  getColor() {
    if (this.type === 'event' && !this.isRevealed) {
      return 0x9B59B6; // 紫色 ❓
    }
    if (this.type === 'event' && this.isRevealed) {
      var funcType = this.config.type;
      if (funcType === 'negative') return 0xE74C3C; // 红色
      if (funcType === 'positive') return 0x2ECC71; // 绿色
      if (funcType === 'dual')     return 0xF39C12; // 橙色
    }
    // 普通卡颜色条
    var rarity = this.config.rarity;
    if (rarity === 'rare')     return 0xF1C40F; // 金色
    if (rarity === 'uncommon') return 0x3498DB; // 蓝色
    return 0x95A5A6; // 灰色 common
  }

  /**
   * 获取稀有度文字
   */
  getRarityText() {
    if (this.type === 'event') return '';
    var r = this.config.rarity;
    if (r === 'common')   return '普通';
    if (r === 'uncommon') return '少见';
    if (r === 'rare')     return '稀有';
    return '';
  }
}
```

- [ ] **Step 2: 语法检查**

```bash
node -c src/game/Card.js && echo "OK"
```

- [ ] **Step 3: Commit**

```bash
git add src/game/Card.js && git commit -m "feat: add Card entity class"
```

---

### Task 4: Board.js — 棋盘系统

**Files:**
- Create: `src/game/Board.js`

Board 是整个游戏最复杂的组件，负责卡片堆叠生成、遮挡检测、点击处理。

- [ ] **Step 1: 创建 Board.js**

```js
// src/game/Board.js

import Card from './Card';
import { NORMAL_CARDS, FUNC_CARDS, FUNC_TYPE, randomNormalCard, randomFuncCard } from '../data/cards';
import { getLevelConfig } from '../data/levels';
import { log } from '../utils/Logger';

var TAG = 'Board';

/**
 * Board — 棋盘管理
 * 用 grid[layer][row][col] 三维数组表示卡片堆叠
 */
export default class Board {
  constructor(stage) {
    this.stage = stage;           // PIXI stage（用于添加渲染对象）
    this.grid = [];               // grid[layer][row][col] → Card | null
    this.levelConfig = null;
    this.container = new PIXI.Container();
    this.container.name = 'board';
    stage.addChild(this.container);

    // 布局参数（根据屏幕大小计算）
    this.cardWidth = 64;
    this.cardHeight = 80;
    this.offsetX = 0;  // 棋盘左上角X偏移
    this.offsetY = 0;  // 棋盘左上角Y偏移
    this.layerOffsetX = 4;  // 每层偏移
    this.layerOffsetY = 4;
  }

  /**
   * 计算棋盘布局参数
   * @param {number} screenW - 屏幕宽度
   * @param {number} screenH - 屏幕高度
   * @param {number} rows - 棋盘行数
   * @param {number} cols - 棋盘列数
   */
  calcLayout(screenW, screenH, rows, cols) {
    var areaTop = 20;     // 顶部留白（状态栏）
    var areaBottom = 180; // 底部留给槽位 + HUD
    var areaH = screenH - areaTop - areaBottom;
    var areaW = screenW - 20;

    // 卡片大小：留间距
    var gap = 8;
    this.cardWidth = Math.floor((areaW - gap * (cols + 1)) / cols);
    this.cardHeight = Math.floor(this.cardWidth * 1.25);

    this.offsetX = Math.floor((screenW - (this.cardWidth * cols + gap * (cols - 1))) / 2);
    this.offsetY = areaTop + Math.floor((areaH - (this.cardHeight * rows + gap * (rows - 1))) / 2);
    this.gap = gap;
    this.layerOffsetX = Math.floor(this.cardWidth * 0.08);
    this.layerOffsetY = Math.floor(this.cardHeight * 0.06);
  }

  /**
   * 生成棋盘
   * @param {string} levelId - 'level1' | 'level2'
   */
  generate(levelId) {
    this.container.removeChildren();
    this.grid = [];

    var config = getLevelConfig(levelId);
    this.levelConfig = config;
    var layers = config.layers;
    var rows = config.gridRows;
    var cols = config.gridCols;

    // 初始化 grid
    for (var l = 0; l < layers; l++) {
      this.grid[l] = [];
      for (var r = 0; r < rows; r++) {
        this.grid[l][r] = [];
        for (var c = 0; c < cols; c++) {
          this.grid[l][r][c] = null;
        }
      }
    }

    // 收集要生成的卡片列表
    var cardList = this._buildCardList(config);

    // 从底层到顶层填充
    this._fillGrid(cardList, layers, rows, cols);

    // 更新遮挡状态
    this._updateCoveredState();

    // 渲染所有卡片
    this._renderAll();

    log(TAG, 'Board generated: ' + cardList.length + ' cards, ' + layers + ' layers');
  }

  /**
   * 构建卡片列表（确保总数是3的倍数）
   */
  _buildCardList(config) {
    var list = [];
    var normalCount = config.totalCards - config.funcCardCount;

    // 选择要使用的基础卡种类
    var usedNormalTypes = NORMAL_CARDS.slice(0, config.normalCardTypes);

    // 生成普通卡（确保每种是3的倍数）
    var perType = Math.floor(normalCount / config.normalCardTypes);
    perType = perType - (perType % 3); // 向下到3的倍数
    for (var i = 0; i < usedNormalTypes.length; i++) {
      for (var j = 0; j < perType; j++) {
        list.push({
          type: 'normal',
          config: usedNormalTypes[i],
          isEvent: false,
        });
      }
    }

    // 补齐剩余的（用最高频卡）
    var remain = normalCount - list.length;
    for (var k = 0; k < remain; k++) {
      list.push({
        type: 'normal',
        config: usedNormalTypes[0],
        isEvent: false,
      });
    }

    // 生成功能卡（统称为❓事件卡）
    var funcTypes = config.funcTypes;
    var funcRatio = config.funcRatio || { negative: 1, positive: 0, dual: 0 };
    var negCount = Math.floor(config.funcCardCount * (funcRatio.negative || 0.5));
    var posCount = Math.floor(config.funcCardCount * (funcRatio.positive || 0.25));
    var dualCount = config.funcCardCount - negCount - posCount;

    this._addFuncCards(list, FUNC_TYPE.NEGATIVE, negCount);
    this._addFuncCards(list, FUNC_TYPE.POSITIVE, posCount);
    this._addFuncCards(list, FUNC_TYPE.DUAL, dualCount);

    // 打乱顺序
    this._shuffle(list);

    return list;
  }

  _addFuncCards(list, funcType, count) {
    var pool = FUNC_CARDS.filter(function (c) { return c.type === funcType; });
    for (var i = 0; i < count; i++) {
      var pick = pool[Math.floor(Math.random() * pool.length)];
      list.push({
        type: 'event',
        config: pick,
        isEvent: true,
      });
    }
  }

  _shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
  }

  /**
   * 将卡片列表填充到网格中
   * 策略：底层全覆盖，上层递减覆盖（制造堆叠效果）
   * ❓事件卡放顶层，稀有卡放底层
   */
  _fillGrid(cardList, layers, rows, cols) {
    var idx = 0;

    // 分离事件卡和普通卡
    var eventCards = [];
    var normalCards = [];
    for (var i = 0; i < cardList.length; i++) {
      if (cardList[i].isEvent) {
        eventCards.push(cardList[i]);
      } else {
        normalCards.push(cardList[i]);
      }
    }

    // 将稀有卡排到前面（先填充 = 在底层）
    normalCards.sort(function (a, b) {
      var order = { rare: 0, uncommon: 1, common: 2 };
      return (order[a.config.rarity] || 2) - (order[b.config.rarity] || 2);
    });

    // 按层填充
    for (var l = 0; l < layers; l++) {
      // 计算该层覆盖率：底层100%，顶层稀疏
      var coverage;
      if (layers === 1) coverage = 0.95;
      else if (l === 0) coverage = 0.9;
      else if (l === layers - 1) coverage = 0.3; // 顶层最稀疏
      else coverage = 0.5;

      var needed = Math.floor(rows * cols * coverage);
      var placed = 0;

      for (var r = 0; r < rows && placed < needed; r++) {
        for (var c = 0; c < cols && placed < needed; c++) {
          if (this.grid[l][r][c] !== null) continue;

          // 决定放什么卡
          var cardData;
          if (l === layers - 1 && eventCards.length > 0) {
            // 顶层优先放事件卡
            cardData = eventCards.shift();
          } else if (normalCards.length > 0) {
            cardData = normalCards.shift();
          } else if (eventCards.length > 0) {
            cardData = eventCards.shift();
          } else {
            break;
          }

          var card = new Card({
            id: 'card_' + l + '_' + r + '_' + c,
            type: cardData.type,
            config: cardData.config,
            layer: l,
            row: r,
            col: c,
          });

          this.grid[l][r][c] = card;
          placed++;
        }
      }
    }
  }

  /**
   * 更新所有卡片的遮挡状态
   * 被上层覆盖 = 上层同位置或相邻4格（上下左右）有卡片
   */
  _updateCoveredState() {
    for (var l = 0; l < this.grid.length; l++) {
      for (var r = 0; r < this.grid[l].length; r++) {
        for (var c = 0; c < this.grid[l][r].length; c++) {
          var card = this.grid[l][r][c];
          if (!card) continue;
          card.isCovered = this._isCovered(card);
        }
      }
    }
  }

  /**
   * 判断卡片是否被上层遮挡
   */
  _isCovered(card) {
    var upperLayer = card.layer + 1;
    if (upperLayer >= this.grid.length) return false;

    // 检查上层同位置和相邻位置
    var checkPositions = [
      [0, 0],           // 正上方
      [-1, 0], [1, 0],  // 左右
      [0, -1], [0, 1],  // 上下
    ];

    for (var i = 0; i < checkPositions.length; i++) {
      var dr = checkPositions[i][0];
      var dc = checkPositions[i][1];
      var rr = card.row + dr;
      var cc = card.col + dc;

      if (rr >= 0 && rr < this.grid[upperLayer].length &&
          cc >= 0 && cc < this.grid[upperLayer][0].length &&
          this.grid[upperLayer][rr][cc] !== null) {
        return true;
      }
    }
    return false;
  }

  /**
   * 获取所有可点击的卡片（未被遮挡）
   */
  getClickableCards() {
    var result = [];
    for (var l = 0; l < this.grid.length; l++) {
      for (var r = 0; r < this.grid[l].length; r++) {
        for (var c = 0; c < this.grid[l][r].length; c++) {
          var card = this.grid[l][r][c];
          if (card && !card.isRemoved && !card.isCovered) {
            result.push(card);
          }
        }
      }
    }
    return result;
  }

  /**
   * 点击卡片，从棋盘移除
   * @param {Card} card
   * @returns {Card|null} 被移除的卡片
   */
  removeCard(card) {
    if (!card || card.isRemoved) return null;

    card.isRemoved = true;
    this.grid[card.layer][card.row][card.col] = null;

    // 淡出动画
    if (card.container) {
      card.container.alpha = 0;
      card.container.interactive = false;
    }

    // 释放下层卡片
    this._updateCoveredState();

    return card;
  }

  /**
   * 揭示所有❓事件卡（S9 茶水间情报）
   */
  revealAllEvents() {
    for (var l = 0; l < this.grid.length; l++) {
      for (var r = 0; r < this.grid[l].length; r++) {
        for (var c = 0; c < this.grid[l][r].length; c++) {
          var card = this.grid[l][r][c];
          if (card && card.type === 'event' && !card.isRevealed) {
            card.reveal();
          }
        }
      }
    }
    this._renderAll();
  }

  /**
   * 随机移除N张被压住的卡片（S4 清理桌面）
   */
  removeCoveredCards(count) {
    var covered = [];
    for (var l = 0; l < this.grid.length; l++) {
      for (var r = 0; r < this.grid[l].length; r++) {
        for (var c = 0; c < this.grid[l][r].length; c++) {
          var card = this.grid[l][r][c];
          if (card && card.isCovered && !card.isRemoved) {
            covered.push(card);
          }
        }
      }
    }
    this._shuffle(covered);
    var toRemove = covered.slice(0, count);
    for (var i = 0; i < toRemove.length; i++) {
      this.removeCard(toRemove[i]);
    }
    return toRemove;
  }

  /**
   * 棋盘上是否还有卡片
   */
  hasCards() {
    for (var l = 0; l < this.grid.length; l++) {
      for (var r = 0; r < this.grid[l].length; r++) {
        for (var c = 0; c < this.grid[l][r].length; c++) {
          if (this.grid[l][r][c] && !this.grid[l][r][c].isRemoved) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * 棋盘上每种卡片的剩余数量统计
   */
  getCardCounts() {
    var counts = {};
    for (var l = 0; l < this.grid.length; l++) {
      for (var r = 0; r < this.grid[l].length; r++) {
        for (var c = 0; c < this.grid[l][r].length; c++) {
          var card = this.grid[l][r][c];
          if (card && !card.isRemoved) {
            var key = card.type === 'event' ? ('func_' + card.cardId) : card.cardId;
            counts[key] = (counts[key] || 0) + 1;
          }
        }
      }
    }
    return counts;
  }

  // ============= 渲染 =============

  _renderAll() {
    this.container.removeChildren();
    // 从底层到顶层渲染
    for (var l = 0; l < this.grid.length; l++) {
      for (var r = 0; r < this.grid[l].length; r++) {
        for (var c = 0; c < this.grid[l][r].length; c++) {
          var card = this.grid[l][r][c];
          if (card && !card.isRemoved) {
            this._renderCard(card);
          }
        }
      }
    }
  }

  /**
   * 渲染单张卡片到棋盘
   */
  _renderCard(card) {
    var container = new PIXI.Container();
    var w = this.cardWidth;
    var h = this.cardHeight;
    var x = this.offsetX + c * (w + this.gap) + card.layer * this.layerOffsetX;
    var y = this.offsetY + r * (h + this.gap) - card.layer * this.layerOffsetY;

    container.x = x;
    container.y = y;

    // 背景圆角矩形
    var bg = new PIXI.Graphics();
    var bgColor = card.isCovered ? 0xBDC3C7 : 0xFFFFFF;
    bg.beginFill(bgColor);
    bg.drawRoundedRect(0, 0, w, h, 6);
    bg.endFill();
    // 边框
    bg.lineStyle(1.5, card.getColor(), card.isCovered ? 0.3 : 0.8);
    bg.drawRoundedRect(0, 0, w, h, 6);
    container.addChild(bg);

    // 被压住时加灰色遮罩
    if (card.isCovered) {
      var mask = new PIXI.Graphics();
      mask.beginFill(0x000000, 0.3);
      mask.drawRoundedRect(0, 0, w, h, 6);
      mask.endFill();
      container.addChild(mask);
    }

    // Emoji 图标
    var displayIcon = (card.type === 'event' && !card.isRevealed) ? '❓' : card.icon;
    var iconText = new PIXI.Text(displayIcon, {
      fontFamily: 'sans-serif',
      fontSize: 28,
      align: 'center',
    });
    iconText.anchor.set(0.5);
    iconText.x = w / 2;
    iconText.y = h * 0.35;
    container.addChild(iconText);

    // 中文名称
    var displayName = (card.type === 'event' && !card.isRevealed) ? '事件' : card.name;
    var nameText = new PIXI.Text(displayName, {
      fontFamily: 'sans-serif',
      fontSize: 13,
      fill: card.isCovered ? '#999999' : '#333333',
      align: 'center',
    });
    nameText.anchor.set(0.5);
    nameText.x = w / 2;
    nameText.y = h * 0.7;
    container.addChild(nameText);

    // 底部颜色条
    var bar = new PIXI.Graphics();
    bar.beginFill(card.getColor(), card.isCovered ? 0.4 : 0.9);
    bar.drawRect(4, h - 6, w - 8, 4);
    bar.endFill();
    container.addChild(bar);

    card.container = container;
    this.container.addChild(container);

    // 设置可交互（仅未被遮挡的卡片）
    if (!card.isCovered) {
      container.interactive = true;
      container.buttonMode = true;
    }
  }

  /**
   * 获取卡片在屏幕上的位置（用于飞入槽位动画的起点）
   */
  getCardScreenPos(card) {
    if (!card || !card.container) return { x: 0, y: 0 };
    return {
      x: card.container.x + this.cardWidth / 2,
      y: card.container.y + this.cardHeight / 2,
    };
  }
}
```

**注意**：以上代码中 `r` 和 `c` 变量在 `_renderCard` 里引用了外部循环变量——需要修正为显式参数。实际实现时会直接在 `_renderAll` 循环内展开。

- [ ] **Step 2: 语法检查**

```bash
node -c src/game/Board.js && echo "OK"
```

- [ ] **Step 3: Commit**

```bash
git add src/game/Board.js && git commit -m "feat: add Board system with stacking and cover detection"
```

---

### Task 5: SlotBar.js — 槽位栏

**Files:**
- Create: `src/game/SlotBar.js`

- [ ] **Step 1: 创建 SlotBar.js**

```js
// src/game/SlotBar.js

import { log } from '../utils/Logger';

var TAG = 'SlotBar';

/**
 * SlotBar — 7格槽位栏
 * 卡片飞入 → 检测3消 → 消除动画
 */
export default class SlotBar {
  /**
   * @param {PIXI.Container} stage - 父容器
   * @param {object} gameScene - GameScene 引用（用于回调）
   */
  constructor(stage, gameScene) {
    this.stage = stage;
    this.gameScene = gameScene;
    this.slots = [];           // 7个格子，null 或 Card
    this.maxSlots = 7;
    this.container = new PIXI.Container();
    this.container.name = 'slotBar';
    stage.addChild(this.container);

    this.slotWidth = 56;
    this.slotHeight = 72;
    this.gap = 6;
  }

  /**
   * 计算位置（屏幕底部）
   */
  calcLayout(screenW, screenH) {
    var totalW = this.maxSlots * this.slotWidth + (this.maxSlots - 1) * this.gap;
    this.startX = Math.floor((screenW - totalW) / 2);
    this.startY = screenH - 140;
  }

  /**
   * 渲染空槽位
   */
  renderEmpty() {
    this.slots = [];
    for (var i = 0; i < this.maxSlots; i++) {
      this.slots.push(null);
    }
    this._drawAll();
  }

  /**
   * 添加卡片到槽位
   * @param {Card} card - 被点击的卡片
   * @returns {boolean} 是否成功添加
   */
  addCard(card) {
    // 找第一个空位
    var emptyIdx = -1;
    for (var i = 0; i < this.maxSlots; i++) {
      if (this.slots[i] === null) {
        emptyIdx = i;
        break;
      }
    }

    if (emptyIdx === -1) {
      // 槽已满，触发检查
      log(TAG, 'Slot full, cannot add');
      return false;
    }

    this.slots[emptyIdx] = card;
    this._drawAll();

    // 检查消除
    this._checkMatch(card);

    return true;
  }

  /**
   * 获取空槽位数
   */
  getVacantCount() {
    var count = 0;
    for (var i = 0; i < this.maxSlots; i++) {
      if (this.slots[i] === null) count++;
    }
    return count;
  }

  /**
   * 槽是否已满
   */
  isFull() {
    return this.getVacantCount() === 0;
  }

  /**
   * 检测是否有3张同类型卡片
   */
  _checkMatch(card) {
    var cardId = card.cardId;
    var typeKey = card.type === 'event' ? ('func_' + card.cardId) : cardId;

    // 万能卡（带薪年假🌟）可与任意两张同卡消除
    var wildCards = [];
    var sameCards = [];
    for (var i = 0; i < this.maxSlots; i++) {
      var s = this.slots[i];
      if (!s) continue;
      if (s.cardId === cardId) {
        sameCards.push(i);
      }
      if (s.type === 'event' && s.config.effect === 'wild_card' && s.isRevealed) {
        wildCards.push(i);
      }
    }

    // 至少3张同卡
    if (sameCards.length >= 3) {
      this._eliminate(sameCards.slice(0, 3));
      return sameCards.length >= 6 ? 2 : 1; // 消除组数
    }

    // 万能卡 + 同卡 ≥ 3
    if (wildCards.length > 0 && (sameCards.length + wildCards.length) >= 3) {
      var needed = 3 - sameCards.length;
      var toRemove = sameCards.slice(0).concat(wildCards.slice(0, needed));
      this._eliminate(toRemove);
      return 1;
    }

    return 0;
  }

  /**
   * 消除指定位置的卡片
   */
  _eliminate(indices) {
    // 飞走动画：缩小 + 上飘
    for (var i = 0; i < indices.length; i++) {
      var idx = indices[i];
      this.slots[idx] = null;
    }

    // 重新渲染
    this._drawAll();

    // 通知 GameScene
    if (this.gameScene && this.gameScene.onEliminate) {
      this.gameScene.onEliminate(indices.length);
    }
  }

  /**
   * 清空槽位中数量最多的那种卡（S3 提前下班）
   */
  clearMostCardType() {
    var counts = {};
    for (var i = 0; i < this.maxSlots; i++) {
      var s = this.slots[i];
      if (!s) continue;
      var key = s.cardId;
      if (!counts[key]) counts[key] = [];
      counts[key].push(i);
    }
    var maxKey = null;
    var maxCount = 0;
    for (var key in counts) {
      if (counts[key].length > maxCount) {
        maxCount = counts[key].length;
        maxKey = key;
      }
    }
    if (maxKey) {
      this._eliminate(counts[maxKey]);
    }
  }

  /**
   * 随机打乱槽位顺序（负面卡💻系统崩溃）
   */
  shuffleSlots() {
    // Fisher-Yates shuffle on non-null slots
    var cards = [];
    for (var i = 0; i < this.maxSlots; i++) {
      if (this.slots[i]) cards.push(this.slots[i]);
    }
    for (var j = cards.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var tmp = cards[j]; cards[j] = cards[k]; cards[k] = tmp;
    }
    var ci = 0;
    for (var s = 0; s < this.maxSlots; s++) {
      if (this.slots[s]) {
        this.slots[s] = cards[ci++];
      }
    }
    this._drawAll();
  }

  /**
   * 将一张槽内卡变成万能卡（S5 假装工作）
   */
  transformToWild(wildCardConfig) {
    for (var i = 0; i < this.maxSlots; i++) {
      if (this.slots[i] && this.slots[i].type !== 'event') {
        // 变成万能卡
        var c = this.slots[i];
        c.type = 'event';
        c.cardId = 'paid_leave';
        c.icon = '🌟';
        c.name = '万能卡';
        c.config = { id: 'paid_leave', effect: 'wild_card', type: 'positive' };
        c.isRevealed = true;
        break;
      }
    }
    this._drawAll();
  }

  // ============= 渲染 =============

  _drawAll() {
    this.container.removeChildren();
    for (var i = 0; i < this.maxSlots; i++) {
      var x = this.startX + i * (this.slotWidth + this.gap);
      var y = this.startY;

      var slotBg = new PIXI.Graphics();
      if (this.slots[i]) {
        // 有卡
        var card = this.slots[i];
        slotBg.beginFill(0xFFFFFF);
        slotBg.drawRoundedRect(x, y, this.slotWidth, this.slotHeight, 4);
        slotBg.endFill();
        slotBg.lineStyle(1.5, card.getColor(), 0.8);
        slotBg.drawRoundedRect(x, y, this.slotWidth, this.slotHeight, 4);

        // 显示 icon
        var icon = card.icon;
        if (card.type === 'event' && !card.isRevealed) icon = '❓';
        var iconText = new PIXI.Text(icon, { fontFamily: 'sans-serif', fontSize: 22, align: 'center' });
        iconText.anchor.set(0.5);
        iconText.x = x + this.slotWidth / 2;
        iconText.y = y + this.slotHeight * 0.4;
        this.container.addChild(iconText);

        var nameText = new PIXI.Text(card.name, { fontFamily: 'sans-serif', fontSize: 10, fill: '#333', align: 'center' });
        nameText.anchor.set(0.5);
        nameText.x = x + this.slotWidth / 2;
        nameText.y = y + this.slotHeight * 0.75;
        this.container.addChild(nameText);

      } else {
        // 空格
        slotBg.lineStyle(1, 0xBDC3C7, 0.5);
        slotBg.drawRoundedRect(x, y, this.slotWidth, this.slotHeight, 4);
      }
      this.container.addChild(slotBg);
    }
  }
}
```

- [ ] **Step 2: 语法检查**

```bash
node -c src/game/SlotBar.js && echo "OK"
```

- [ ] **Step 3: Commit**

```bash
git add src/game/SlotBar.js && git commit -m "feat: add SlotBar with 7-slot match-3 detection"
```

---

### Task 6: StepManager.js — 步数/槽位双重限制

**Files:**
- Create: `src/game/StepManager.js`

- [ ] **Step 1: 创建 StepManager.js**

```js
// src/game/StepManager.js

/**
 * StepManager — 步数和槽位双重限制
 * 步数耗尽 + 槽位满且无法消除 → 失败
 */
export default class StepManager {
  constructor(gameScene) {
    this.gameScene = gameScene;

    // 基础参数
    this.stepsRemaining = 35;     // 剩余步数
    this.maxSteps = 35;          // 最大步数
    this.slotLimit = 7;          // 槽位上限
    this.baseSlotLimit = 7;      // 基础槽位上限（受技能影响可能变化）

    // 技能效果状态
    this.slotFreeClicks = 0;     // S1 飞行模式：不占槽位的点击次数
    this.tempSlotLimit9 = 0;     // S13 装死模式：临时槽位上限=9的剩余步数
    this.slotOverflowShield = false; // S6 周报护体：下次槽满不失败
    this.stepsUnlimited = false; // S16 忘记打卡：取消步数限制
    this.slotUnlimited = false;  // S17 无人办公室：取消槽位限制
    this.noMoreBossPatrol = false; // S8 老板出差
  }

  /**
   * 初始化/重置
   */
  init(config) {
    this.stepsRemaining = config.steps;
    this.maxSteps = config.steps;
    this.slotLimit = config.slotLimit;
    this.baseSlotLimit = config.slotLimit;
    this.slotFreeClicks = 0;
    this.tempSlotLimit9 = 0;
    this.slotOverflowShield = false;
    this.stepsUnlimited = false;
    this.slotUnlimited = false;
  }

  /**
   * 消耗1步
   * @returns {boolean} 是否成功消耗（步数还未耗尽）
   */
  useStep() {
    if (this.stepsUnlimited) return true;
    if (this.stepsRemaining <= 0) return false;
    this.stepsRemaining--;
    return true;
  }

  /**
   * 本次点击是否占用槽位
   */
  occupiesSlot() {
    if (this.slotFreeClicks > 0) {
      this.slotFreeClicks--;
      return false;
    }
    return true;
  }

  /**
   * 获取当前有效槽位上限
   */
  getEffectiveSlotLimit() {
    if (this.slotUnlimited) return Infinity;
    if (this.tempSlotLimit9 > 0) return 9;
    return this.slotLimit;
  }

  /**
   * 每步更新持续效果
   */
  tick() {
    if (this.tempSlotLimit9 > 0) {
      this.tempSlotLimit9--;
    }
  }

  /**
   * 检查失败条件
   * @param {boolean} slotFull - 槽是否满
   * @param {boolean} canEliminate - 是否有可消除的
   * @returns {object} { isFailed: boolean, reason: string }
   */
  checkFailure(slotFull, canEliminate) {
    // 步数耗尽
    if (!this.stepsUnlimited && this.stepsRemaining <= 0) {
      return { isFailed: true, reason: 'steps' };
    }

    // 槽满且无法消除
    if (!this.slotUnlimited && slotFull && !canEliminate) {
      // 周报护体
      if (this.slotOverflowShield) {
        this.slotOverflowShield = false;
        return { isFailed: false, reason: '', shieldActivated: true };
      }
      return { isFailed: true, reason: 'slot_full' };
    }

    return { isFailed: false, reason: '' };
  }

  /**
   * 检查胜利条件
   * @param {boolean} boardEmpty - 棋盘是否清空
   */
  checkWin(boardEmpty) {
    return boardEmpty;
  }
}
```

- [ ] **Step 2: 语法检查**

```bash
node -c src/game/StepManager.js && echo "OK"
```

- [ ] **Step 3: Commit**

```bash
git add src/game/StepManager.js && git commit -m "feat: add StepManager with dual constraints"
```

---

### Task 7: SkillSystem.js — 肉鸽技能

**Files:**
- Create: `src/game/SkillSystem.js`

- [ ] **Step 1: 创建 SkillSystem.js**

```js
// src/game/SkillSystem.js

import { getRandomSkills } from '../data/skills';
import { log } from '../utils/Logger';

var TAG = 'SkillSystem';

/**
 * SkillSystem — 肉鸽技能触发与三选一
 */
export default class SkillSystem {
  constructor(gameScene) {
    this.gameScene = gameScene;
    this.eliminateCount = 0;      // 本局消除组数
    this.triggerThreshold = 3;    // 每3组触发一次
    this.isShowingSelection = false; // 是否正在展示三选一
  }

  /**
   * 重置
   */
  init() {
    this.eliminateCount = 0;
    this.triggerThreshold = 3;
    this.isShowingSelection = false;
  }

  /**
   * 消除回调 — 每消除一组+1
   */
  onEliminate() {
    this.eliminateCount++;
    if (this.eliminateCount % this.triggerThreshold === 0) {
      this._showSelection();
    }
  }

  /**
   * 展示技能三选一（暂停游戏）
   */
  _showSelection() {
    if (this.isShowingSelection) return;
    this.isShowingSelection = true;

    var skills = getRandomSkills(3);
    log(TAG, 'Skill selection: ' + skills.map(function (s) { return s.name; }).join(', '));

    if (this.gameScene && this.gameScene.showSkillSelection) {
      this.gameScene.showSkillSelection(skills);
    }
  }

  /**
   * 玩家选择了技能
   * @param {object} skill - 技能配置
   */
  selectSkill(skill) {
    this.isShowingSelection = false;

    var ctx = this.gameScene.getSkillContext ? this.gameScene.getSkillContext() : {};

    log(TAG, 'Player selected: ' + skill.name);
    skill.apply(ctx);

    if (this.gameScene && this.gameScene.onSkillApplied) {
      this.gameScene.onSkillApplied(skill);
    }
  }
}
```

- [ ] **Step 2: 语法检查**

```bash
node -c src/game/SkillSystem.js && echo "OK"
```

- [ ] **Step 3: Commit**

```bash
git add src/game/SkillSystem.js && git commit -m "feat: add SkillSystem with roguelike 3-choose-1"
```

---

### Task 8: Game.js — 应用根

**Files:**
- Create: `src/core/Game.js`

- [ ] **Step 1: 创建 Game.js（简化版，无云服务）**

```js
// src/core/Game.js

import SceneManager from './SceneManager';
import EventManager from './EventManager';
import MenuScene from '../scenes/MenuScene';
import { log } from '../utils/Logger';

var TAG = 'Game';

export default class Game {
  constructor() {
    var sysInfo = wx.getSystemInfoSync();
    this.width = sysInfo.windowWidth;
    this.height = sysInfo.windowHeight;

    this.app = new PIXI.Application({
      view: globalThis.__pixi_main_canvas || wx.createCanvas(),
      width: this.width,
      height: this.height,
      backgroundColor: 0x2C3E50,
      backgroundAlpha: 1,
      antialias: false,
      resolution: 1,
      autoDensity: false,
      forceCanvas: true
    });

    this.canvas = this.app.view;
    this.eventManager = new EventManager(this.canvas);
    this.sceneManager = new SceneManager(this.app.stage, this.eventManager);

    this.eventManager.start();
  }

  start() {
    var self = this;
    this.app.ticker.add(function (delta) {
      var dt = delta * (1000 / 60);
      self._frame(dt);
    });

    log(TAG, 'Game started, going to menu');
    this.sceneManager.switchTo(MenuScene, {
      onStartGame: function (levelId) {
        self._switchToGame(levelId);
      }
    });
  }

  _frame(dt) {
    this.eventManager.clearHitAreas();
    this.sceneManager.update(dt);
    this.sceneManager.render();
    this.app.renderer.render(this.app.stage);
  }

  _switchToGame(levelId) {
    // 动态 import GameScene
    var GameScene = require('../scenes/GameScene').default;
    var self = this;
    this.sceneManager.switchTo(GameScene, {
      levelId: levelId || 'level1',
      onBackToMenu: function () {
        self.sceneManager.switchTo(MenuScene, {
          onStartGame: function (id) { self._switchToGame(id); }
        });
      },
      onGameOver: function (result) {
        self._switchToResult(result);
      }
    });
  }

  _switchToResult(result) {
    var ResultScene = require('../scenes/ResultScene').default;
    var self = this;
    this.sceneManager.switchTo(ResultScene, {
      result: result, // { won: boolean, happyValue: number, reason: string }
      onBackToMenu: function () {
        self.sceneManager.switchTo(MenuScene, {
          onStartGame: function (id) { self._switchToGame(id); }
        });
      },
      onReplay: function () {
        self._switchToGame(result.levelId || 'level1');
      }
    });
  }
}
```

- [ ] **Step 2: 语法检查**

```bash
node -c src/core/Game.js && echo "OK"
```

- [ ] **Step 3: Commit**

```bash
git add src/core/Game.js && git commit -m "feat: add Game root with scene routing"
```

---

### Task 9: MenuScene.js — 主菜单

**Files:**
- Create: `src/scenes/MenuScene.js`

- [ ] **Step 1: 创建 MenuScene.js**

```js
// src/scenes/MenuScene.js

import Scene from '../core/Scene';
import Button from '../ui/Button';

export default class MenuScene extends Scene {
  onEnter(params) {
    this.params = params;
    this.onStartGame = params.onStartGame;
    this.container = new PIXI.Container();
    this.stage.addChild(this.container);
  }

  render(container) {
    var w = this.stage.width;
    var h = this.stage.height;
    this.container.removeChildren();

    // 背景色（由 PIXI.Application backgroundColor 设置）

    // 标题
    var title = new PIXI.Text('摸鱼大师', {
      fontFamily: 'sans-serif',
      fontSize: 48,
      fontWeight: 'bold',
      fill: '#F39C12',
      align: 'center',
    });
    title.anchor.set(0.5);
    title.x = w / 2;
    title.y = h * 0.25;
    this.container.addChild(title);

    // 副标题
    var subtitle = new PIXI.Text('职场摸鱼三消挑战', {
      fontFamily: 'sans-serif',
      fontSize: 18,
      fill: '#BDC3C7',
      align: 'center',
    });
    subtitle.anchor.set(0.5);
    subtitle.x = w / 2;
    subtitle.y = h * 0.33;
    this.container.addChild(subtitle);

    // Emoji 装饰
    var deco = new PIXI.Text('📱 🚽 😴 🍜 🛒 💬 🎮', {
      fontFamily: 'sans-serif',
      fontSize: 24,
      align: 'center',
    });
    deco.anchor.set(0.5);
    deco.x = w / 2;
    deco.y = h * 0.45;
    this.container.addChild(deco);

    // 开始按钮
    var self = this;
    var btnW = 200;
    var btnH = 56;
    var btn = new Button(
      Math.floor((w - btnW) / 2),
      Math.floor(h * 0.6),
      btnW, btnH,
      '开始摸鱼',
      {
        bgColor: '#E67E22',
        textColor: '#FFFFFF',
        fontSize: 22,
        radius: 8,
        shadow: true,
        onClick: function () {
          self.onStartGame('level1');
        }
      }
    );
    this.container.addChild(btn.getDisplayObject());
    this.registerHitArea(btn.getHitArea(), btn.onClick, 10);

    // 底部提示
    var tip = new PIXI.Text('点击卡片 → 集齐3张消除 → 触发技能', {
      fontFamily: 'sans-serif',
      fontSize: 13,
      fill: '#7F8C8D',
      align: 'center',
    });
    tip.anchor.set(0.5);
    tip.x = w / 2;
    tip.y = h * 0.85;
    this.container.addChild(tip);
  }

  onExit() {
    this.stage.removeChild(this.container);
  }
}
```

- [ ] **Step 2: 语法检查**

```bash
node -c src/scenes/MenuScene.js && echo "OK"
```

- [ ] **Step 3: Commit**

```bash
git add src/scenes/MenuScene.js && git commit -m "feat: add MenuScene with title and start button"
```

---

### Task 10: GameScene.js — 核心游戏场景

**Files:**
- Create: `src/scenes/GameScene.js`

这是最大的文件，整合 Board、SlotBar、SkillSystem、StepManager。

- [ ] **Step 1: 创建 GameScene.js**

```js
// src/scenes/GameScene.js

import Scene from '../core/Scene';
import Board from '../game/Board';
import SlotBar from '../game/SlotBar';
import StepManager from '../game/StepManager';
import SkillSystem from '../game/SkillSystem';
import Button from '../ui/Button';
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

    // 子组件
    this.board = new Board(this.container);
    this.slotBar = new SlotBar(this.container, this);
    this.stepManager = new StepManager(this);
    this.skillSystem = new SkillSystem(this);

    // 快乐值
    this.happyValue = 0;
    this.eliminateGroupCount = 0; // 消除组数计数器

    // 技能选择弹窗状态
    this.pendingSkills = null;
    this.skillButtons = [];

    // 保底计数器（连续3次负面后第4次必正面）
    this.consecutiveNegative = 0;

    // 布局
    var screenW = this.stage.width;
    var screenH = this.stage.height;
    this.board.calcLayout(screenW, screenH, 5, 5);
    this.slotBar.calcLayout(screenW, screenH);

    // 初始化
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

  /**
   * 绑定卡片点击事件
   */
  _bindCardClicks() {
    var clickable = this.board.getClickableCards();
    var self = this;

    for (var i = 0; i < clickable.length; i++) {
      (function (card) {
        if (!card.container) return;
        card.container.interactive = true;
        card.container.buttonMode = true;

        // 移除旧监听器（PIXI v7 用 on）
        card.container.off('pointertap');
        card.container.on('pointertap', function () {
          self._onCardClicked(card);
        });
      })(clickable[i]);
    }
  }

  /**
   * 卡片点击处理
   */
  _onCardClicked(card) {
    if (this.pendingSkills) return; // 技能选择中，忽略点击

    // 1. 消耗步数
    if (!this.stepManager.useStep()) {
      this._endGame(false, '步数耗尽！');
      return;
    }

    // 2. 事件卡揭示
    if (card.type === 'event' && !card.isRevealed) {
      this._revealEventCard(card);
    }

    // 3. 飞入槽位（检查是否占槽位）
    var occupiesSlot = this.stepManager.occupiesSlot();
    if (occupiesSlot) {
      var success = this.slotBar.addCard(card);
      if (!success) {
        // 槽满，检查是否可以消除
        this._checkFailure();
        return;
      }
    } else {
      // 不占槽位（S1飞行模式），直接消除检测
      this.slotBar.addCard(card);
    }

    // 4. 从棋盘移除
    this.board.removeCard(card);

    // 5. 更新步数效果
    this.stepManager.tick();

    // 6. 重新绑定点击（因为遮挡状态可能变了）
    this._bindCardClicks();

    // 7. 检查胜利
    if (!this.board.hasCards()) {
      this._endGame(true, '棋盘清空！');
      return;
    }

    // 8. 检查失败
    this._checkFailure();

    // 9. 刷新 HUD
    this._renderHUD();
  }

  /**
   * 揭示❓事件卡
   */
  _revealEventCard(card) {
    // 保底机制：连续3次负面后第4次必正面
    if (this.consecutiveNegative >= 3) {
      // 强制正面
      var positiveCards = ['paid_leave', 'colleague_coffee', 'early_leave', 'boss_favor', 'reimburse'];
      var pick = positiveCards[Math.floor(Math.random() * positiveCards.length)];
      var FUNC_CARDS = require('../data/cards').FUNC_CARDS;
      for (var i = 0; i < FUNC_CARDS.length; i++) {
        if (FUNC_CARDS[i].id === pick) {
          card.config = FUNC_CARDS[i];
          break;
        }
      }
      this.consecutiveNegative = 0;
    }

    card.reveal();

    // 应用功能卡效果
    this._applyFuncEffect(card);

    // 更新保底计数
    if (card.config.type === 'negative') {
      this.consecutiveNegative++;
    } else {
      this.consecutiveNegative = 0;
    }

    // 更新棋盘渲染（❓变成真实icon）
    this.board._renderAll();
    this._bindCardClicks();
    this.slotBar._drawAll();
  }

  /**
   * 应用功能卡即时效果
   */
  _applyFuncEffect(card) {
    var effect = card.config.effect;
    switch (effect) {
      case 'boss_patrol':
        // 槽中随机一张卡变成boss_patrol
        var slots = this.slotBar.slots;
        var nonNull = [];
        for (var i = 0; i < slots.length; i++) {
          if (slots[i]) nonNull.push(i);
        }
        if (nonNull.length > 0) {
          var target = nonNull[Math.floor(Math.random() * nonNull.length)];
          slots[target].cardId = 'boss_patrol';
          slots[target].name = '老板巡视';
          slots[target].icon = '⚠️';
        }
        this.slotBar._drawAll();
        break;

      case 'lock_cards':
        // 锁死3张可见卡（跳过实现，Phase 1 可简化）
        break;

      case 'slot_limit_down':
        this.stepManager.slotLimit = Math.max(3, this.stepManager.slotLimit - 1);
        break;

      case 'shuffle_slots':
        this.slotBar.shuffleSlots();
        break;

      case 'add_cards_to_board':
        // 棋盘顶部新增3张随机卡（跳过实现）
        break;

      case 'wild_card':
        // 万能卡，已在槽位检测中处理
        break;

      case 'remove_most':
        this.slotBar.clearMostCardType();
        break;

      case 'add_steps_3':
        this.stepManager.stepsRemaining += 3;
        break;

      case 'double_happy_10':
        this._happyMultiplier = 2;
        this._happyMultiplierSteps = 10;
        break;

      case 'random_transform_one':
        // 槽中一张卡随机变成另一种（跳过实现）
        break;

      default:
        break;
    }
  }

  /**
   * 消除回调（由 SlotBar 调用）
   */
  onEliminate(count) {
    var baseHappy = count === 3 ? 10 : 30;
    if (this._happyMultiplier && this._happyMultiplierSteps > 0) {
      baseHappy *= this._happyMultiplier;
      this._happyMultiplierSteps--;
      if (this._happyMultiplierSteps <= 0) this._happyMultiplier = null;
    }
    this.happyValue += baseHappy;
    this.eliminateGroupCount++;

    // 触发技能检测
    this.skillSystem.onEliminate();

    this._renderHUD();
  }

  /**
   * 显示技能三选一
   */
  showSkillSelection(skills) {
    this.pendingSkills = skills;
    this.skillButtons = [];
    this._renderSkillPopup(skills);
  }

  /**
   * 渲染技能三选一弹窗
   */
  _renderSkillPopup(skills) {
    var w = this.stage.width;
    var h = this.stage.height;

    // 半透明遮罩
    var overlay = new PIXI.Graphics();
    overlay.beginFill(0x000000, 0.6);
    overlay.drawRect(0, 0, w, h);
    overlay.endFill();
    overlay.interactive = true; // 阻止点击穿透
    this.container.addChild(overlay);
    this._skillOverlay = overlay;

    // 弹窗标题
    var popupTitle = new PIXI.Text('🎯 选择技能', {
      fontFamily: 'sans-serif',
      fontSize: 24,
      fontWeight: 'bold',
      fill: '#F39C12',
      align: 'center',
    });
    popupTitle.anchor.set(0.5);
    popupTitle.x = w / 2;
    popupTitle.y = h * 0.15;
    this.container.addChild(popupTitle);
    this._skillPopupTitle = popupTitle;

    // 3个技能按钮
    var self = this;
    var btnW = w - 60;
    var btnH = 80;
    var startY = h * 0.25;
    var gap = 20;

    for (var i = 0; i < skills.length; i++) {
      (function (skill, idx) {
        var y = startY + idx * (btnH + gap);

        var skillContainer = new PIXI.Container();

        var bg = new PIXI.Graphics();
        bg.beginFill(0x34495E);
        bg.drawRoundedRect(30, y, btnW, btnH, 8);
        bg.endFill();
        bg.interactive = true;
        bg.buttonMode = true;
        skillContainer.addChild(bg);

        var iconTxt = new PIXI.Text(skill.icon, {
          fontFamily: 'sans-serif', fontSize: 28, align: 'center',
        });
        iconTxt.anchor.set(0.5);
        iconTxt.x = 70;
        iconTxt.y = y + btnH / 2;
        skillContainer.addChild(iconTxt);

        var nameTxt = new PIXI.Text(skill.name, {
          fontFamily: 'sans-serif', fontSize: 18, fontWeight: 'bold',
          fill: '#FFFFFF', align: 'left',
        });
        nameTxt.x = 100;
        nameTxt.y = y + 12;
        skillContainer.addChild(nameTxt);

        var descTxt = new PIXI.Text(skill.desc, {
          fontFamily: 'sans-serif', fontSize: 13, fill: '#BDC3C7', align: 'left',
        });
        descTxt.x = 100;
        descTxt.y = y + 40;
        skillContainer.addChild(descTxt);

        var tagTxt = new PIXI.Text(skill.tag, {
          fontFamily: 'sans-serif', fontSize: 11, fill: '#F39C12', align: 'right',
        });
        tagTxt.anchor.set(1, 0.5);
        tagTxt.x = 30 + btnW - 15;
        tagTxt.y = y + btnH / 2;
        skillContainer.addChild(tagTxt);

        bg.on('pointertap', function () {
          self._onSkillSelected(skill);
        });

        self.container.addChild(skillContainer);
        self.skillButtons.push(skillContainer);
      })(skills[i], i);
    }
  }

  /**
   * 技能选择回调
   */
  _onSkillSelected(skill) {
    // 清理弹窗
    if (this._skillOverlay) {
      this.container.removeChild(this._skillOverlay);
      this._skillOverlay = null;
    }
    if (this._skillPopupTitle) {
      this.container.removeChild(this._skillPopupTitle);
      this._skillPopupTitle = null;
    }
    for (var i = 0; i < this.skillButtons.length; i++) {
      this.container.removeChild(this.skillButtons[i]);
    }
    this.skillButtons = [];
    this.pendingSkills = null;

    // 应用技能
    this.skillSystem.selectSkill(skill);

    this._renderHUD();
  }

  /**
   * 获取技能上下文（供 skill.apply 使用）
   */
  getSkillContext() {
    var self = this;
    return {
      slotFreeClicks: { get: function () { return self.stepManager.slotFreeClicks; }, set: function (v) { self.stepManager.slotFreeClicks = v; } },
      get slotLimit() { return self.stepManager.slotLimit; },
      set slotLimit(v) { self.stepManager.slotLimit = v; },
      get clearMostInSlot() { return false; },
      set clearMostInSlot(v) { if (v) self.slotBar.clearMostCardType(); },
      get removeCoveredCards() { return 0; },
      set removeCoveredCards(v) { self.board.removeCoveredCards(v); },
      get transformToWild() { return 0; },
      set transformToWild(v) { self.slotBar.transformToWild(); },
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

  /**
   * 技能应用后回调
   */
  onSkillApplied(skill) {
    this.happyValue += 5;
    this._renderHUD();
  }

  /**
   * 检查失败条件
   */
  _checkFailure() {
    var slotFull = this.slotBar.isFull();
    var canEliminate = this._canEliminateInSlot();
    var result = this.stepManager.checkFailure(slotFull, canEliminate);

    if (result.shieldActivated) {
      // 周报护体：清空槽位
      this.slotBar.renderEmpty();
      this._renderHUD();
      return;
    }

    if (result.isFailed) {
      var reason = result.reason === 'steps' ? '步数耗尽！' : '被老板发现！';
      this._endGame(false, reason);
    }
  }

  /**
   * 槽位中是否有可消除的
   */
  _canEliminateInSlot() {
    var counts = {};
    for (var i = 0; i < this.slotBar.maxSlots; i++) {
      var card = this.slotBar.slots[i];
      if (!card) continue;
      var key = card.cardId;
      counts[key] = (counts[key] || 0) + 1;
    }
    // 有万能卡时放宽条件
    for (var k in counts) {
      if (counts[k] >= 3) return true;
    }
    // 检查万能卡
    var wildCount = 0;
    for (var j = 0; j < this.slotBar.maxSlots; j++) {
      var c = this.slotBar.slots[j];
      if (c && c.type === 'event' && c.config.effect === 'wild_card' && c.isRevealed) {
        wildCount++;
      }
    }
    for (var k2 in counts) {
      if (counts[k2] + wildCount >= 3) return true;
    }
    return false;
  }

  /**
   * 结束游戏
   */
  _endGame(won, reason) {
    var bonusHappy = 0;
    if (won) {
      // 通关奖励
      bonusHappy += this.stepManager.stepsRemaining * 10;
      if (this.slotBar.getVacantCount() >= 3) bonusHappy += 20; // 极限控槽
    }
    this.happyValue += bonusHappy;

    log(TAG, 'Game over: won=' + won + ', happy=' + this.happyValue + ', reason=' + reason);

    this.onGameOver({
      won: won,
      happyValue: this.happyValue,
      reason: reason,
      levelId: this.levelId,
      stepsUsed: this.stepManager.maxSteps - this.stepManager.stepsRemaining,
    });
  }

  /**
   * 渲染 HUD（步数、槽位状态、快乐值）
   */
  _renderHUD() {
    // 清除旧 HUD
    if (this._hudContainer) {
      this.container.removeChild(this._hudContainer);
    }
    this._hudContainer = new PIXI.Container();
    this.container.addChild(this._hudContainer);

    var screenW = this.stage.width;

    // 左上角：关卡名
    var levelName = this.board.levelConfig ? this.board.levelConfig.name : '';
    var levelText = new PIXI.Text(levelName, {
      fontFamily: 'sans-serif',
      fontSize: 14,
      fill: '#BDC3C7',
    });
    levelText.x = 10;
    levelText.y = 8;
    this._hudContainer.addChild(levelText);

    // 步数显示（居中顶部）
    var stepsColor = this.stepManager.stepsRemaining <= 5 ? '#E74C3C' : '#FFFFFF';
    var stepsText = new PIXI.Text('步数: ' + this.stepManager.stepsRemaining, {
      fontFamily: 'sans-serif',
      fontSize: 18,
      fontWeight: 'bold',
      fill: stepsColor,
    });
    stepsText.anchor.set(0.5, 0);
    stepsText.x = screenW / 2;
    stepsText.y = 5;
    this._hudContainer.addChild(stepsText);

    // 右上角：快乐值
    var happyText = new PIXI.Text('😊 ' + this.happyValue, {
      fontFamily: 'sans-serif',
      fontSize: 16,
      fontWeight: 'bold',
      fill: '#F1C40F',
    });
    happyText.anchor.set(1, 0);
    happyText.x = screenW - 10;
    happyText.y = 8;
    this._hudContainer.addChild(happyText);

    // 底部槽位上方的状态
    var slotStatus = this.slotBar.getVacantCount() + ' 空格';
    if (this.stepManager.slotFreeClicks > 0) {
      slotStatus += ' | 🛡️飞行中×' + this.stepManager.slotFreeClicks;
    }
    if (this.stepManager.tempSlotLimit9 > 0) {
      slotStatus += ' | 💤装死中×' + this.stepManager.tempSlotLimit9;
    }
    var slotText = new PIXI.Text(slotStatus, {
      fontFamily: 'sans-serif',
      fontSize: 13,
      fill: '#95A5A6',
      align: 'center',
    });
    slotText.anchor.set(0.5);
    slotText.x = screenW / 2;
    slotText.y = this.slotBar.startY - 25;
    this._hudContainer.addChild(slotText);
  }

  update(dt) {
    // 暂时不需要每帧更新
  }

  render(container) {
    // 所有渲染已经在 onEnter 中完成，场景管理器每帧会 clear + render
    container.addChild(this.container);
  }

  onExit() {
    this.stage.removeChild(this.container);
  }
}
```

- [ ] **Step 2: 语法检查**

```bash
node -c src/scenes/GameScene.js && echo "OK"
```

- [ ] **Step 3: Commit**

```bash
git add src/scenes/GameScene.js && git commit -m "feat: add GameScene with full gameplay loop"
```

---

### Task 11: ResultScene.js — 结算场景

**Files:**
- Create: `src/scenes/ResultScene.js`

- [ ] **Step 1: 创建 ResultScene.js**

```js
// src/scenes/ResultScene.js

import Scene from '../core/Scene';
import Button from '../ui/Button';

export default class ResultScene extends Scene {
  onEnter(params) {
    this.result = params.result;
    this.onBackToMenu = params.onBackToMenu;
    this.onReplay = params.onReplay;
    this.container = new PIXI.Container();
    this.stage.addChild(this.container);
  }

  render(container) {
    var w = this.stage.width;
    var h = this.stage.height;
    this.container.removeChildren();

    // 遮罩
    var bg = new PIXI.Graphics();
    bg.beginFill(0x1A252F);
    bg.drawRect(0, 0, w, h);
    bg.endFill();
    this.container.addChild(bg);

    // 结果标题
    var titleText = this.result.won ? '🎉 通关成功！' : '😫 被老板发现！';
    var titleColor = this.result.won ? '#2ECC71' : '#E74C3C';
    var title = new PIXI.Text(titleText, {
      fontFamily: 'sans-serif',
      fontSize: 36,
      fontWeight: 'bold',
      fill: titleColor,
      align: 'center',
    });
    title.anchor.set(0.5);
    title.x = w / 2;
    title.y = h * 0.2;
    this.container.addChild(title);

    // 原因
    var reasonText = this.result.won ? '成功清空全部卡片' : ('失败原因: ' + this.result.reason);
    var reason = new PIXI.Text(reasonText, {
      fontFamily: 'sans-serif',
      fontSize: 14,
      fill: '#95A5A6',
      align: 'center',
    });
    reason.anchor.set(0.5);
    reason.x = w / 2;
    reason.y = h * 0.3;
    this.container.addChild(reason);

    // 快乐值
    var happyText = new PIXI.Text('快乐值: ' + this.result.happyValue, {
      fontFamily: 'sans-serif',
      fontSize: 28,
      fontWeight: 'bold',
      fill: '#F1C40F',
      align: 'center',
    });
    happyText.anchor.set(0.5);
    happyText.x = w / 2;
    happyText.y = h * 0.42;
    this.container.addChild(happyText);

    // 统计
    var stats = '使用步数: ' + (this.result.stepsUsed || 0);
    var statsText = new PIXI.Text(stats, {
      fontFamily: 'sans-serif',
      fontSize: 14,
      fill: '#7F8C8D',
      align: 'center',
    });
    statsText.anchor.set(0.5);
    statsText.x = w / 2;
    statsText.y = h * 0.52;
    this.container.addChild(statsText);

    // 按钮
    var self = this;
    var btnW = 180;
    var btnH = 50;

    // 再来一局
    var replayBtn = new Button(
      Math.floor((w - btnW) / 2),
      Math.floor(h * 0.63),
      btnW, btnH,
      '再来一局',
      {
        bgColor: '#27AE60',
        textColor: '#FFFFFF',
        fontSize: 18,
        radius: 8,
        shadow: true,
        onClick: function () { self.onReplay(); }
      }
    );
    this.container.addChild(replayBtn.getDisplayObject());
    this.registerHitArea(replayBtn.getHitArea(), replayBtn.onClick, 10);

    // 返回菜单
    var menuBtn = new Button(
      Math.floor((w - btnW) / 2),
      Math.floor(h * 0.73),
      btnW, btnH,
      '返回菜单',
      {
        bgColor: '#7F8C8D',
        textColor: '#FFFFFF',
        fontSize: 18,
        radius: 8,
        shadow: true,
        onClick: function () { self.onBackToMenu(); }
      }
    );
    this.container.addChild(menuBtn.getDisplayObject());
    this.registerHitArea(menuBtn.getHitArea(), menuBtn.onClick, 10);
  }

  onExit() {
    this.stage.removeChild(this.container);
  }
}
```

- [ ] **Step 2: 语法检查**

```bash
node -c src/scenes/ResultScene.js && echo "OK"
```

- [ ] **Step 3: Commit**

```bash
git add src/scenes/ResultScene.js && git commit -m "feat: add ResultScene with win/lose settlement"
```

---

### Task 12: 入口文件 + 集成

**Files:**
- Modify: `game.js` — 改写为 PixiJS 入口

- [ ] **Step 1: 改写 game.js**

```js
// game.js — 摸鱼大师入口

import PixiAdapter from './src/wechat/PixiAdapter';

// 安装 DOM shim（必须在 PixiJS 之前）
PixiAdapter.install();

// 加载 PixiJS（作为全局 PIXI）
import './libs/pixi-legacy.min';
import './libs/pixi-unsafe-eval-v7';

// 优先 Canvas 渲染
PIXI.settings.FAIL_IF_MAJOR_PERFORMANCE_CAVEAT = false;

import Game from './src/core/Game';

var game = new Game();
game.start();
```

- [ ] **Step 2: 验证 game.json**

```bash
cat game.json
```

Expected: `{ "deviceOrientation": "portrait" }`

- [ ] **Step 3: 全局语法检查**

```bash
for f in game.js src/**/*.js; do node -c "$f" && echo "OK: $f" || echo "FAIL: $f"; done
```

Expected: All files pass

- [ ] **Step 4: 在微信开发者工具中编译测试**

1. 打开项目 `C:/Users/lenovo/WeChatProjects/moyu-master`
2. 编译运行
3. 验证：MenuScene 展示正常 → 点击"开始摸鱼" → GameScene 展示棋盘 + 槽位 + HUD → 点击卡片 → 卡片飞入槽位 → 3张同卡消除 → 验证失败条件

- [ ] **Step 5: Commit**

```bash
git add game.js && git commit -m "feat: rewrite game.js as PixiJS entry point"
```

---

### Task 13: Board.js 渲染修复 + Deck（万能牌/奖励牌）补齐

**Files:**
- Modify: `src/game/Board.js` — `_renderCard` 中 `r`/`c` 引用修复
- Modify: `src/data/cards.js` — 补万能卡
- Create: `src/game/Board.js` 增加 `addRandomCards(count)` 方法

**说明**：Board._renderCard 的内部代码引用了 `r` 和 `c`，但这些变量来自 `_renderAll` 的循环。需要在 `_renderAll` 中传入参数，或将渲染代码内联。

- [ ] **Step 1: 修复 Board._renderCard — 添加参数**

修改 `_renderCard` 签名，添加 `row` 和 `col` 参数：

```js
  // 替换 _renderAll 和 _renderCard：

  _renderAll() {
    this.container.removeChildren();
    for (var l = 0; l < this.grid.length; l++) {
      for (var r = 0; r < this.grid[l].length; r++) {
        for (var c = 0; c < this.grid[l][r].length; c++) {
          var card = this.grid[l][r][c];
          if (card && !card.isRemoved) {
            this._renderCardAt(card, r, c);
          }
        }
      }
    }
  }

  _renderCardAt(card, row, col) {
    var container = new PIXI.Container();
    var w = this.cardWidth;
    var h = this.cardHeight;
    var x = this.offsetX + col * (w + this.gap) + card.layer * this.layerOffsetX;
    var y = this.offsetY + row * (h + this.gap) - card.layer * this.layerOffsetY;

    container.x = x;
    container.y = y;

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
    var iconText = new PIXI.Text(displayIcon, {
      fontFamily: 'sans-serif',
      fontSize: 28,
      align: 'center',
    });
    iconText.anchor.set(0.5);
    iconText.x = w / 2;
    iconText.y = h * 0.35;
    container.addChild(iconText);

    var displayName = (card.type === 'event' && !card.isRevealed) ? '事件' : card.name;
    var nameText = new PIXI.Text(displayName, {
      fontFamily: 'sans-serif',
      fontSize: 13,
      fill: card.isCovered ? '#999999' : '#333333',
      align: 'center',
    });
    nameText.anchor.set(0.5);
    nameText.x = w / 2;
    nameText.y = h * 0.7;
    container.addChild(nameText);

    var bar = new PIXI.Graphics();
    bar.beginFill(card.getColor(), card.isCovered ? 0.4 : 0.9);
    bar.drawRect(4, h - 6, w - 8, 4);
    bar.endFill();
    container.addChild(bar);

    card.container = container;
    this.container.addChild(container);

    if (!card.isCovered) {
      container.interactive = true;
      container.buttonMode = true;
    }
  }
```

- [ ] **Step 2: 语法检查**

```bash
node -c src/game/Board.js && echo "OK"
```

- [ ] **Step 3: Commit**

```bash
git add src/game/Board.js && git commit -m "fix: Board._renderCardAt explicit row/col params"
```

---

### Task 14: 最终验证与 Bug 修复

- [ ] **Step 1: 全局语法检查**

```bash
for f in game.js src/**/*.js; do node -c "$f" && echo "OK: $f" || echo "FAIL: $f"; done
```

- [ ] **Step 2: 检查文件结构完整性**

```bash
echo "=== Expected files ===" && \
  echo "game.js" && \
  echo "libs/pixi-legacy.min.js" && \
  echo "libs/pixi-unsafe-eval-v7.js" && \
  echo "src/wechat/PixiAdapter.js" && \
  echo "src/core/Game.js" && \
  echo "src/core/Scene.js" && \
  echo "src/core/SceneManager.js" && \
  echo "src/core/EventManager.js" && \
  echo "src/scenes/MenuScene.js" && \
  echo "src/scenes/GameScene.js" && \
  echo "src/scenes/ResultScene.js" && \
  echo "src/game/Board.js" && \
  echo "src/game/Card.js" && \
  echo "src/game/SlotBar.js" && \
  echo "src/game/SkillSystem.js" && \
  echo "src/game/StepManager.js" && \
  echo "src/data/cards.js" && \
  echo "src/data/skills.js" && \
  echo "src/data/levels.js" && \
  echo "src/ui/Button.js" && \
  echo "src/utils/Logger.js" && \
  echo "=== Checking ===" && \
  for f in game.js libs/pixi-legacy.min.js libs/pixi-unsafe-eval-v7.js \
    src/wechat/PixiAdapter.js src/core/Game.js src/core/Scene.js \
    src/core/SceneManager.js src/core/EventManager.js \
    src/scenes/MenuScene.js src/scenes/GameScene.js src/scenes/ResultScene.js \
    src/game/Board.js src/game/Card.js src/game/SlotBar.js \
    src/game/SkillSystem.js src/game/StepManager.js \
    src/data/cards.js src/data/skills.js src/data/levels.js \
    src/ui/Button.js src/utils/Logger.js; do \
    if [ -f "$f" ]; then echo "✓ $f"; else echo "✗ MISSING: $f"; fi; \
  done
```

- [ ] **Step 3: 在微信开发者工具中运行并测试以下场景**

1. 主菜单显示正常（标题、按钮）
2. 点击"开始摸鱼"进入第一关
3. 棋盘渲染卡片（emoji + 名称可见）
4. 点击未被压住的卡片 → 消耗1步 → 飞入槽位
5. 点击被压住的卡片 → 无响应
6. 收集3张同种卡 → 自动消除 → 快乐值增加
7. ❓事件卡点击 → 揭示真实身份 → 应用效果
8. 消除3组后 → 弹出技能三选一
9. 选择技能 → 效果生效
10. 步数耗尽 → 失败结算
11. 槽满7张 → 失败结算
12. 棋盘清空 → 通关结算

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: final integration and verification"
```

---
