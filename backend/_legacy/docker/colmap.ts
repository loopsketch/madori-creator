// COLMAP コンテナの管理

import { exec } from 'node:child_process'

export class ColmapContainer {
  private containerId: string | null = null

  async start(): Promise<void> {
    // COLMAP コンテナの起動
    await this.execCommand('docker run -d colmap')
    this.containerId = 'colmap'
  }

  async stop(): Promise<void> {
    if (this.containerId) {
      await this.execCommand(`docker stop ${this.containerId}`)
    }
  }

  async captureImage(imagePath: string): Promise<void> {
    await this.execCommand(`docker exec ${this.containerId} colmap capture ${imagePath}`)
  }

  async exportPoints3D(outputPath: string): Promise<void> {
    await this.execCommand(`docker exec ${this.containerId} colmap export points3d ${outputPath}`)
  }

  private execCommand(cmd: string): Promise<void> {
    return new Promise((resolve, reject) => {
      exec(cmd, { stdio: 'pipe' }, (error, stdout, stderr) => {
        if (error) {
          const errorDetails = {
            command: cmd,
            exitCode: error.code,
            stderr: stderr?.toString(),
            timestamp: new Date().toISOString()
          }
          console.error('COLMAP 実行失敗:', JSON.stringify(errorDetails))
          reject(new Error(`COLMAP 実行失敗：${error.message}`))
        } else {
          resolve()
        }
      })
    })
  }
}