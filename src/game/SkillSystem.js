// src/game/SkillSystem.js

import { getRandomSkills } from '../data/skills';
import { log } from '../utils/Logger';

var TAG = 'SkillSystem';

export default class SkillSystem {
  constructor(gameScene) {
    this.gameScene = gameScene;
    this.eliminateCount = 0;
    this.triggerThreshold = 3;
    this.isShowingSelection = false;
  }

  init() {
    this.eliminateCount = 0;
    this.triggerThreshold = 3;
    this.isShowingSelection = false;
  }

  onEliminate() {
    this.eliminateCount++;
    if (this.eliminateCount % this.triggerThreshold === 0) {
      this._showSelection();
    }
  }

  _showSelection() {
    if (this.isShowingSelection) return;
    this.isShowingSelection = true;
    var skills = getRandomSkills(3);
    log(TAG, 'Skill selection: ' + skills.map(function (s) { return s.name; }).join(', '));
    if (this.gameScene && this.gameScene.showSkillSelection) {
      this.gameScene.showSkillSelection(skills);
    }
  }

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
