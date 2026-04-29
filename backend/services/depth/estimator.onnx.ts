import * as ort from 'onnxruntime-node'
import sharp from 'sharp'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { DepthMap } from '../../types'

// Depth Anything V2 small の ONNX 推論。
//
// モデルファイルが無ければ起動時 (= 初回推論時) に Hugging Face からダウンロードする。
// docker-compose.yml で /app/models をボリュームマウントしているので 2 回目以降は永続化される。
//
// 入力: pixel_values [1, 3, 518, 518] (CHW、ImageNet 平均/分散で正規化)
// 出力: predicted_depth [1, 518, 518] (相対深度、絶対値ではない)

const DEFAULT_MODEL_URL =
  'https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/model.onnx'
const DEFAULT_MODEL_PATH = '/app/models/depth-anything-v2-small.onnx'

const INPUT_SIZE = 518
const MEAN = [0.485, 0.456, 0.406]
const STD = [0.229, 0.224, 0.225]

let sessionPromise: Promise<ort.InferenceSession> | null = null

export function isOnnxConfigured(): boolean {
  // 明示的に DEPTH_ESTIMATOR=mock の場合のみ無効化
  return process.env.DEPTH_ESTIMATOR !== 'mock'
}

export async function estimateDepthOnnx(imageBuffer: Buffer): Promise<DepthMap> {
  const session = await getSession()

  // 前処理: 518x518 にリサイズし、RGB の生バイト列を取り出す
  const { data: rgb } = await sharp(imageBuffer)
    .resize(INPUT_SIZE, INPUT_SIZE, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  // ImageNet normalize + CHW 化
  const tensor = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE)
  const planeSize = INPUT_SIZE * INPUT_SIZE
  for (let i = 0; i < planeSize; i++) {
    const r = rgb[i * 3] / 255
    const g = rgb[i * 3 + 1] / 255
    const b = rgb[i * 3 + 2] / 255
    tensor[i] = (r - MEAN[0]) / STD[0]
    tensor[planeSize + i] = (g - MEAN[1]) / STD[1]
    tensor[2 * planeSize + i] = (b - MEAN[2]) / STD[2]
  }

  const inputTensor = new ort.Tensor('float32', tensor, [1, 3, INPUT_SIZE, INPUT_SIZE])
  const result = await session.run({ pixel_values: inputTensor })
  const output = result.predicted_depth
  if (!output) throw new Error('predicted_depth が返却されませんでした')

  const dims = output.dims as readonly number[]
  let h: number
  let w: number
  if (dims.length === 3) {
    h = dims[1]
    w = dims[2]
  } else if (dims.length === 4) {
    h = dims[2]
    w = dims[3]
  } else {
    throw new Error(`unexpected output shape: ${dims.join('x')}`)
  }

  const src = output.data as Float32Array
  const data = new Float32Array(h * w)
  for (let i = 0; i < h * w; i++) data[i] = src[i]
  return { width: w, height: h, data }
}

async function getSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = ensureModelAndCreateSession().catch((err) => {
      sessionPromise = null
      throw err
    })
  }
  return sessionPromise
}

async function ensureModelAndCreateSession(): Promise<ort.InferenceSession> {
  const modelPath = process.env.DEPTH_MODEL_PATH ?? DEFAULT_MODEL_PATH
  const modelUrl = process.env.DEPTH_MODEL_URL ?? DEFAULT_MODEL_URL

  await fs.mkdir(path.dirname(modelPath), { recursive: true })
  const exists = await fs
    .access(modelPath)
    .then(() => true)
    .catch(() => false)

  if (!exists) {
    console.log(`[depth] モデルをダウンロードしています: ${modelUrl}`)
    const res = await fetch(modelUrl)
    if (!res.ok) {
      throw new Error(`モデルのダウンロードに失敗しました: HTTP ${res.status}`)
    }
    const arrayBuffer = await res.arrayBuffer()
    const tmpPath = `${modelPath}.tmp`
    await fs.writeFile(tmpPath, Buffer.from(arrayBuffer))
    await fs.rename(tmpPath, modelPath)
    console.log(`[depth] モデル保存完了: ${modelPath}`)
  }

  console.log(`[depth] ONNX セッションを作成中: ${modelPath}`)
  const session = await ort.InferenceSession.create(modelPath)
  console.log('[depth] ONNX セッション作成完了')
  return session
}

// テスト用にキャッシュをリセット
export function resetSessionForTesting(): void {
  sessionPromise = null
}
