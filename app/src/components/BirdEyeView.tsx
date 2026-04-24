// 鳥観図表示コンポーネント

import React, { useRef, useEffect } from 'react'

export function BirdEyeView({ points, height = 200, width = 300 }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return

    // クリア
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    // 壁線を描画
    ctx.strokeStyle = '#0000ff'
    ctx.lineWidth = 2

    for (let i = 0; i < points.length; i++) {
      const current = points[i]
      const next = i < points.length - 1 ? points[i + 1] : points[0]

      ctx.beginPath()
      ctx.moveTo(current.x, current.y)
      ctx.lineTo(next.x, next.y)
      ctx.stroke()
    }
  }, [points, width, height])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: '1rem',
        left: '1rem',
        zIndex: 5,
      }}
    />
  )
}