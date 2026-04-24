// OpenMVS コンテナの管理

import { execSync } from 'node:child_process'

export class OpenMVSContainer {
  private containerId: string | null = null

  async start(): Promise<void> {
    // OpenMVS コンテナの起動
    const stdout = execSync('docker run -d openmvs').toString()
    this.containerId = stdout.trim()
  }

  async stop(): Promise<void> {
    if (this.containerId) {
      execSync(`docker stop ${this.containerId}`)
    }
  }

  async reconstruct(points3dPath: string, outputPath: string): Promise<void> {
    execSync(`docker exec ${this.containerId} openmvs reconstruct ${points3dPath} ${outputPath}`)
  }
}