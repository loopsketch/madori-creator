import { useRef, useEffect, useCallback, useState } from 'react'
import { Point } from '../types'

interface CanvasDrawingProps {
  className?: string
  onDraw?: (points: Point[]) => void
}

export function CanvasDrawing({ className = '', onDraw }: CanvasDrawingProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const isDrawing = useRef(false)
  const segmentPoints = useRef<Point[]>([]) // 描画中のセグメント
  const segments = useRef<Point[][]>([]) // 完了したセグメント
  const segmentsRef = useRef<Point[][]>([]) // onDraw用
  const canvasSize = useRef<{ width: number; height: number }>({ width: 0, height: 0 })
  const [pointCount, setPointCount] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctxRef.current = ctx

    // カンバスサイズを保持
    const updateCanvasSize = () => {
      canvasSize.current = {
        width: canvas.offsetWidth,
        height: canvas.offsetHeight,
      }
      redraw()
    }

    updateCanvasSize()
    window.addEventListener('resize', updateCanvasSize)

    return () => {
      window.removeEventListener('resize', updateCanvasSize)
    }
  }, [])

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!canvas || !ctx) return

    // セグメントをクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 完了したセグメントを再描画
    segments.current.forEach((segment) => {
      if (segment.length >= 2) {
        ctx.beginPath()
        ctx.moveTo(segment[0].x, segment[0].y)
        for (let i = 1; i < segment.length; i++) {
          ctx.lineTo(segment[i].x, segment[i].y)
        }
        ctx.strokeStyle = '#1a1a2e'
        ctx.lineWidth = 3
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.stroke()
      }
    })
  }, [])

  const getCoordinates = useCallback((e: React.MouseEvent | React.TouchEvent): Point | null => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    }
  }, [])

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const point = getCoordinates(e)
    if (!point) return

    isDrawing.current = true
    segmentPoints.current = [point]
    redraw()
  }, [getCoordinates, redraw])

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return
    e.preventDefault()

    const point = getCoordinates(e)
    if (!point) return

    segmentPoints.current.push(point)
    redraw()
  }, [getCoordinates, redraw])

  const stopDrawing = useCallback(() => {
    isDrawing.current = false
    if (segmentPoints.current.length >= 2) {
      segments.current.push(segmentPoints.current)
      segmentsRef.current = segments.current
      setPointCount(prev => prev + segmentPoints.current.length)
    }
    segmentPoints.current = []
    redraw()
  }, [redraw])

  const prevCountRef = useRef(0)

  useEffect(() => {
    const count = segmentsRef.current.length
    if (count > prevCountRef.current) {
      onDraw?.(segmentsRef.current.flat())
      prevCountRef.current = count
    }
  }, [onDraw])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: '100%', height: '100%', touchAction: 'none' }}
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing}
      onTouchStart={startDrawing}
      onTouchMove={draw}
      onTouchEnd={stopDrawing}
    />
  )
}
