# 功能卡片恢复设计

## 概述
恢复第二关（深渊）的功能卡片系统。三种功能卡（增益/减益/干扰），仅 Level 2 生成。

## 功能卡片定义

| 类型 | ID | 名称 | 效果 | 实现状态 |
|------|-----|------|------|----------|
| negative (减益) | shark | 🦈 鲨鱼来袭 | boss_patrol: 随机替换卡槽一张牌 | 已有 |
| positive (增益) | pearl | 🦪 万能珍珠 | wild_card: 万能牌，匹配任意类型 | 需实现 |
| dual (干扰) | octopus | 🐙 章鱼墨水 | swap_board_cards: 随机调换棋盘2张牌 | 新增 |

## Level 2 配置变更

```typescript
level2: {
  ...
  funcCardCount: 9,           // 0 → 9 (约10%)
  funcTypes: ['shark', 'pearl', 'octopus'],
  funcRatio: { negative: 1, positive: 1, dual: 1 },  // 各3张
}
```

96张牌中 9 张功能卡（≈9.4%），三种类型各 3 张保证 3n 消除。

## 实现要点

### 1. FUNC_CARDS 新增章鱼墨水
- `src/config/cards.ts`: 新增 `octopus` 卡片配置（dual 类型，effect: swap_board_cards）

### 2. 万能珍珠效果实现
- `src/core/SlotBar.ts`: 匹配逻辑中，万能牌（wild_card type 的 event card）可匹配任意 2 张同类型卡

### 3. 章鱼墨水效果实现
- `src/core/GameLogic.ts`: `_applyFuncEffect` 新增 `swap_board_cards` case
- `src/core/Board.ts`: 新增 `swapTwoCards()` 方法（随机选2张未移除卡片交换位置）

### 4. Level 配置
- `src/config/levels.ts`: Level 2 开启 func 配置

## 文件清单
- MODIFY: `src/config/cards.ts` — 新增 octopus 卡片
- MODIFY: `src/config/levels.ts` — Level 2 func 配置
- MODIFY: `src/core/GameLogic.ts` — swap_board_cards 效果 + wild_card 效果
- MODIFY: `src/core/SlotBar.ts` — 万能牌匹配逻辑
- MODIFY: `src/core/Board.ts` — swapTwoCards 方法
