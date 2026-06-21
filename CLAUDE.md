# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run build          # Production build → game.js (IIFE, global-name=game)
npm run dev            # Watch mode, auto-rebuild on file change
npm run type-check     # TypeScript type checking only (tsc --noEmit)
```

`game.js` is the single bundle output loaded by WeChat mini-game runtime. esbuild bundles everything — no separate file loading at runtime.

## Project Architecture

**Tech Stack:** TypeScript + PixiJS v7 Legacy (Canvas2D mode) → esbuild bundle → WeChat Mini-Game

```
src/
  main.minigame.ts     # Entry point: PIXI.App → SceneManager → MenuScene
  engine/              # Mini game engine (generic, reusable)
    SceneManager.ts    # Stack-based scene management (push/pop/replace)
    Scene.ts           # Abstract scene base class (lifecycle hooks)
    EventBus.ts        # Simple pub/sub event emitter
    EventManager.ts    # Touch hit-area registration + dispatch
  core/                # Game logic (game-specific, no rendering)
    GameLogic.ts       # Central coordinator: Board + SlotBar + StepManager + SkillSystem
    Board.ts           # 3D grid [layer][row][col], card generation, coverage detection
    Card.ts            # Card data models, factory functions
    SlotBar.ts         # Slot bar (7 slots), flight slots, holding area, matching
    StepManager.ts     # Step limit, slot limit, buff/debuff state
    SkillSystem.ts     # Roguelike skill: charge on elimination, open panel to pick
    types.ts           # All TypeScript interfaces (LevelConfig, SkillContext, etc.)
  config/              # Game data configs (all configurable without touching logic)
    levels.ts          # Level definitions (grid, cards, steps, slotLimit)
    cards.ts           # Normal cards (7 types) + Func cards (4 types)
    skills.ts          # 10 skills (8 normal + 2 legendary) with weighted random
    ponds.ts           # 12 fish pond definitions + local cache helpers
    atlas.ts           # Texture atlas coordinate mapping (card images)
  scenes/              # Game scenes (each is a full-screen PIXI Container)
    MenuScene.ts       # Home page: pond list + fish swimming + avatar auth
    GameScene.ts       # Core gameplay: board rendering, card interaction, fly animation
    SelectFishScene.ts # Fish selection (3×4 grid) after clearing Level 2
    PondDetailScene.ts # Pond detail overlay (hero board + stats)
    overlays/
      PauseOverlay.ts  # Pause screen
      ResultOverlay.ts # Victory/defeat screen with revive/replay/menu
  views/               # Reusable PIXI visual components
    CardView.ts        # Individual card on the board (3D shadow, atlas sprite, animation)
    FishView.ts        # Single swimming fish (state machine: cruise/turn/pause/dash)
    PondView.ts        # Pond container: background, fish spawning, contributor avatars
    Button.ts          # Simple PIXI button with hit area
  utils/
    Logger.ts          # Debug logging (enabled/disabled via setDebug)
    SharePoster.ts     # Canvas-based poster generation for sharing
  platform/
    PixiAdapter.ts     # WeChat canvas polyfills + main canvas getter
    storage.ts         # wx storage wrappers
    wx.d.ts            # WeChat API type declarations
  main.ts              # Dev entry (not used for production)
  bootstrap.ts         # Bootstrap helpers
```

## Architecture Patterns

### Scene System
All scenes extend `Scene`. Lifecycle: `onEnter(params)` → `onUpdate(dt)` → `onPause()` → `onExit()` / `onDestroy()`. SceneManager manages a stack; `push()` pauses current, `replace()` pops all and pushes new. `bus` (EventBus) is shared across all scenes for cross-scene communication. `listen(type, handler)` auto-unsubscribes on teardown.

### Hit Area System
Touch detection is rebuilt every frame. `Scene.registerHitArea(rect, callback, layer)` registers a rectangle; `EventManager._onTouch` sorts by layer descending and dispatches first match. SceneManager's tick loop calls `clearHitAreas()` before each `update()` so scenes must re-register hit areas every frame in `onUpdate()`.

### Event Flow (Game Loop)
```
app.ticker → clearHitAreas → scene.onUpdate(dt) → render
```
Events between game components use EventBus: `boardInit`, `boardChanged`, `slotChanged`, `stepsChanged`, `eliminated`, `skillTriggered`, `gameOver`, `selectCardType`.

### Card Layout
`Board.calcLayout()` computes cardWidth/cardHeight from screen dimensions. Level 1 uses gapRatio=0 (fixed 30px gap). Level 2 uses gapRatio>0 (proportional gap + layer offsets for dense pyramid). Layer offset ratio controls horizontal stagger (currently 0.15 for Level 2). Coverage detection uses pixel-level rectangle overlap with 8% minimum overlap threshold.

### Animation System
All animations are driven by `onUpdate(dt)` — no per-card PIXI tickers. Batch arrays: `_dealingCards` (deal animation), `_shuffleCards` (shuffle), `_flyEffects` (card-to-slot fly), `_effects` (particle bursts). Timeline based on `Date.now()` for smooth real-time interpolation.

### Cloud Integration
Cloud env: `cloud1-d5gtuwnx0aacd8adb`. Database design: [docs/database-design.md](docs/database-design.md).
Cloud functions in `cloudfunctions/`:
- `selectFish`: Player selects/changes fish (stores openId, pondId, avatarUrl)
- `contribute`: Record Level 2 clear (increments pond dailyClears, stores avatarUrl)
- `getPondRanking`: Returns 3 ranking dimensions + contributor avatars per pond
- `getPondDetail`: Pond detail with hero board
- `checkAchievements`: Achievement checks after level win

DB collections: `player_ponds` (player data), `pond_stats` (daily stats), `pond_streaks` (streak tracking).

**Critical:** Cloud functions are plain JavaScript (NOT TypeScript). Do not use type annotations (`: any`, `: string`, etc.) in cloud function code — they will cause syntax errors when deployed. Always run `node -c cloudfunctions/<name>/index.js` to verify syntax before deploying.

## Key Design Decisions

- **Canvas2D only** (`forceCanvas: true`). WebGL not used due to WeChat compatibility concerns.
- **Single texture atlas** for all card images (`assets/cards/cards.png`). Loaded via `wx.createImage()` → canvas → `PIXI.BaseTexture.from(canvas)`. All card sprites share this base texture with sub-rectangle UVs.
- **Emoji text fallback**: If atlas fails to load, `createCardImage()` falls back to `PIXI.Text` with emoji characters.
- **3n card count guarantee**: Total cards placed on board are always multiples of 3 via `_buildCardList()` rounding. Each card type appears in groups of 3 for guaranteed complete elimination.
- **No server dependency for core gameplay**: Only fish pond features need cloud. Core game (levels, skills, cards) works offline.
- **Package size limit**: WeChat mini-game code package must be under 4MB. `project.config.json` `packOptions.ignore` excludes `cloudfunctions/`, `docs/`, `.git/`, `node_modules/`, `src/` (source is compiled into game.js).

## Common Pitfalls

- `wx.createUserInfoButton` and `wx.getUserProfile` may not work in game canvas. Avatar collection requires WeChat privacy policy configuration in the admin console.
- Scene transitions: touch handlers must be cleaned up in `onDestroy()` to prevent accessing destroyed containers.
- Fish coordinates: FishView now uses `container` (PIXI.Container wrapping sprite), NOT `sprite` directly. Always use `f.container.x/y` for position.
- Cloud function JS syntax: No TypeScript type annotations (`: any`, `: string`). Use plain JS only.
- `getGlobalPosition()` on PIXI v7 legacy types: Use `(container as any).getGlobalPosition()` to bypass type errors.
- **No local storage for game data**: All user state (fish selection, level progress, avatar, contributions) must be stored in cloud DB (`player_ponds`, `pond_stats`). Never use `wx.setStorageSync`/`getStorageSync` for user game data. Exception: `fish_pond_cache` (lightweight cache of pond ID for quick lookups).
