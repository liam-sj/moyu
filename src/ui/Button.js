export default class Button {
  constructor(x, y, w, h, text, options = {}) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.text = text;
    this.bgColor = options.bgColor || '#FF8C42';
    this.textColor = options.textColor || '#FFFFFF';
    this.fontSize = options.fontSize || 16;
    this.radius = options.radius !== undefined ? options.radius : 3;
    this.onClick = options.onClick || null;
    this.shadow = options.shadow !== undefined ? options.shadow : true;

    this._container = new PIXI.Container();
    this._bg = new PIXI.Graphics();
    this._highlight = new PIXI.Graphics();
    this._label = new PIXI.Text(text, {
      fontFamily: 'sans-serif',
      fontSize: this.fontSize,
      fontWeight: 'bold',
      fill: this.textColor,
      align: 'center'
    });
    this._label.anchor.set(0.5);
    this._label.x = x + w / 2;
    this._label.y = y + h / 2;

    this._container.addChild(this._bg);
    this._container.addChild(this._highlight);
    this._container.addChild(this._label);
    this._redraw();
  }

  _redraw() {
    var g = this._bg;
    var r = this.radius;
    var x = this.x, y = this.y, w = this.w, h = this.h;

    g.clear();

    // Shadow (pixel offset)
    if (this.shadow) {
      g.beginFill(0x000000, 0.15);
      g.drawRect(x + 2, y + 2, w, h);
      g.endFill();
    }

    // Main body
    g.beginFill(hexToInt(this.bgColor));
    g.drawRect(x, y, w, h);
    g.endFill();

    // Darker border (bottom + right for 3D pixel look)
    g.beginFill(0x000000, 0.18);
    g.drawRect(x, y + h - 2, w, 2);
    g.drawRect(x + w - 2, y, 2, h);
    g.endFill();

    // Top highlight (lighter)
    var hl = this._highlight;
    hl.clear();
    hl.beginFill(0xFFFFFF, 0.2);
    hl.drawRect(x + 1, y + 1, w - 2, 2);
    hl.drawRect(x + 1, y + 1, 2, h - 2);
    hl.endFill();
  }

  draw() {}

  getDisplayObject() {
    return this._container;
  }

  getHitArea() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  setText(text) {
    this._label.text = text;
  }
}

function hexToInt(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return (parseInt(result[1], 16) << 16) |
           (parseInt(result[2], 16) << 8) |
           parseInt(result[3], 16);
  }
  return 0xFF8C42;
}
