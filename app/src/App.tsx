import React, { useRef, useCallback, useState } from 'react'
import { CameraView } from './components'
import { CanvasDrawing } from './components'
import { BirdEyeView } from './components/BirdEyeView'
import { Point } from './types'
import './index.css'

// App の簡易実装
function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawPoints, setDrawPoints] = useState<Point[]>([])

  const handleDraw = useCallback((points: Point[]) => {
    setDrawPoints(points)
  }, [])

  return (
    <div className="camera-container">
      {/* カメラ表示（背景） */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        zIndex: 0,
      }}>
        <CameraView />
      </div>

      {/* 描画レイヤー（カメラの上に描画） */}
      <CanvasDrawing onDraw={handleDraw} />

      {/* UI オーレイ（最前面） */}
      <div className="ui-overlay" style={{
        position: 'absolute',
        top: '1rem',
        left: '1rem',
        right: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        pointerEvents: 'none',
        zIndex: 10,
      }}>
        <div className="ui-element">
          <h2>間取り作成ツール</h2>
          <p>撮影ボタンで画像をキャプチャ</p>
          <p style={{ marginTop: '0.5rem' }}>
            描画した線：{drawPoints.length} 本
          </p>
        </div>

        {/* 鳥観図表示 */}
        <BirdEyeView points={drawPoints} />
      </div>
    </div>
  )
}

export default App
