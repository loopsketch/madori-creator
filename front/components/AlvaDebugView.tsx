import { useEffect, useRef } from 'react'
import * as alvaar from '../lib/alvaar'

// AlvaAR が認識している縮小画像と特徴点を可視化するデバッグビュー。
// active=true の間、requestAnimationFrame で 1 フレームごとに最新の
// ImageData と FramePoints を読み出して描画する。

interface Props {
  active: boolean
  width?: number
  height?: number
}

export function AlvaDebugView({ active, width = 160, height = 120 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tmpCanvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!active) return
    let rafId: number | null = null

    const tick = () => {
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const img = alvaar.getLatestImageData()
          if (img) {
            // ImageData は putImageData で一旦テンポラリ canvas に置き、
            // そこから drawImage で縮小描画する (putImageData は scale 不可)
            if (!tmpCanvasRef.current) tmpCanvasRef.current = document.createElement('canvas')
            const tmp = tmpCanvasRef.current
            if (tmp.width !== img.width || tmp.height !== img.height) {
              tmp.width = img.width
              tmp.height = img.height
            }
            const tctx = tmp.getContext('2d')
            if (tctx) {
              tctx.putImageData(img, 0, 0)
              ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height)
            }

            const sx = canvas.width / img.width
            const sy = canvas.height / img.height
            const points = alvaar.getLatestFramePoints()
            ctx.fillStyle = '#0f0'
            for (const p of points) {
              ctx.fillRect(p.x * sx - 1, p.y * sy - 1, 2, 2)
            }
            ctx.fillStyle = 'rgba(0,0,0,0.6)'
            ctx.fillRect(0, canvas.height - 14, canvas.width, 14)
            ctx.fillStyle = '#9f9'
            ctx.font = '10px sans-serif'
            ctx.fillText(`pts: ${points.length}`, 4, canvas.height - 4)
          } else {
            ctx.fillStyle = '#222'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            ctx.fillStyle = '#888'
            ctx.font = '10px sans-serif'
            ctx.fillText('no image', 4, 14)
          }
        }
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [active])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        display: 'block',
        background: '#000',
        border: '1px solid #444',
        width,
        height,
      }}
    />
  )
}
