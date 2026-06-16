type Handler<T = any> = (payload: T) => void

export class EventBus {
  private map = new Map<string, Set<Handler>>()

  on<T = any>(type: string, h: Handler<T>): () => void {
    let set = this.map.get(type)
    if (!set) {
      set = new Set()
      this.map.set(type, set)
    }
    set.add(h as Handler)
    return () => this.off(type, h)
  }

  off<T = any>(type: string, h: Handler<T>): void {
    this.map.get(type)?.delete(h as Handler)
  }

  emit<T = any>(type: string, payload?: T): void {
    const handlers = this.map.get(type)
    if (!handlers) return
    handlers.forEach((h) => {
      try { h(payload) } catch (e) { console.error(`[EventBus] handler error for "${type}":`, e) }
    })
  }

  clear(): void {
    this.map.clear()
  }
}
