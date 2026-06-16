import { createApp } from './bootstrap'
import { SceneManager } from './engine/SceneManager'
import { MenuScene } from './scenes/MenuScene'

const app = createApp()
document.body.appendChild(app.view as HTMLCanvasElement)

const manager = new SceneManager(app.stage)
manager.push(new MenuScene())

app.ticker.add(() => {
  manager.eventManager.clearHitAreas()
  manager.update(app.ticker.deltaMS / (1000 / 60))
})
