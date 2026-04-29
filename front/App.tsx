import React, { useRef, useCallback, useState } from 'react'
import { CameraView } from './components'
import { CanvasDrawing } from './components'
import { Point } from './types'
import { closeSession, createSession, getHealth, postFrameToSession } from './lib/client'
import {
  getSnapshot,
  isSupported as isMotionSupported,
  requestMotionPermission,
  startTracking,
} from './lib/motion'
import './index.css'

// 撮影中の継続ループは #18 で実装する。本コンポーネントは
// API 疎通と DeviceMotion 取得の動作確認用ボタンだけを置く。
function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawPoints, setDrawPoints] = useState<Point[]>([])
  const [apiStatus, setApiStatus] = useState<string>('未接続')
  const [motionStatus, setMotionStatus] = useState<string>('未取得')

  const handleDraw = useCallback((points: Point[]) => {
    setDrawPoints(points)
  }, [])

  const handleApiTest = useCallback(async () => {
    setApiStatus('送信中...')
    try {
      const result = await getHealth()
      setApiStatus(`OK: ${result.status}`)
    } catch (err) {
      setApiStatus(`NG: ${(err as Error).message}`)
    }
  }, [])

  // motion 単発テスト: 許可 → トラッキング開始 → セッション作成 →
  //   テスト用 1x1 JPEG + motion を送信 → セッション削除。
  const handleMotionTest = useCallback(async () => {
    setMotionStatus('準備中...')
    try {
      if (!isMotionSupported()) {
        setMotionStatus('NG: DeviceMotion 非対応')
        return
      }
      const granted = await requestMotionPermission()
      if (!granted) {
        setMotionStatus('NG: 許可されませんでした')
        return
      }
      startTracking()
      // イベント到達まで少し待つ。0.6 秒程度あれば 1 回はサンプル取得できる。
      await new Promise((r) => setTimeout(r, 600))
      const motion = getSnapshot()

      const session = await createSession()
      const blob = await makeDummyJpeg()
      const frame = await postFrameToSession(session.sessionId, blob, motion)
      await closeSession(session.sessionId)

      const g = motion.gravity
      const gStr = g ? `g=(${g.x.toFixed(2)},${g.y.toFixed(2)},${g.z.toFixed(2)})` : 'g=なし'
      const oriented = frame.worldOrientation ? '姿勢確定' : '姿勢未確定'
      setMotionStatus(`OK: ${gStr} ${oriented}`)
    } catch (err) {
      setMotionStatus(`NG: ${(err as Error).message}`)
    }
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
          <div style={{ marginTop: '0.5rem', pointerEvents: 'auto' }}>
            <button onClick={handleApiTest} style={{ fontSize: '0.85rem' }}>
              API 疎通テスト
            </button>
            <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}>{apiStatus}</span>
          </div>
          <div style={{ marginTop: '0.5rem', pointerEvents: 'auto' }}>
            <button onClick={handleMotionTest} style={{ fontSize: '0.85rem' }}>
              motion テスト送信
            </button>
            <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}>{motionStatus}</span>
          </div>
        </div>

        {/* 鳥観図 (BirdEyeView) は #13 の SVG 上面ビュー実装で置き換える予定のため、
            ここでは非表示にしている。レイアウト被りを避ける目的。 */}
      </div>
    </div>
  )
}

// 1x1 ピクセルの透明 JPEG (本物の JPEG として最低限通る最小データ)。
// テスト送信用。実際の撮影フレームは canvas.toBlob で生成する想定。
async function makeDummyJpeg(): Promise<Blob> {
  // canvas で 64x64 のノイズ画像を作って JPEG 化する。MIN_FILE_BYTES (10KB) を満たす。
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas context not available')
  const data = ctx.createImageData(canvas.width, canvas.height)
  for (let i = 0; i < data.data.length; i += 4) {
    data.data[i] = (i * 13) & 0xff
    data.data[i + 1] = (i * 31) & 0xff
    data.data[i + 2] = (i * 53) & 0xff
    data.data[i + 3] = 0xff
  }
  ctx.putImageData(data, 0, 0)
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9)
  )
  if (!blob) throw new Error('toBlob failed')
  return blob
}

export default App
