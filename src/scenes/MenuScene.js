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

    // 标题
    var title = new PIXI.Text('摸鱼大师', {
      fontFamily: 'sans-serif', fontSize: 48, fontWeight: 'bold',
      fill: '#F39C12', align: 'center',
    });
    title.anchor.set(0.5); title.x = w / 2; title.y = h * 0.25;
    this.container.addChild(title);

    // 副标题
    var subtitle = new PIXI.Text('职场摸鱼三消挑战', {
      fontFamily: 'sans-serif', fontSize: 18, fill: '#BDC3C7', align: 'center',
    });
    subtitle.anchor.set(0.5); subtitle.x = w / 2; subtitle.y = h * 0.33;
    this.container.addChild(subtitle);

    // Emoji
    var deco = new PIXI.Text('📱 🚽 😴 🍜 🛒 💬 🎮', {
      fontFamily: 'sans-serif', fontSize: 24, align: 'center',
    });
    deco.anchor.set(0.5); deco.x = w / 2; deco.y = h * 0.45;
    this.container.addChild(deco);

    // 开始按钮
    var self = this;
    var btnW = 200, btnH = 56;
    var btn = new Button(
      Math.floor((w - btnW) / 2), Math.floor(h * 0.6), btnW, btnH,
      '开始摸鱼',
      { bgColor: '#E67E22', textColor: '#FFFFFF', fontSize: 22, radius: 8, shadow: true,
        onClick: function () { self.onStartGame('level1'); } }
    );
    this.container.addChild(btn.getDisplayObject());
    this.registerHitArea(btn.getHitArea(), btn.onClick, 10);

    // 底部提示
    var tip = new PIXI.Text('点击卡片 → 集齐3张消除 → 触发技能', {
      fontFamily: 'sans-serif', fontSize: 13, fill: '#7F8C8D', align: 'center',
    });
    tip.anchor.set(0.5); tip.x = w / 2; tip.y = h * 0.85;
    this.container.addChild(tip);
  }

  onExit() { this.stage.removeChild(this.container); }
}
