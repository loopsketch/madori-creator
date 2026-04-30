import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'

// 背面カメラ映像を表示するコンポーネント。
// 撮影ループ自体は親 (App.tsx) が制御する。CameraView は video 要素を保持し、
// captureFrame() メソッドで現在のフレームを JPEG Blob と AlvaAR 用 ImageData の
// ペアとして返す。Blob と ImageData は同じ瞬間のフレームから生成される。

export interface CaptureFrameOptions {
  // JPEG 品質 (0-1)
  quality?: number
  // ImageData の縮小サイズ。AlvaAR は計算量を抑えるため 640x480 程度を想定
  downscale?: { width: number; height: number }
}

export interface CaptureFrameResult {
  blob: Blob | null
  imageData: ImageData | null
}

export interface CameraViewHandle {
  captureFrame: (options?: CaptureFrameOptions) => Promise<CaptureFrameResult>
  // AlvaAR の継続 tracking 用に、軽量に ImageData だけを取得する同期メソッド。
  captureImageData: (size?: { width: number; height: number }) => ImageData | null
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
    // ImageData (AlvaAR 入力) 用の縮小キャンバス
    const downscaleCanvasRef = useRef<HTMLCanvasElement>(null)
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
        captureImageData: (size = { width: 640, height: 480 }) => {
          const video = videoRef.current
          const downscaleCanvas = downscaleCanvasRef.current
          if (!video || !downscaleCanvas) return null
          if (video.videoWidth === 0 || video.videoHeight === 0) return null
          downscaleCanvas.width = size.width
          downscaleCanvas.height = size.height
          const ctx = downscaleCanvas.getContext('2d')
          if (!ctx) return null
          ctx.drawImage(video, 0, 0, size.width, size.height)
          return ctx.getImageData(0, 0, size.width, size.height)
        },
        captureFrame: async (options = {}) => {
          const video = videoRef.current
          const canvas = canvasRef.current
          const downscaleCanvas = downscaleCanvasRef.current
          const empty: CaptureFrameResult = { blob: null, imageData: null }
          if (!video || !canvas) return empty
          if (video.videoWidth === 0 || video.videoHeight === 0) return empty

          const quality = options.quality ?? 0.85
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          const ctx = canvas.getContext('2d')
          if (!ctx) return empty
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

          let imageData: ImageData | null = null
          if (downscaleCanvas) {
            const ds = options.downscale ?? { width: 640, height: 480 }
            downscaleCanvas.width = ds.width
            downscaleCanvas.height = ds.height
            const dctx = downscaleCanvas.getContext('2d')
            if (dctx) {
              dctx.drawImage(canvas, 0, 0, ds.width, ds.height)
              imageData = dctx.getImageData(0, 0, ds.width, ds.height)
            }
          }

          const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
          )
          return { blob, imageData }
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
        <canvas ref={downscaleCanvasRef} style={{ display: 'none' }} />

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
