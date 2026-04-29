// OpenMVS コンテナの管理

import { exec, execSync } from 'node:child_process'

export class OpenMVSContainer {
  private containerId: string | null = null

  async start(): Promise<void> {
    // OpenMVS コンテナの起動
    return new Promise((resolve, reject) => {
      exec('docker run -d openmvs', { stdio: 'pipe' }, (error, stdout) => {
        if (error) {
          const errorDetails = {
            command: 'docker run -d openmvs',
            exitCode: error.code,
            stderr: error.stderr?.toString(),
            timestamp: new Date().toISOString()
          }
          console.error('OpenMVS 起動失敗:', JSON.stringify(errorDetails))
          reject(new Error(`OpenMVS 起動失敗：${error.message}`))
        } else {
          this.containerId = stdout.trim()
          resolve()
        }
      })
    })
  }

  async stop(): Promise<void> {
    if (this.containerId) {
      exec(`docker stop ${this.containerId}`, { stdio: 'pipe' }, (error) => {
        if (error) {
          console.error('OpenMVS 停止失敗:', { command: `docker stop ${this.containerId}`, error: error.message })
        }
      })
    }
  }

  async reconstruct(points3dPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      exec(
        `docker exec ${this.containerId} openmvs reconstruct ${points3dPath} ${outputPath}`,
        { stdio: 'pipe' },
        (error, stdout, stderr) => {
          if (error) {
            const errorDetails = {
              command: `docker exec ${this.containerId} openmvs reconstruct`,
              exitCode: error.code,
              stderr: stderr?.toString(),
              timestamp: new Date().toISOString()
            }
            console.error('OpenMVS 再構築失敗:', JSON.stringify(errorDetails))
            reject(new Error(`OpenMVS 再構築失敗：${error.message}`))
          } else {
            resolve()
          }
        }
      )
    })
  }
}