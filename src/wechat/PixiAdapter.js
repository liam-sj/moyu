/**
 * WeChat Mini-Game adapter for PixiJS v7.
 * Must run BEFORE PixiJS is loaded (before importing pixi-legacy).
 * Provides missing DOM APIs that PixiJS expects.
 */

// Intl polyfill — runs at module body time so it's available
// when pixi.min.js loads (before PixiAdapter.install() is called).
if (typeof globalThis.Intl === 'undefined') {
  globalThis.Intl = {
    NumberFormat: function () { return { format: function (n) { return String(n); }, formatToParts: function (n) { return [{ type: 'integer', value: String(n) }]; }, resolvedOptions: function () { return { locale: 'zh-CN' }; } }; },
    DateTimeFormat: function () { return { format: function (d) { return String(d); }, formatToParts: function (d) { return [{ type: 'literal', value: String(d) }]; }, resolvedOptions: function () { return { locale: 'zh-CN' }; } }; },
    Collator: function () { return { compare: function (a, b) { return a < b ? -1 : a > b ? 1 : 0; }, resolvedOptions: function () { return { locale: 'zh-CN' }; } }; },
    PluralRules: function () { return { select: function () { return 'other'; }, resolvedOptions: function () { return { locale: 'zh-CN' }; } }; }
  };
}

// window event methods — PixiJS calls window.addEventListener('resize', ...)
// and since window = globalThis, globalThis must have these methods.
if (typeof globalThis.addEventListener === 'undefined') {
  globalThis.addEventListener = function () {};
  globalThis.removeEventListener = function () {};
  globalThis.dispatchEvent = function () {};
}

// performance polyfill — PixiJS Ticker uses performance.now() for timing
if (typeof globalThis.performance === 'undefined') {
  globalThis.performance = { now: function () { return Date.now(); } };
}

var PixiAdapter = {

  install: function () {

    // 1. document.createElement — canvas via wx.createCanvas, rest mock
    if (typeof globalThis.document === 'undefined') {
      globalThis.document = {
        createElement: function (tagName) {
          if (tagName === 'canvas') {
            var c = wx.createCanvas();
            c.type = 'canvas';
            // Article fix: canvas.__proto__.__proto__ must point to an
            // HTMLCanvasElement instance (not HTMLElement), otherwise
            // `canvas instanceof HTMLCanvasElement` is false and PixiJS
            // throws "Unrecognized source type to auto-detect Resource".
            if (!(c instanceof globalThis.HTMLCanvasElement)) {
              c.__proto__.__proto__ = new globalThis.HTMLCanvasElement();
            }
            if (!c.style) c.style = {};
            // PixiJS EventSystem calls addEventListener on the canvas.
            // WeChat native canvases don't have DOM event methods.
            // Our EventManager handles touches via wx.onTouchStart.
            if (!c.addEventListener) {
              c.addEventListener = function () {};
              c.removeEventListener = function () {};
              c.dispatchEvent = function () {};
            }
            return c;
          }
          return { tagName: tagName, style: {} };
        },
        createElementNS: function (ns, tagName) {
          return globalThis.document.createElement(tagName);
        },
        body: { appendChild: function () {}, removeChild: function () {} },
        head: { appendChild: function () {}, removeChild: function () {} },
        documentElement: { style: {} },
        addEventListener: function () {},
        removeEventListener: function () {},
        createEvent: function () { return {}; },
        getElementById: function () { return null; }
      };
    }

    // 1.5. Patch the main canvas with DOM event methods.
    // PixiJS EventSystem calls addEventListener on the view canvas.
    // Save reference so Game.js uses the same canvas object.
    var mainCanvas = globalThis.canvas || wx.createCanvas();
    if (mainCanvas && !mainCanvas.addEventListener) {
      mainCanvas.addEventListener = function () {};
      mainCanvas.removeEventListener = function () {};
      mainCanvas.dispatchEvent = function () {};
    }
    // Expose so other modules can use the same patched canvas
    globalThis.__pixi_main_canvas = mainCanvas;

    // 2. window / location / navigator shim
    if (typeof globalThis.window === 'undefined') {
      globalThis.window = globalThis;
    }
    if (!globalThis.location) {
      globalThis.location = { href: '', protocol: 'https:', host: '' };
    }
    if (!globalThis.navigator) {
      globalThis.navigator = { userAgent: 'WeChat', platform: 'WeChat' };
    }

    // 3. HTMLCanvasElement shim with Symbol.hasInstance
    // WeChat native canvas objects have immutable prototypes, so
    // Object.setPrototypeOf does not work. Use Symbol.hasInstance
    // so `canvas instanceof HTMLCanvasElement` returns true for
    // any object with a getContext method (what PixiJS checks).
    if (typeof globalThis.HTMLCanvasElement === 'undefined') {
      globalThis.HTMLCanvasElement = function () {};
      Object.defineProperty(globalThis.HTMLCanvasElement, Symbol.hasInstance, {
        value: function (instance) {
          return instance && typeof instance.getContext === 'function';
        },
        writable: false
      });
    }

    // 4. Image — use wx.createImage() which returns a real Image object
    // with src/onload/onerror/width/height/complete — exactly what PixiJS expects.
    // PixiJS v7's BaseTexture.from(url) internally does `new Image(); img.src = url`
    // and listens for onload. wx.createImage() supports this perfectly.
    if (typeof globalThis.Image === 'undefined') {
      globalThis.Image = wx.createImage;
    }

    // 5. requestAnimationFrame polyfill
    if (typeof globalThis.requestAnimationFrame === 'undefined') {
      globalThis.requestAnimationFrame = function (cb) {
        return setTimeout(cb, 16);
      };
      globalThis.cancelAnimationFrame = function (id) {
        clearTimeout(id);
      };
    }
  },

};

export default PixiAdapter;
