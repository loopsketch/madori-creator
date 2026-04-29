import { calibrateFromMotion, HAND_HELD_HEIGHT_M } from '../services/scale/calibrator'

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
