/**
 * WeChat Mini-Game adapter for PixiJS v7.
 * Must run BEFORE PixiJS is loaded (before importing pixi-legacy).
 * Provides missing DOM APIs that PixiJS expects.
 */

// Intl polyfill — runs at module body time so it's available
// when pixi.min.js loads (before PixiAdapter.install() is called).
if (typeof (globalThis as any).Intl === 'undefined') {
  (globalThis as any).Intl = {
    NumberFormat: function () { return { format: (n: number) => String(n), formatToParts: (n: number) => [{ type: 'integer', value: String(n) }], resolvedOptions: () => ({ locale: 'zh-CN' }) } },
    DateTimeFormat: function () { return { format: (d: any) => String(d), formatToParts: (d: any) => [{ type: 'literal', value: String(d) }], resolvedOptions: () => ({ locale: 'zh-CN' }) } },
    Collator: function () { return { compare: (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0, resolvedOptions: () => ({ locale: 'zh-CN' }) } },
    PluralRules: function () { return { select: () => 'other', resolvedOptions: () => ({ locale: 'zh-CN' }) } },
  }
}

// window event methods — PixiJS calls window.addEventListener('resize', ...)
// and since window = globalThis, globalThis must have these methods.
if (typeof (globalThis as any).addEventListener === 'undefined') {
  (globalThis as any).addEventListener = function () {}
  ;(globalThis as any).removeEventListener = function () {}
  ;(globalThis as any).dispatchEvent = function () {}
}

// performance polyfill — PixiJS Ticker uses performance.now() for timing
if (typeof (globalThis as any).performance === 'undefined') {
  (globalThis as any).performance = { now: () => Date.now() }
}

export function installPolyfills(): void {
  // 1. document.createElement — canvas via wx.createCanvas, rest mock
  if (typeof (globalThis as any).document === 'undefined') {
    (globalThis as any).document = {
      createElement: function (tagName: string) {
        if (tagName === 'canvas') {
          const c = wx.createCanvas()
          ;(c as any).type = 'canvas'
          // Article fix: canvas.__proto__.__proto__ must point to an
          // HTMLCanvasElement instance (not HTMLElement), otherwise
          // `canvas instanceof HTMLCanvasElement` is false and PixiJS
          // throws "Unrecognized source type to auto-detect Resource".
          if (!(c instanceof (globalThis as any).HTMLCanvasElement)) {
            ;(c as any).__proto__.__proto__ = new ((globalThis as any).HTMLCanvasElement)()
          }
          if (!(c as any).style) (c as any).style = {}
          // PixiJS EventSystem calls addEventListener on the canvas.
          // WeChat native canvases don't have DOM event methods.
          // Our EventManager handles touches via wx.onTouchStart.
          if (!(c as any).addEventListener) {
            ;(c as any).addEventListener = function () {}
            ;(c as any).removeEventListener = function () {}
            ;(c as any).dispatchEvent = function () {}
          }
          return c
        }
        return { tagName: tagName, style: {} }
      },
      createElementNS: function (_ns: string, tagName: string) {
        return (globalThis as any).document.createElement(tagName)
      },
      body: { appendChild: function () {}, removeChild: function () {} },
      head: { appendChild: function () {}, removeChild: function () {} },
      documentElement: { style: {} },
      addEventListener: function () {},
      removeEventListener: function () {},
      createEvent: function () { return {} },
      getElementById: function () { return null },
    }
  }

  // 1.5. Patch the main canvas with DOM event methods.
  // PixiJS EventSystem calls addEventListener on the view canvas.
  // Save reference so Game.js uses the same canvas object.
  const mainCanvas = (globalThis as any).canvas || wx.createCanvas()
  if (mainCanvas && !(mainCanvas as any).addEventListener) {
    ;(mainCanvas as any).addEventListener = function () {}
    ;(mainCanvas as any).removeEventListener = function () {}
    ;(mainCanvas as any).dispatchEvent = function () {}
  }
  // Expose so other modules can use the same patched canvas
  ;(globalThis as any).__pixi_main_canvas = mainCanvas

  // 2. window / location / navigator shim
  if (typeof (globalThis as any).window === 'undefined') {
    ;(globalThis as any).window = globalThis
  }
  if (!(globalThis as any).location) {
    ;(globalThis as any).location = { href: '', protocol: 'https:', host: '' }
  }
  if (!(globalThis as any).navigator) {
    ;(globalThis as any).navigator = { userAgent: 'WeChat', platform: 'WeChat' }
  }

  // 3. HTMLCanvasElement shim with Symbol.hasInstance
  // WeChat native canvas objects have immutable prototypes, so
  // Object.setPrototypeOf does not work. Use Symbol.hasInstance
  // so `canvas instanceof HTMLCanvasElement` returns true for
  // any object with a getContext method (what PixiJS checks).
  if (typeof (globalThis as any).HTMLCanvasElement === 'undefined') {
    ;(globalThis as any).HTMLCanvasElement = function () {}
    Object.defineProperty((globalThis as any).HTMLCanvasElement, Symbol.hasInstance, {
      value: function (instance: any) {
        return instance && typeof instance.getContext === 'function'
      },
      writable: false,
    })
  }

  // 4. Image — use wx.createImage() which returns a real Image object
  // with src/onload/onerror/width/height/complete — exactly what PixiJS expects.
  // PixiJS v7's BaseTexture.from(url) internally does `new Image(); img.src = url`
  // and listens for onload. wx.createImage() supports this perfectly.
  if (typeof (globalThis as any).Image === 'undefined') {
    ;(globalThis as any).Image = wx.createImage
  }

  // 5. requestAnimationFrame polyfill
  if (typeof (globalThis as any).requestAnimationFrame === 'undefined') {
    ;(globalThis as any).requestAnimationFrame = function (cb: () => void) {
      return setTimeout(cb, 16)
    }
    ;(globalThis as any).cancelAnimationFrame = function (id: number) {
      clearTimeout(id)
    }
  }
}

export function getMainCanvas(): any {
  return (globalThis as any).__pixi_main_canvas || wx.createCanvas()
}

/** Get screen-space (physical pixel) position of a PIXI container, accounting for stage scale */
export function screenPos(container: any): { x: number; y: number } {
  const gp = container.getGlobalPosition()
  return { x: gp.x, y: gp.y }
}

/** Device pixel ratio, cached */
let _dpr = 0
export function getDPR(): number {
  if (_dpr === 0) {
    _dpr = (typeof wx !== 'undefined' ? wx.getSystemInfoSync().pixelRatio : 1) || 2
  }
  return _dpr
}

/** Convert logical pixel value to physical screen pixels */
export function px(v: number): number {
  return v * getDPR()
}
