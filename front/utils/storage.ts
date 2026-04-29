import { DrawingData } from '../types'

export class StorageManager {
  private readonly STORAGE_KEY = 'madori_drawings'

  async saveDrawing(drawing: DrawingData): Promise<void> {
    const drawings = await this.getDrawings()
    drawings.push(drawing)
    await this.setDrawings(drawings)
  }

  async getDrawings(): Promise<DrawingData[]> {
    try {
      const data = await localStorage.getItem(this.STORAGE_KEY)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  }

  async setDrawings(drawings: DrawingData[]): Promise<void> {
    try {
      await localStorage.setItem(this.STORAGE_KEY, JSON.stringify(drawings))
    } catch {
      // Quota exceeded の場合も無視
    }
  }

  async clear(): Promise<void> {
    try {
      await localStorage.removeItem(this.STORAGE_KEY)
    } catch {
      // 無視
    }
  }
}

export const storageManager = new StorageManager()
