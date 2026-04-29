import type { ProcessedImage, ReconstructionStatus, TaskMetadata } from '../../types'

// in-memory のタスクストア。プロセス再起動で消える前提。
// 永続化と分散対応は #14 で Redis ベースに置き換える想定。

const tasks = new Map<string, TaskMetadata>()

export interface CreateTaskInput {
  taskId: string
  imageDir: string
  images: ProcessedImage[]
}

export function createTask(input: CreateTaskInput): TaskMetadata {
  const meta: TaskMetadata = {
    taskId: input.taskId,
    status: 'received',
    createdAt: new Date().toISOString(),
    imageCount: input.images.length,
    imageDir: input.imageDir,
    images: input.images,
  }
  tasks.set(meta.taskId, meta)
  return meta
}

export function getTask(taskId: string): TaskMetadata | undefined {
  return tasks.get(taskId)
}

export function updateTaskStatus(taskId: string, status: ReconstructionStatus): TaskMetadata | undefined {
  const meta = tasks.get(taskId)
  if (!meta) return undefined
  meta.status = status
  return meta
}

// テスト用。本番コードからは呼ばない。
export function clearTasksForTesting(): void {
  tasks.clear()
}
