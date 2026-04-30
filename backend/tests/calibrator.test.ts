import {
  calibrateFromMotion,
  computeFrameOrientation,
  HAND_HELD_HEIGHT_M,
  transformAlvaPose,
} from '../services/scale/calibrator'
import type { RotationMatrix3 } from '../types'

// 4x4 列優先の単位行列。
function identity4(): number[] {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
}

// 4x4 列優先の rigid (回転無し + translation) を作る。
function translate4(tx: number, ty: number, tz: number): number[] {
  const m = identity4()
  m[12] = tx
  m[13] = ty
  m[14] = tz
  return m
}

// 4x4 列優先で +Z 軸周りに angleRad 回転する rigid を作る。
function rotZ4(angleRad: number): number[] {
  const c = Math.cos(angleRad)
  const s = Math.sin(angleRad)
  // 列優先: col k = R × e_k
  return [
    c, s, 0, 0,    // col 0 = (c, s, 0)
    -s, c, 0, 0,   // col 1 = (-s, c, 0)
    0, 0, 1, 0,    // col 2 = (0, 0, 1)
    0, 0, 0, 1,
  ]
}

// 回転行列に対して v_camera を掛けた結果を返す
function applyMatrix(R: number[], v: { x: number; y: number; z: number }) {
  return {
    x: R[0] * v.x + R[1] * v.y + R[2] * v.z,
    y: R[3] * v.x + R[4] * v.y + R[5] * v.z,
    z: R[6] * v.x + R[7] * v.y + R[8] * v.z,
  }
}

describe('calibrateFromMotion', () => {
  it('motion 無しでも持ち手 150cm のスケールヒントを返す', () => {
    const r = calibrateFromMotion(undefined)
    expect(r.worldOrientation).toBeUndefined()
    expect(r.scaleHint.handHeldHeightM).toBe(HAND_HELD_HEIGHT_M)
  })

  it('重力ベクトルが極端に小さいと回転行列を返さない', () => {
    const r = calibrateFromMotion({ gravity: { x: 0, y: 0, z: 0 } })
    expect(r.worldOrientation).toBeUndefined()
  })

  it('重力長が地球の値から大きくずれると回転行列を返さない', () => {
    const r = calibrateFromMotion({ gravity: { x: 0, y: -2, z: 0 } })
    expect(r.worldOrientation).toBeUndefined()
    expect(r.scaleHint.gravityMagnitudeRatio).toBeCloseTo(2 / 9.80665, 5)
  })

  it('カメラ Y 軸下向きで重力 (0,-9.8,0) なら、worldZ = (0,1,0) (camera) に対応する回転を返す', () => {
    // camera 座標で重力が camera -Y → 世界の上 (worldZ) は camera +Y
    // R * camera +Y = world Z = (0,0,1) になっているはず
    const r = calibrateFromMotion({ gravity: { x: 0, y: -9.80665, z: 0 } })
    expect(r.worldOrientation).toBeDefined()
    const v = applyMatrix(r.worldOrientation as number[], { x: 0, y: 1, z: 0 })
    expect(v.x).toBeCloseTo(0, 5)
    expect(v.y).toBeCloseTo(0, 5)
    expect(v.z).toBeCloseTo(1, 5)
  })

  it('カメラ +X が世界 X とおおよそ一致する (重力が camera -Y のとき)', () => {
    const r = calibrateFromMotion({ gravity: { x: 0, y: -9.80665, z: 0 } })
    const xWorld = applyMatrix(r.worldOrientation as number[], { x: 1, y: 0, z: 0 })
    // カメラ +X は水平で、世界 X 軸とほぼ平行になる
    expect(xWorld.z).toBeCloseTo(0, 5)
    expect(Math.abs(xWorld.x)).toBeCloseTo(1, 5)
  })

  it('傾いた重力でも正規直交基底を生成する', () => {
    const r = calibrateFromMotion({
      gravity: { x: -1.0, y: -9.5, z: 1.5 },
    })
    expect(r.worldOrientation).toBeDefined()
    const R = r.worldOrientation as number[]
    // 行列の各行ベクトルが単位長
    for (let i = 0; i < 3; i++) {
      const row = [R[i * 3], R[i * 3 + 1], R[i * 3 + 2]]
      const len = Math.sqrt(row[0] ** 2 + row[1] ** 2 + row[2] ** 2)
      expect(len).toBeCloseTo(1, 5)
    }
    // 行同士の内積はほぼ 0 (直交)
    const dot01 = R[0] * R[3] + R[1] * R[4] + R[2] * R[5]
    const dot02 = R[0] * R[6] + R[1] * R[7] + R[2] * R[8]
    const dot12 = R[3] * R[6] + R[4] * R[7] + R[5] * R[8]
    expect(dot01).toBeCloseTo(0, 5)
    expect(dot02).toBeCloseTo(0, 5)
    expect(dot12).toBeCloseTo(0, 5)
  })
})

describe('computeFrameOrientation', () => {
  // 標準姿勢 (重力 camera -Y) の base orientation
  const baseGravity = { x: 0, y: -9.80665, z: 0 }
  const baseOrientation = calibrateFromMotion({ gravity: baseGravity })
    .worldOrientation as RotationMatrix3

  it('motion 無しなら undefined を返す', () => {
    const r = computeFrameOrientation(undefined, baseOrientation)
    expect(r).toBeUndefined()
  })

  it('gravity 無しの motion なら undefined を返す', () => {
    const r = computeFrameOrientation({ timestamp: 1 }, baseOrientation)
    expect(r).toBeUndefined()
  })

  it('重力長が極端に小さいと undefined を返す', () => {
    const r = computeFrameOrientation(
      { gravity: { x: 0, y: 0, z: 0 } },
      baseOrientation
    )
    expect(r).toBeUndefined()
  })

  it('同じ重力なら baseOrientation とほぼ一致する', () => {
    const r = computeFrameOrientation(
      { gravity: baseGravity },
      baseOrientation
    )
    expect(r).toBeDefined()
    for (let i = 0; i < 9; i++) {
      expect((r as RotationMatrix3)[i]).toBeCloseTo(baseOrientation[i], 5)
    }
  })

  it('レンズを床に向けた姿勢で camera +Z が world +Z (天井) を指す', () => {
    // 端末縦持ち通常: 重力 camera -Y。レンズを床に向けると端末の -Z (レンズ方向)
    // が下を向き、camera +Z (画面手前) が天井を向く。
    // 重力は camera 座標で (0, 0, -9.80665) と観測される。
    // → world Z (= -gravity/|g|) は camera +Z 方向 → R * (0,0,1) は world (0,0,1)
    const tilted = computeFrameOrientation(
      { gravity: { x: 0, y: 0, z: -9.80665 } },
      baseOrientation
    ) as RotationMatrix3
    expect(tilted).toBeDefined()
    // camera +Z (0,0,1) を world に変換: (R[2], R[5], R[8])
    expect(tilted[2]).toBeCloseTo(0, 5)
    expect(tilted[5]).toBeCloseTo(0, 5)
    expect(tilted[8]).toBeCloseTo(1, 5)
  })

  it('alpha 90 度の差で yaw が world Z 軸周りに 90 度回転する', () => {
    // alpha は時計回り正 → 上から見て反時計回り回転として適用
    const baseAlpha = 0
    const motion = {
      gravity: baseGravity,
      orientation: { alpha: 90, beta: 0, gamma: 0 },
    }
    const r = computeFrameOrientation(motion, baseOrientation, baseAlpha) as RotationMatrix3
    expect(r).toBeDefined()
    // 元の worldX (= camera +X) が world 上で 90° 回って world +Y or -Y を向くはず
    // R は camera→world なので、camera +X (1,0,0) を変換すると world での向きが出る
    const xWorld = {
      x: r[0] * 1 + r[1] * 0 + r[2] * 0,
      y: r[3] * 1 + r[4] * 0 + r[5] * 0,
      z: r[6] * 1 + r[7] * 0 + r[8] * 0,
    }
    // ほぼ水平で、x 成分はほぼ 0、y 成分の絶対値はほぼ 1
    expect(xWorld.z).toBeCloseTo(0, 5)
    expect(Math.abs(xWorld.x)).toBeLessThan(0.05)
    expect(Math.abs(xWorld.y)).toBeCloseTo(1, 5)
  })

  it('alpha が片方だけ未指定だと yaw=0 として扱う', () => {
    // baseAlpha 無しの場合、alpha があっても yaw 補正はかからない
    const motion = {
      gravity: baseGravity,
      orientation: { alpha: 90, beta: 0, gamma: 0 },
    }
    const r = computeFrameOrientation(motion, baseOrientation) as RotationMatrix3
    expect(r).toBeDefined()
    for (let i = 0; i < 9; i++) {
      expect(r[i]).toBeCloseTo(baseOrientation[i], 5)
    }
  })

  it('正規直交性が保たれる', () => {
    const r = computeFrameOrientation(
      { gravity: { x: -2, y: -9, z: 1 } },
      baseOrientation
    ) as RotationMatrix3
    expect(r).toBeDefined()
    for (let i = 0; i < 3; i++) {
      const row = [r[i * 3], r[i * 3 + 1], r[i * 3 + 2]]
      const len = Math.sqrt(row[0] ** 2 + row[1] ** 2 + row[2] ** 2)
      expect(len).toBeCloseTo(1, 5)
    }
    const dot01 = r[0] * r[3] + r[1] * r[4] + r[2] * r[5]
    const dot12 = r[3] * r[6] + r[4] * r[7] + r[5] * r[8]
    expect(dot01).toBeCloseTo(0, 5)
    expect(dot12).toBeCloseTo(0, 5)
  })
})

describe('transformAlvaPose', () => {
  const baseOrientation = calibrateFromMotion({
    gravity: { x: 0, y: -9.80665, z: 0 },
  }).worldOrientation as RotationMatrix3

  it('入力長が不足すると undefined', () => {
    expect(transformAlvaPose([], identity4(), baseOrientation)).toBeUndefined()
    expect(transformAlvaPose(identity4(), [], baseOrientation)).toBeUndefined()
  })

  it('current=base なら translation はゼロ、rotation は baseOrientation と一致', () => {
    const r = transformAlvaPose(identity4(), identity4(), baseOrientation)
    expect(r).toBeDefined()
    expect(r!.translation.x).toBeCloseTo(0, 6)
    expect(r!.translation.y).toBeCloseTo(0, 6)
    expect(r!.translation.z).toBeCloseTo(0, 6)
    for (let i = 0; i < 9; i++) {
      expect(r!.rotation[i]).toBeCloseTo(baseOrientation[i], 6)
    }
  })

  it('AR_world で +X 方向に 1m 移動すると translation は baseOrientation × (1,0,0)', () => {
    const cur = translate4(1, 0, 0)
    const r = transformAlvaPose(cur, identity4(), baseOrientation)!
    // baseOrientation × (1,0,0) = (R[0], R[3], R[6])
    expect(r.translation.x).toBeCloseTo(baseOrientation[0], 6)
    expect(r.translation.y).toBeCloseTo(baseOrientation[3], 6)
    expect(r.translation.z).toBeCloseTo(baseOrientation[6], 6)
  })

  it('basePose をオフセットしても相対変位だけが反映される', () => {
    const base = translate4(5, 2, -3)
    const cur = translate4(6, 2, -3) // base から +X に 1m
    const r = transformAlvaPose(cur, base, baseOrientation)!
    expect(r.translation.x).toBeCloseTo(baseOrientation[0], 6)
    expect(r.translation.y).toBeCloseTo(baseOrientation[3], 6)
    expect(r.translation.z).toBeCloseTo(baseOrientation[6], 6)
  })

  it('rotation 行列の正規直交性が保たれる', () => {
    const cur = translate4(0.5, -0.2, 0.3)
    const r = transformAlvaPose(cur, identity4(), baseOrientation)!
    for (let i = 0; i < 3; i++) {
      const row = [r.rotation[i * 3], r.rotation[i * 3 + 1], r.rotation[i * 3 + 2]]
      const len = Math.sqrt(row[0] ** 2 + row[1] ** 2 + row[2] ** 2)
      expect(len).toBeCloseTo(1, 5)
    }
  })

  it('+Z 軸周りに 90 度回転した currentPose は世界座標で正しく rotZ(90) として現れる', () => {
    // 重力 (0, 0, -9.80665) なら baseOrientation は identity になる
    const baseI = calibrateFromMotion({
      gravity: { x: 0, y: 0, z: -9.80665 },
    }).worldOrientation as RotationMatrix3
    const cur = rotZ4(Math.PI / 2)
    const r = transformAlvaPose(cur, identity4(), baseI)!
    // 期待: rotation = rotZ(90) (row-major)
    // = [[0, -1, 0], [1, 0, 0], [0, 0, 1]]
    const expected = [0, -1, 0, 1, 0, 0, 0, 0, 1]
    for (let i = 0; i < 9; i++) {
      expect(r.rotation[i]).toBeCloseTo(expected[i], 6)
    }
  })

  it('basePose に rotation がある場合、相対 pose だけが反映される', () => {
    const baseI = calibrateFromMotion({
      gravity: { x: 0, y: 0, z: -9.80665 },
    }).worldOrientation as RotationMatrix3
    // base: +Z 軸 90 度、cur: +Z 軸 180 度 → 相対 +Z 軸 90 度
    const base = rotZ4(Math.PI / 2)
    const cur = rotZ4(Math.PI)
    const r = transformAlvaPose(cur, base, baseI)!
    // 期待: rotation = rotZ(90) (旧バグの転置版なら rotZ(-90) になり検出できる)
    const expected = [0, -1, 0, 1, 0, 0, 0, 0, 1]
    for (let i = 0; i < 9; i++) {
      expect(r.rotation[i]).toBeCloseTo(expected[i], 5)
    }
  })

  it('basePose の rotation+translation が逆変換される', () => {
    const baseI = calibrateFromMotion({
      gravity: { x: 0, y: 0, z: -9.80665 },
    }).worldOrientation as RotationMatrix3
    // base に rotation + translation。cur は base と同じ → 相対は identity
    const base = rotZ4(Math.PI / 2)
    base[12] = 3
    base[13] = -1
    base[14] = 2
    const cur = base.slice()
    const r = transformAlvaPose(cur, base, baseI)!
    expect(r.translation.x).toBeCloseTo(0, 5)
    expect(r.translation.y).toBeCloseTo(0, 5)
    expect(r.translation.z).toBeCloseTo(0, 5)
    // rotation も identity
    const expected = [1, 0, 0, 0, 1, 0, 0, 0, 1]
    for (let i = 0; i < 9; i++) {
      expect(r.rotation[i]).toBeCloseTo(expected[i], 5)
    }
  })
})
