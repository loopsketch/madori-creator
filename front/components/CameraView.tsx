import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'

// 背面カメラ映像を表示するコンポーネント。
// 撮影ループ自体は親 (App.tsx) が制御する。CameraView は video 要素を保持し、
// captureFrameBlob() メソッドで現在のフレームを JPEG Blob として返す。

export interface CameraViewHandle {
  captureFrameBlob: (quality?: number) => Promise<Blob | null>
  isReady: () => boolean
}

interface CameraViewProps {
  isCapturing: boolean
  onToggleCapture: () => void
}

export const CameraView = forwardRef<CameraViewHandle, CameraViewProps>(
  function CameraView({ isCapturing, onToggleCapture }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [ready, setReady] = useState(false)
    const [cameraError, setCameraError] = useState<string | null>(null)
    const [hasMediaDevices] = useState(
      typeof navigator !== 'undefined' &&
        typeof navigator.mediaDevices?.getUserMedia !== 'undefined'
    )

    // ビデオ準備状態の検知
    useEffect(() => {
      const video = videoRef.current
      if (!video) return
      const checkReady = () => {
        if (video.readyState >= 2 || (video.videoWidth > 0 && video.videoHeight > 0)) {
          setReady(true)
        }
      }
      video.onloadedmetadata = checkReady
      video.oncanplay = checkReady
      return () => {
        video.onloadedmetadata = null
        video.oncanplay = null
      }
    }, [])

    // カメラストリーム取得
    useEffect(() => {
      const video = videoRef.current
      if (!video || !hasMediaDevices) return
      let active = true
      let stream: MediaStream | null = null

      const startCamera = async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'environment',
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          })
          if (!active) {
            stream.getTracks().forEach((t) => t.stop())
            return
          }
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
        active = false
        if (stream) stream.getTracks().forEach((t) => t.stop())
      }
    }, [hasMediaDevices])

    useImperativeHandle(
      ref,
      () => ({
        isReady: () => ready,
        captureFrameBlob: async (quality = 0.85) => {
          const video = videoRef.current
          const canvas = canvasRef.current
          if (!video || !canvas) return null
          if (video.videoWidth === 0 || video.videoHeight === 0) return null
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          const ctx = canvas.getContext('2d')
          if (!ctx) return null
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          return await new Promise<Blob | null>((resolve) =>
            canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
          )
        },
      }),
      [ready]
    )

    return (
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {cameraError && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ff6b6b',
              fontWeight: 'bold',
              zIndex: 70,
              padding: '1rem',
              textAlign: 'center',
            }}
          >
            {cameraError}
          </div>
        )}

        {!ready && !cameraError && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              zIndex: 60,
            }}
          >
            読み込み中...
          </div>
        )}

        {/* 撮影開始/停止ボタン */}
        <button
          onClick={onToggleCapture}
          disabled={!ready && !isCapturing}
          style={{
            position: 'absolute',
            bottom: '2rem',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '88px',
            height: '88px',
            borderRadius: '50%',
            border: '4px solid #ffffff',
            background: isCapturing ? '#ef4444' : 'rgba(255,255,255,0.2)',
            cursor: ready ? 'pointer' : 'not-allowed',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            zIndex: 50,
          }}
          aria-label={isCapturing ? '撮影停止' : '撮影開始'}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: isCapturing ? '4px' : '50%',
              background: isCapturing ? '#fff' : '#ef4444',
              marginBottom: '4px',
            }}
          />
          {isCapturing ? '停止' : '開始'}
        </button>
      </div>
    )
  }
)
