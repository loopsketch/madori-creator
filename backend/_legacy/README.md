# _legacy/

issue #6 の初期実装で書かれたコード群。型エラー・配線不全・実行不能な状態のため、issue #6-1 (backend 基盤整備) の段階で本ディレクトリへ退避した。

`backend/tsconfig.json` の `exclude` に追加されており、TypeScript の型チェック対象外。エントリポイントからは参照しない。

後続の sub-issue で「資料」として参照しつつ再実装を行う。**必ずしも本コードをベースにする必要はない**（型・設計が破綻しているためリライト推奨の箇所が多い）。

## 復活予定対応表

| ファイル | 復活予定 sub-issue |
|----------|-------------------|
| `api/reconstruction.ts` | #6-2 以降で API 層として再構成 |
| `services/reconstruction.ts` | #6-5 床面・壁線抽出 (RANSAC) |
| `services/export.ts` | #6-6 SVG/DXF 出力 |
| `services/cache/inputHash.ts` | #6-7 キャッシュ層 |
| `services/cache/resultCache.ts` | #6-7 キャッシュ層 |
| `services/validators/imageValidator.ts` | #6-2 画像受信・検証 |
| `docker/colmap.ts` | #6-3 COLMAP Docker 連携 |
| `docker/openmvs.ts` | #6-4 OpenMVS Docker 連携 |
| `errors/reconstruction.ts` | 各 sub-issue で必要なものを切り出して復活 |
| `utils/queue.ts` | #6-7 非同期キュー |
| `types/task.ts` | `types/index.ts` と重複・矛盾していたため、再設計時に統合 |
| `tests/reconstruction.test.ts` | #6-5 でテストを書き直し |
| `tests/vitest.config.ts` | #6-1 で `backend/vitest.config.ts` として再作成済み |
| `tests/vitest.setup.ts` | 同上、必要があれば再作成 |

## 主な既知の問題（再実装時の参考）

- `api/reconstruction.ts`: `openmvs.reconstruct()` の引数欠落、`ReconstructionService.loadPoints3D` への引数型ミスマッチ
- `services/reconstruction.ts`: 引数 `path` と `import path from 'path'` の shadowing バグ (line 338)
- `docker/colmap.ts` / `openmvs.ts`: `exec(cmd, { stdio: 'pipe' }, ...)` は `exec` の API 誤用 (`stdio` は `spawn` のオプション)。docker コマンドも `docker run -d colmap` のように image 名のみで volume も無く実用不可
- `utils/queue.ts`: `fastq` 未インストール、`processReconstruction` 関数が未定義
- `types/task.ts`: `ReconstructionResult` を import していない、`ReconstructionOptions` が `types/index.ts` のものと別構造
- `tests/reconstruction.test.ts`: `describe`/`it`/`expect` を import せず globals 設定もないため実行不能
