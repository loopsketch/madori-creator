import type { Floor, Wall } from '../../types'

// 累積壁線・床面を上面ビューで SVG レンダリングする。
//
// 世界座標は北 = +Y で扱っているが、SVG の Y 軸は下向きが正のため
// 描画時は Y 座標を反転して「北を画面上に」並ぶようにする。
// 単位は m を保ち、stroke-width は m 単位の値を直接書く (例: 0.05m = 5cm)。

export interface SvgOptions {
  // 周囲に確保する余白 (m)
  marginM?: number
  // viewBox 最小幅 (m)。点群がほぼ無い段階でも描画が崩れないように下限を持たせる
  minSizeM?: number
}

export function renderTopdownSvg(
  floor: Floor | undefined,
  walls: Wall[],
  options: SvgOptions = {}
): string {
  const margin = options.marginM ?? 0.5
  const minSize = options.minSizeM ?? 4

  const bounds = computeBounds(walls, margin, minSize)
  const { x: minX, y: minY, width, height } = bounds
  // SVG の Y を反転するため、viewBox の Y は -maxY 起点
  const viewBox = `${minX} ${-(minY + height)} ${width} ${height}`

  const floorSvg = renderFloor(floor)
  const wallsSvg = renderWalls(walls)

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">`,
    '  <rect x="' +
      minX +
      '" y="' +
      -(minY + height) +
      '" width="' +
      width +
      '" height="' +
      height +
      '" fill="#ffffff"/>',
    floorSvg,
    wallsSvg,
    '</svg>',
  ].join('\n')
}

interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

function computeBounds(walls: Wall[], margin: number, minSize: number): Bounds {
  if (walls.length === 0) {
    const half = minSize / 2
    return { x: -half, y: -half, width: minSize, height: minSize }
  }

  let xMin = Number.POSITIVE_INFINITY
  let xMax = Number.NEGATIVE_INFINITY
  let yMin = Number.POSITIVE_INFINITY
  let yMax = Number.NEGATIVE_INFINITY
  for (const wall of walls) {
    xMin = Math.min(xMin, wall.start.x, wall.end.x)
    xMax = Math.max(xMax, wall.start.x, wall.end.x)
    yMin = Math.min(yMin, wall.start.y, wall.end.y)
    yMax = Math.max(yMax, wall.start.y, wall.end.y)
  }

  let width = xMax - xMin
  let height = yMax - yMin
  if (width < minSize) {
    const pad = (minSize - width) / 2
    xMin -= pad
    width = minSize
  }
  if (height < minSize) {
    const pad = (minSize - height) / 2
    yMin -= pad
    height = minSize
  }
  return {
    x: xMin - margin,
    y: yMin - margin,
    width: width + margin * 2,
    height: height + margin * 2,
  }
}

function renderFloor(floor: Floor | undefined): string {
  if (!floor || floor.inliers.length < 3) {
    return '  <g class="floor"></g>'
  }

  // 床のインライアの 2D bbox を矩形で描画。本格的な凸包は実装簡易化のため省略。
  let xMin = Number.POSITIVE_INFINITY
  let xMax = Number.NEGATIVE_INFINITY
  let yMin = Number.POSITIVE_INFINITY
  let yMax = Number.NEGATIVE_INFINITY
  for (const p of floor.inliers) {
    xMin = Math.min(xMin, p.x)
    xMax = Math.max(xMax, p.x)
    yMin = Math.min(yMin, p.y)
    yMax = Math.max(yMax, p.y)
  }
  const w = xMax - xMin
  const h = yMax - yMin
  return [
    '  <g class="floor">',
    `    <rect x="${xMin}" y="${-yMax}" width="${w}" height="${h}" fill="#e8f1ff" stroke="none"/>`,
    '  </g>',
  ].join('\n')
}

function renderWalls(walls: Wall[]): string {
  if (walls.length === 0) {
    return '  <g class="walls"></g>'
  }

  const lines = walls
    .map((w) => {
      const x1 = w.start.x
      const y1 = -w.start.y
      const x2 = w.end.x
      const y2 = -w.end.y
      return `    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`
    })
    .join('\n')

  return [
    '  <g class="walls" stroke="#1f2937" stroke-width="0.05" stroke-linecap="round">',
    lines,
    '  </g>',
  ].join('\n')
}
