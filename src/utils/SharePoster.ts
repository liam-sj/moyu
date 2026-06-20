import { getCachedPond, getPondById } from '../config/ponds'

export function generatePoster(): void {
  const cached = getCachedPond()
  if (!cached) return
  const pond = getPondById(cached.pondId)
  if (!pond) return

  const canvas = wx.createCanvas()
  canvas.width = 500; canvas.height = 400
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#1A252F'; ctx.fillRect(0, 0, 500, 400)

  // Fish emoji (text-based since we can't draw emoji easily)
  ctx.font = '60px sans-serif'; ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'center'; ctx.fillText(pond.emoji, 250, 80)

  ctx.font = 'bold 28px sans-serif'; ctx.fillText(pond.name, 250, 130)
  ctx.font = '16px sans-serif'; ctx.fillStyle = '#BDC3C7'; ctx.fillText(`"${pond.slogan}"`, 250, 165)

  ctx.font = 'bold 20px sans-serif'; ctx.fillStyle = '#F39C12'
  ctx.fillText(`今日贡献：${cached.todayContribution} 条鱼`, 250, 220)

  ctx.font = '14px sans-serif'; ctx.fillStyle = '#95A5A6'
  ctx.fillText('摸了个鱼 - 为鱼塘而战', 250, 350)

  // Convert to temp file and share
  canvas.toTempFilePath({
    success: (res: any) => {
      wx.shareAppMessage({
        title: `🐟 我在${pond.name}摸鱼！`,
        imageUrl: res.tempFilePath
      })
    }
  })
}
