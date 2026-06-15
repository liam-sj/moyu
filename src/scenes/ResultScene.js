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
    var sysInfo = wx.getSystemInfoSync();
    var w = sysInfo.windowWidth;
    var h = sysInfo.windowHeight;
    this.container.removeChildren();

    // 遮罩
    var bg = new PIXI.Graphics();
    bg.beginFill(0x1A252F); bg.drawRect(0, 0, w, h); bg.endFill();
    this.container.addChild(bg);

    // 结果标题
    var titleText = this.result.won ? '🎉 通关成功！' : '😫 被老板发现！';
    var titleColor = this.result.won ? '#2ECC71' : '#E74C3C';
    var title = new PIXI.Text(titleText, {
      fontFamily: 'sans-serif', fontSize: 36, fontWeight: 'bold',
      fill: titleColor, align: 'center',
    });
    title.anchor.set(0.5); title.x = w / 2; title.y = h * 0.2;
    this.container.addChild(title);

    // 原因
    var reasonText = this.result.won ? '成功清空全部卡片' : ('失败原因: ' + this.result.reason);
    var reason = new PIXI.Text(reasonText, {
      fontFamily: 'sans-serif', fontSize: 14, fill: '#95A5A6', align: 'center',
    });
    reason.anchor.set(0.5); reason.x = w / 2; reason.y = h * 0.3;
    this.container.addChild(reason);

    // 快乐值
    var happyText = new PIXI.Text('快乐值: ' + this.result.happyValue, {
      fontFamily: 'sans-serif', fontSize: 28, fontWeight: 'bold',
      fill: '#F1C40F', align: 'center',
    });
    happyText.anchor.set(0.5); happyText.x = w / 2; happyText.y = h * 0.42;
    this.container.addChild(happyText);

    // 统计
    var stats = '使用步数: ' + (this.result.stepsUsed || 0);
    var statsText = new PIXI.Text(stats, {
      fontFamily: 'sans-serif', fontSize: 14, fill: '#7F8C8D', align: 'center',
    });
    statsText.anchor.set(0.5); statsText.x = w / 2; statsText.y = h * 0.52;
    this.container.addChild(statsText);

    // 按钮
    var self = this;
    var btnW = 180, btnH = 50;

    var replayBtn = new Button(
      Math.floor((w - btnW) / 2), Math.floor(h * 0.63), btnW, btnH,
      '再来一局',
      { bgColor: '#27AE60', textColor: '#FFFFFF', fontSize: 18, radius: 8, shadow: true,
        onClick: function () { self.onReplay(); } }
    );
    this.container.addChild(replayBtn.getDisplayObject());
    this.registerHitArea(replayBtn.getHitArea(), replayBtn.onClick, 10);

    var menuBtn = new Button(
      Math.floor((w - btnW) / 2), Math.floor(h * 0.73), btnW, btnH,
      '返回菜单',
      { bgColor: '#7F8C8D', textColor: '#FFFFFF', fontSize: 18, radius: 8, shadow: true,
        onClick: function () { self.onBackToMenu(); } }
    );
    this.container.addChild(menuBtn.getDisplayObject());
    this.registerHitArea(menuBtn.getHitArea(), menuBtn.onClick, 10);

    container.addChild(this.container);
  }

  onExit() { this.stage.removeChild(this.container); }
}
