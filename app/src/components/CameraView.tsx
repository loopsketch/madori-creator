import { useRef, useEffect, useState } from 'react'

interface CameraViewProps {
  className?: string
}

export function CameraView({ className = '' }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const [mode, setMode] = useState<'manual' | 'stream'>('manual')
  const [captureInterval, setCaptureInterval] = useState(1000)
  const [capturing, setCapturing] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(3)
  const [captureCount, setCaptureCount] = useState(0)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [hasMediaDevices, setHasMediaDevices] = useState(
    typeof navigator.mediaDevices?.getUserMedia !== 'undefined'
  )
  const captureIntervalRef = useRef<number | null>(null)

  // 手動撮影
  const handleManualCapture = () => {
    if (!ready) return
    capture()
  }

  // 撮影処理
  const capture = async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    // canvas のサイズをビデオに合わせる
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // 画像を描画
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // サーバーへのアップロード
    await uploadToServer()

    // 撮影カウント
    setCaptureCount((prev) => prev + 1)
  }

  // サーバーへのアップロード
  const uploadToServer = async () => {
    try {
      const canvas = canvasRef.current
      const video = videoRef.current
      if (!canvas || !video) return

      // canvas のサイズをビデオに合わせる
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      // 画像を描画
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // toBlob で Blob を生成
      return new Promise<void>((resolve, reject) => {
        if (canvas.width === 0 || canvas.height === 0) {
          console.error('Canvas dimensions are 0')
          return
        }

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              console.error('Failed to create blob')
              return
            }

            const fileName = `capture_${Date.now()}.jpg`
            const link = document.createElement('a')
            link.href = URL.createObjectURL(blob)
            link.download = fileName
            link.style.display = 'none'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(link.href)

            console.log(`Captured: ${fileName}`)
            resolve()
          },
          'image/jpeg',
          0.9
        )
      })
    } catch (err) {
      console.error('Upload error:', err)
    }
  }

  // 自動撮影タイマー
  useEffect(() => {
    if (capturing && mode === 'stream' && ready) {
      captureIntervalRef.current = setInterval(() => {
        capture()
      }, captureInterval)
      return () => {
        if (captureIntervalRef.current) clearInterval(captureIntervalRef.current)
      }
    }
  }, [capturing, mode, ready, captureInterval])

  // ビデオ読み込み完了時の準備
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // readystate === 2 で準備就绪（ネットワークデータ読み込み完了）
    const checkReady = () => {
      if (video.readyState >= 2 || video.videoWidth > 0 && video.videoHeight > 0) {
        setReady(true)
      }
    }

    video.onloadedmetadata = () => checkReady()
    video.oncanplay = () => checkReady()

    return () => {
      video.onloadedmetadata = null
      video.oncanplay = null
    }
  }, [])

  // カメラストリームの取得
  useEffect(() => {
    const video = videoRef.current
    if (!video || !hasMediaDevices) return

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices!.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        })
        video.srcObject = stream
      } catch (err: unknown) {
        const message =
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'カメラのアクセスを許可してください'
            : err instanceof DOMException && err.name === 'NotFoundError'
              ? 'カメラが見つかりません'
              : 'カメラアクセスに失敗しました'
        setCameraError(message)
      }
    }

    startCamera()

    return () => {
      const stream = video.srcObject
      if (stream instanceof MediaStream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [hasMediaDevices])

  // タイムアウトで準備就绪とする（フォールバック）
  useEffect(() => {
    const video = videoRef.current
    if (!video || !hasMediaDevices) return

    const timer = setTimeout(() => {
      setReady(true)
    }, 3000)

    return () => clearTimeout(timer)
  }, [hasMediaDevices])

  // 手動モードへの切り替え
  const switchToManual = () => {
    setMode('manual')
    setCapturing(false)
  }

  const handleStartCamera = async () => {
    setCameraError(null)
    const video = videoRef.current
    if (!video || !hasMediaDevices) return

    try {
      const stream = await navigator.mediaDevices!.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      video.srcObject = stream
      setReady(true)
    } catch (err: unknown) {
      setCameraError('カメラアクセスに失敗しました')
    }
  }

  return (
    <div className={className}>
      <video ref={videoRef} autoPlay playsInline muted />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* カメラエラー表示 */}
      {cameraError && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            zIndex: 70,
            padding: '1rem',
            textAlign: 'center',
          }}
        >
          <div style={{ color: '#ff6b6b', fontSize: '18px', fontWeight: 'bold' }}>
            {cameraError}
          </div>
          {!hasMediaDevices && (
            <div style={{ color: '#aaa', fontSize: '14px' }}>
              このブラウザはカメラに対応していない可能性があります
              <br />
              HTTPS環境または対応ブラウザ（Chrome / Safari）をご利用ください
            </div>
          )}
          <button
            onClick={handleStartCamera}
            style={{
              background: '#4f46e5',
              color: '#fff',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            再試行
          </button>
        </div>
      )}

      {/* 撮影中オーバーレイ */}
      {capturing && mode === 'stream' && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          <div style={{ color: 'white', textAlign: 'center' }}>
            <div style={{ fontSize: '24px' }}>{timerSeconds}s</div>
            <div style={{ marginTop: '0.5rem' }}>自動撮影中...</div>
            <div style={{ fontSize: '12px', marginTop: '0.25rem' }}>
              撮影数：{captureCount}
            </div>
          </div>
        </div>
      )}

      {/* 基本 UI */}
      <div
        style={{
          position: 'absolute',
          bottom: '1rem',
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.5rem',
          pointerEvents: mode === 'stream' ? 'none' : 'auto',
          zIndex: 40,
        }}
      >
        {/* モード切り替え */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            background: 'rgba(0,0,0,0.6)',
            padding: '0.25rem 0.5rem',
            borderRadius: '0.5rem',
          }}
        >
          <button
            onClick={switchToManual}
            style={{
              background: mode === 'manual' ? '#fff' : 'transparent',
              color: mode === 'manual' ? '#000' : '#fff',
              border: 'none',
              padding: '0.25rem 0.75rem',
              borderRadius: '0.25rem',
              cursor: capturing ? 'not-allowed' : 'pointer',
            }}
          >
            手動
          </button>
          <button
            onClick={() => {
              setMode('stream')
              setCapturing(true)
              setTimerSeconds(3)
            }}
            style={{
              background: mode === 'stream' ? '#fff' : 'transparent',
              color: mode === 'stream' ? '#000' : '#fff',
              border: 'none',
              padding: '0.25rem 0.75rem',
              borderRadius: '0.25rem',
              cursor: capturing ? 'not-allowed' : 'pointer',
            }}
          >
            自動
          </button>
        </div>

        {/* 自動撮影設定 */}
        {mode === 'manual' && (
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              background: 'rgba(0,0,0,0.6)',
              padding: '0.25rem 0.5rem',
              borderRadius: '0.5rem',
            }}
          >
            <label>
              間隔：
              <select
                value={captureInterval}
                onChange={(e) => setCaptureInterval(Number(e.target.value))}
                style={{ marginLeft: '0.25rem' }}
              >
                <option value={500}>0.5 秒</option>
                <option value={1000}>1 秒</option>
                <option value={2000}>2 秒</option>
                <option value={5000}>5 秒</option>
              </select>
            </label>
          </div>
        )}

        {/* 撮影ボタン（手動モードのみ有効） */}
        <button
          onClick={handleManualCapture}
          disabled={capturing || !ready || mode !== 'manual'}
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            border: 'none',
            background: capturing ? '#ccc' : (ready ? '#fff' : '#999'),
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            cursor: capturing || !ready || mode !== 'manual' ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
          }}
        >
          •
        </button>

        {/* 読み込み中表示 */}
        {!ready && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 60,
            }}
          >
            <div style={{ color: 'white', fontSize: '18px' }}>読み込み中...</div>
          </div>
        )}
      </div>
    </div>
  )
}
