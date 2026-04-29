import { queue, TaskQueue } from 'fastq'

export interface ReconstructionTask {
  id: string
  images: string[]
  options?: any
}

export interface TaskResult {
  taskId: string
  result: any
  duration: number
}

const MAX_CONCURRENCY = 4

export const reconstructionQueue: TaskQueue<ReconstructionTask, TaskResult> = queue(
  async (task: ReconstructionTask, callback: (error: Error | null, result: TaskResult) => void) => {
    const start = Date.now()

    // 実際の再構築処理
    const result = await processReconstruction(task)

    const duration = Date.now() - start
    console.log(`再構築完了 (taskId: ${task.id}, 所要時間：${duration}ms)`)

    callback(null, { taskId: task.id, result, duration })
  },
  {
    concurrency: MAX_CONCURRENCY,
    autoStart: false
  }
)

reconstructionQueue.drain()
  .on('error', (error) => {
    console.error(`キューエラー (taskId: ${error.taskId}):`, error)
  })

export function isQueueBusy(): boolean {
  return reconstructionQueue.running() >= reconstructionQueue.concurrency()
}

export async function pushTask(task: ReconstructionTask): Promise<void> {
  const startTime = Date.now()

  try {
    await reconstructionQueue.push(task)
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`キュー推論失敗 (taskId: ${task.id}, 所要時間：${duration}ms)`, error)
    throw error
  }
}
