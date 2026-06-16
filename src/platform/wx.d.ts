// WeChat Mini-Game specific API extensions to the Wx interface.
// The @types/wechat-miniprogram package only covers Mini Program APIs;
// Mini-Games have additional methods like createCanvas() and createImage().

declare namespace WechatMiniprogram {
  interface Wx {
    /** Creates a canvas for Mini-Game rendering. */
    createCanvas(): any
    /** Creates an Image object for Mini-Game. */
    createImage(): any
    /** Register a touch start event listener (Mini-Game). */
    onTouchStart(cb: (e: any) => void): void
    /** Unregister a touch start event listener (Mini-Game). */
    offTouchStart(cb: (e: any) => void): void
  }
}
