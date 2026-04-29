import { useRef, useEffect, useState } from 'react'

interface CameraViewProps {
  className?: string
}

export function CameraView({ className = '' }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [hasMediaDevices, setHasMediaDevices] = useState(
    typeof navigator.mediaDevices?.getUserMedia !== 'undefined'
  )
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isCapturingRef = useRef(isCapturing)

  // isCapturing の値を常に最新に
  useEffect(() => {
    isCapturingRef.current = isCapturing
  }, [isCapturing])

  // 撮影トグルでループを制御
  useEffect(() => {
    if (isCapturing && ready) {
      startCaptureLoop()
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isCapturing, ready])

  // 撮影ボタンクリック時（トグル）
  const handleManualCapture = () => {
    if (!ready) return
    if (isCapturing) {
      // 撮影停止
      setIsCapturing(false)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    } else {
      // 撮影開始
      setIsCapturing(true)
    }
  }

  // 撮影処理
  const capture = async () => {
    try {
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

      // JPEGエンコード
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob(
          (blob) => resolve(blob!),
          'image/jpeg',
          0.9
        )
      })

      // バックエンドに送信（SfMに必要な情報だけ）
      const formData = new FormData()
      formData.append('image', blob, `capture_${Date.now()}.jpg`)

      const response = await fetch('/api/capture', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`)
      }

      const result = await response.json()
      console.log(`Captured: ${result.frameId}`)
    } catch (err) {
      console.error('Capture error:', err)
    }
  }

  // 自動撮影ループ開始
  const startCaptureLoop = () => {
    const intervalMs = 1000 // 1秒ごとにキャプチャ
    intervalRef.current = setInterval(() => {
      if (isCapturingRef.current) {
        capture()
      }
    }, intervalMs)
  }
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

  // 再試行ボタン
  const handleRetry = async () => {
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
            onClick={handleRetry}
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

      {/* 読み込み中表示 */}
      {(!ready && !isCapturing) && (
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

      {/* 撮影ボタン */}
      <button
        onClick={handleManualCapture}
        disabled={!ready && !isCapturing}
        style={{
          position: 'absolute',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          border: 'none',
          background: isCapturing ? '#ef4444' : '#ffffff',
          boxShadow: isCapturing ? '0 2px 12px rgba(239,68,68,0.4)' : '0 2px 12px rgba(0,0,0,0.4)',
          cursor: !ready && !isCapturing ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        }}
        aria-label="撮影"
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: isCapturing ? '#ffffff' : '#4f46e5',
          }}
        />
        <div style={{ fontSize: '10px', marginTop: '0.25rem', color: isCapturing ? '#fff' : '#4f46e5' }}>
          {isCapturing ? '停止' : '撮影'}
        </div>
      </button>
    </div>
  )
}
