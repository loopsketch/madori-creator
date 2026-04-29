import { Plane, Wall, ExportFormat } from '../types'

// エクスポートサービス（SVG/DXB）

export class ExportService {
  async exportSVG(planes: Plane[], walls: Wall[]): Promise<ExportFormat> {
    const svg = this.generateSVG(planes, walls)
    return { type: 'svg', content: svg }
  }

  async exportDXB(planes: Plane[], walls: Wall[]): Promise<ExportFormat> {
    const dxf = this.generateDXB(planes, walls)
    return { type: 'dxf', content: dxf }
  }

  private generateSVG(planes: Plane[], walls: Wall[]): string {
    let svg = '<?xml version="1.0" encoding="UTF-8"?>\n'
    svg += '<svg xmlns="http://www.w3.org/2000/svg">\n'

    // 床面の描画
    for (const plane of planes) {
      svg += `  <rect x="${plane.points[0].x}" y="${plane.points[0].y}" width="${plane.points[1].x}" height="${plane.points[1].y}"/>\n`
    }

    // 壁線の描画
    for (const wall of walls) {
      svg += `  <line x1="${wall.start.x}" y1="${wall.start.y}" x2="${wall.end.x}" y2="${wall.end.y}"/>\n`
    }

    svg += '</svg>'
    return svg
  }

  private generateDXB(planes: Plane[], walls: Wall[]): string {
    let dxf = 'DXF_EXPORT v1.0\n'

    // DXF形式の出力
    for (const plane of planes) {
      dxf += `PLANE ${plane.points.length}\n`
      for (const p of plane.points) {
        dxf += `  ${p.x} ${p.y} ${p.z}\n`
      }
    }

    for (const wall of walls) {
      dxf += `WALL ${wall.start.x} ${wall.start.y} ${wall.start.z} ${wall.end.x} ${wall.end.y} ${wall.end.z}\n`
    }

    return dxf
  }
}