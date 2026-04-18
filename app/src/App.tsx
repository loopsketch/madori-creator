import React, { useState, useRef, useCallback } from 'react'
import { CameraView } from './components'
import { CanvasDrawing } from './components'
import { Point, DrawingData } from './types'
import { storageManager } from './utils/storage'
import './index.css'

// App の簡易実装
function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawPoints, setDrawPoints] = useState<Point[]>([])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [drawingName, setDrawingName] = useState('未命名')

  const handleDraw = useCallback((points: Point[]) => {
    setDrawPoints(points)
  }, [])

  const handleSave = async () => {
    const drawing: DrawingData = {
      name: drawingName,
      timestamp: Date.now(),
      data: drawPoints,
    }
    await storageManager.saveDrawing(drawing)
    setShowSaveDialog(false)
    alert('間取り図が保存されました！')
  }

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
          <p>壁をタップ・ドラッグして描画します</p>
          <p style={{ marginTop: '0.5rem' }}>
            描画した線：{drawPoints.length} 本
          </p>
        </div>

        <div className="ui-element">
          <button className="btn btn-primary" onClick={() => setShowSaveDialog(true)}>
            保存
          </button>
        </div>
      </div>

      {/* 保存ダイアログ */}
      {showSaveDialog && (
        <div className="dialog-overlay" onClick={() => setShowSaveDialog(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>間取り図を保存</h3>
            <input
              type="text"
              value={drawingName}
              onChange={(e) => setDrawingName(e.target.value)}
              placeholder="名前を入力"
              style={{
                width: '100%',
                padding: '0.75rem',
                marginTop: '1rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: '#2d2d44',
                color: '#fff',
                fontSize: '1rem',
              }}
            />
            <div className="dialog-actions">
              <button className="btn btn-danger" onClick={() => setShowSaveDialog(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
