// src/game/StepManager.js

export default class StepManager {
  constructor(gameScene) {
    this.gameScene = gameScene;
    this.stepsRemaining = 35;
    this.maxSteps = 35;
    this.slotLimit = 7;
    this.baseSlotLimit = 7;
    this.slotFreeClicks = 0;
    this.tempSlotLimit9 = 0;
    this.slotOverflowShield = false;
    this.stepsUnlimited = false;
    this.slotUnlimited = false;
    this.noMoreBossPatrol = false;
  }

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

  useStep() {
    if (this.stepsUnlimited) return true;
    if (this.stepsRemaining <= 0) return false;
    this.stepsRemaining--;
    return true;
  }

  occupiesSlot() {
    if (this.slotFreeClicks > 0) { this.slotFreeClicks--; return false; }
    return true;
  }

  getEffectiveSlotLimit() {
    if (this.slotUnlimited) return Infinity;
    if (this.tempSlotLimit9 > 0) return 9;
    return this.slotLimit;
  }

  tick() {
    if (this.tempSlotLimit9 > 0) this.tempSlotLimit9--;
  }

  checkFailure(slotFull, canEliminate) {
    if (!this.stepsUnlimited && this.stepsRemaining <= 0) {
      return { isFailed: true, reason: 'steps' };
    }
    if (!this.slotUnlimited && slotFull && !canEliminate) {
      if (this.slotOverflowShield) {
        this.slotOverflowShield = false;
        return { isFailed: false, reason: '', shieldActivated: true };
      }
      return { isFailed: true, reason: 'slot_full' };
    }
    return { isFailed: false, reason: '' };
  }

  checkWin(boardEmpty) {
    return boardEmpty;
  }
}
