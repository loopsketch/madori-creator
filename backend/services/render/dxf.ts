import type { Floor, Wall } from '../../types'

// 上面ビューを最小限の AutoCAD R12 形式 DXF (テキスト) として出力する。
//
// LibreCAD / AutoCAD で読み込めるレベルの最低限の構造を備える:
//   - HEADER (バージョン)
//   - TABLES > LAYER テーブル (WALL / FLOOR の 2 レイヤー)
//   - ENTITIES (壁線は LINE、床は LWPOLYLINE)
//
// 単位は m を維持。CAD 側で挿入時に縮尺指定可能。

export function renderTopdownDxf(floor: Floor | undefined, walls: Wall[]): string {
  return [
    section('HEADER', [
      // ACAD R12
      pair(9, '$ACADVER'),
      pair(1, 'AC1009'),
      pair(9, '$INSUNITS'),
      pair(70, '6'), // 6 = meter
    ]),
    section('TABLES', [
      ...table('LAYER', [
        layer('WALL', 7),
        layer('FLOOR', 5),
      ]),
    ]),
    section('ENTITIES', [
      ...renderFloorEntity(floor),
      ...renderWallEntities(walls),
    ]),
    pair(0, 'EOF'),
  ].join('\n')
}

function section(name: string, body: string[]): string {
  return [pair(0, 'SECTION'), pair(2, name), ...body, pair(0, 'ENDSEC')].join('\n')
}

function table(name: string, body: string[][]): string[] {
  return [
    pair(0, 'TABLE'),
    pair(2, name),
    pair(70, String(body.length)),
    ...body.flat(),
    pair(0, 'ENDTAB'),
  ]
}

function layer(name: string, color: number): string[] {
  return [
    pair(0, 'LAYER'),
    pair(2, name),
    pair(70, '0'), // フラグ (0 = 通常)
    pair(62, String(color)), // 色番号 (ACI)
    pair(6, 'CONTINUOUS'),
  ]
}

function pair(code: number, value: string): string {
  // DXF はタグ-値の 2 行ペア構造。タグは右寄せ 3 桁文字列にしておくと読みやすい。
  return `${code.toString().padStart(3, ' ')}\n${value}`
}

function renderWallEntities(walls: Wall[]): string[] {
  const lines: string[] = []
  for (const w of walls) {
    lines.push(
      pair(0, 'LINE'),
      pair(8, 'WALL'),
      pair(10, w.start.x.toString()),
      pair(20, w.start.y.toString()),
      pair(30, w.zRange.min.toString()),
      pair(11, w.end.x.toString()),
      pair(21, w.end.y.toString()),
      pair(31, w.zRange.min.toString())
    )
  }
  return lines
}

function renderFloorEntity(floor: Floor | undefined): string[] {
  if (!floor || floor.inliers.length < 3) return []
  // 床インライアの 2D bbox を矩形 LWPOLYLINE で出力 (簡易版)。
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
  return [
    pair(0, 'LWPOLYLINE'),
    pair(8, 'FLOOR'),
    pair(90, '4'), // 頂点数
    pair(70, '1'), // 閉じたポリライン
    pair(10, xMin.toString()),
    pair(20, yMin.toString()),
    pair(10, xMax.toString()),
    pair(20, yMin.toString()),
    pair(10, xMax.toString()),
    pair(20, yMax.toString()),
    pair(10, xMin.toString()),
    pair(20, yMax.toString()),
  ]
}
