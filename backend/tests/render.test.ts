import { renderTopdownDxf, renderTopdownSvg } from '../services/render'
import type { Floor, Wall } from '../types'

function makeWall(x1: number, y1: number, x2: number, y2: number): Wall {
  return {
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    zRange: { min: 0, max: 2.5 },
    normal: { x: 0, y: 1 },
    inlierCount: 100,
  }
}

function makeFloor(): Floor {
  return {
    normal: { x: 0, y: 0, z: 1 },
    distance: 0,
    inliers: [
      { x: 0, y: 0, z: 0 },
      { x: 5, y: 0, z: 0 },
      { x: 5, y: 5, z: 0 },
      { x: 0, y: 5, z: 0 },
    ],
    z: 0,
  }
}

describe('renderTopdownSvg', () => {
  it('壁が無くても空 SVG を返す (viewBox はデフォルトサイズ)', () => {
    const svg = renderTopdownSvg(undefined, [])
    expect(svg).toContain('<svg')
    expect(svg).toContain('viewBox=')
    expect(svg).toContain('class="walls"')
  })

  it('壁線が <line> 要素として含まれる', () => {
    const walls = [makeWall(0, 0, 5, 0), makeWall(5, 0, 5, 5)]
    const svg = renderTopdownSvg(undefined, walls)
    const lineCount = (svg.match(/<line /g) ?? []).length
    expect(lineCount).toBe(2)
  })

  it('床のインライアから <rect> が描画される', () => {
    const svg = renderTopdownSvg(makeFloor(), [])
    expect(svg).toContain('class="floor"')
    expect(svg).toContain('<rect')
  })

  it('Y 軸が反転される (壁の y > 0 が SVG 上で y < 0 に)', () => {
    const walls = [makeWall(0, 0, 0, 3)]
    const svg = renderTopdownSvg(undefined, walls)
    // 元の wall.start.y = 0 → SVG y1 = -0、wall.end.y = 3 → SVG y2 = -3
    expect(svg).toMatch(/y2="-3"/)
  })
})

describe('renderTopdownDxf', () => {
  it('R12 ヘッダと EOF を持つ', () => {
    const dxf = renderTopdownDxf(undefined, [])
    expect(dxf).toContain('SECTION')
    expect(dxf).toContain('AC1009') // ACAD R12
    expect(dxf).toContain('ENDSEC')
    expect(dxf).toContain('EOF')
  })

  it('LAYER テーブルに WALL と FLOOR が含まれる', () => {
    const dxf = renderTopdownDxf(undefined, [])
    expect(dxf).toContain('WALL')
    expect(dxf).toContain('FLOOR')
  })

  it('壁ごとに LINE エンティティが出る', () => {
    const walls = [makeWall(0, 0, 5, 0), makeWall(5, 0, 5, 5)]
    const dxf = renderTopdownDxf(undefined, walls)
    const lineCount = (dxf.match(/^\s*0\nLINE/gm) ?? []).length
    expect(lineCount).toBe(2)
  })

  it('床面があると LWPOLYLINE が含まれる', () => {
    const dxf = renderTopdownDxf(makeFloor(), [])
    expect(dxf).toContain('LWPOLYLINE')
  })
})
