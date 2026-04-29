import React, { useCallback, useRef, useState } from 'react'
import {
  CameraView,
  CanvasDrawing,
  MapView,
  type CameraViewHandle,
} from './components'
import { Point } from './types'
import {
  closeSession,
  createSession,
  postFrameToSession,
} from './lib/client'
import {
  getSnapshot,
  isSupported as isMotionSupported,
  requestMotionPermission,
  startTracking,
  stopTracking,
} from './lib/motion'
import './index.css'

// 撮影ストリーミング UI。
// レスポンス駆動ループで 1 フレームずつ backend に送り、返ってきた SVG を MapView に
// 反映する。停止時は最終 SVG をそのまま表示しっぱなしにする。

function App() {
  const cameraRef = useRef<CameraViewHandle>(null)
  const capturingRef = useRef<boolean>(false)
  const sessionIdRef = useRef<string | null>(null)
  const [drawPoints, setDrawPoints] = useState<Point[]>([])
  const [isCapturing, setIsCapturing] = useState(false)
  const [svg, setSvg] = useState<string | undefined>(undefined)
  const [frameCount, setFrameCount] = useState(0)
  const [latencyMs, setLatencyMs] = useState<number | null>(null)
  const [statusMessage, setStatusMessage] = useState<string>('待機中')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleDraw = useCallback((points: Point[]) => {
    setDrawPoints(points)
  }, [])

  const captureLoop = useCallback(async (sid: string) => {
    while (capturingRef.current) {
      const blob = await cameraRef.current?.captureFrameBlob().catch(() => null)
      if (!blob) {
        // ビデオがまだ準備できていない等。少し待って再試行。
        await new Promise((r) => setTimeout(r, 100))
        continue
      }
      const motion = getSnapshot()
      const t0 = performance.now()
      try {
        const result = await postFrameToSession(sid, blob, motion)
        setLatencyMs(Math.round(performance.now() - t0))
        setSvg(result.svg)
        setFrameCount(result.totalFrames)
      } catch (err) {
        setErrorMessage((err as Error).message)
        capturingRef.current = false
        setIsCapturing(false)
        break
      }
    }
  }, [])

  const handleToggleCapture = useCallback(async () => {
    if (capturingRef.current) {
      // 停止
      capturingRef.current = false
      setIsCapturing(false)
      setStatusMessage('停止処理中...')
      const sid = sessionIdRef.current
      if (sid) {
        try {
          const result = await closeSession(sid)
          setSvg(result.finalSvg)
          setStatusMessage(`完了: ${result.totalFrames} フレーム`)
        } catch (err) {
          setErrorMessage((err as Error).message)
          setStatusMessage('停止 (エラー)')
        }
        sessionIdRef.current = null
      }
      stopTracking()
      return
    }

    // 開始
    setErrorMessage(null)
    setStatusMessage('準備中...')
    if (!isMotionSupported()) {
      setErrorMessage('DeviceMotion 非対応のブラウザです')
      setStatusMessage('待機中')
      return
    }
    const granted = await requestMotionPermission().catch(() => false)
    if (!granted) {
      setErrorMessage('motion 許可が得られませんでした')
      setStatusMessage('待機中')
      return
    }
    startTracking()

    try {
      const session = await createSession()
      sessionIdRef.current = session.sessionId
      setFrameCount(0)
      setLatencyMs(null)
      setStatusMessage('撮影中')
      capturingRef.current = true
      setIsCapturing(true)
      // 非同期でループ起動 (await せず)
      captureLoop(session.sessionId)
    } catch (err) {
      stopTracking()
      setErrorMessage((err as Error).message)
      setStatusMessage('待機中')
    }
  }, [captureLoop])

  return (
    <div className="camera-container">
      {/* カメラ表示 (背景) と撮影ボタン */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          zIndex: 0,
        }}
      >
        <CameraView
          ref={cameraRef}
          isCapturing={isCapturing}
          onToggleCapture={handleToggleCapture}
        />
      </div>

      {/* 描画レイヤー */}
      <CanvasDrawing onDraw={handleDraw} />

      {/* UI オーバーレイ */}
      <div
        className="ui-overlay"
        style={{
          position: 'absolute',
          top: '1rem',
          left: '1rem',
          right: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          pointerEvents: 'none',
          zIndex: 10,
          gap: '0.5rem',
        }}
      >
        <div className="ui-element" style={{ maxWidth: 'calc(100% - 220px)' }}>
          <h2 style={{ fontSize: '1rem', margin: 0 }}>間取り作成ツール</h2>
          <p style={{ margin: '0.25rem 0', fontSize: '0.8rem' }}>状態: {statusMessage}</p>
          <p style={{ margin: '0.25rem 0', fontSize: '0.8rem' }}>
            frames: {frameCount}
            {latencyMs !== null ? ` / last ${latencyMs}ms` : ''}
          </p>
          <p style={{ margin: '0.25rem 0', fontSize: '0.7rem', color: '#aaa' }}>
            描画線: {drawPoints.length} 本
          </p>
          {errorMessage && (
            <p style={{ margin: '0.25rem 0', fontSize: '0.75rem', color: '#ff8888' }}>
              ! {errorMessage}
            </p>
          )}
        </div>

        {/* 間取り図 SVG (右上) */}
        <MapView svg={svg} width={200} height={200} />
      </div>
    </div>
  )
}

export default App
