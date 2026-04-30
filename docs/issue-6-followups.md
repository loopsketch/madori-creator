---
title: issue #6 残課題まとめ
---

# issue #6 サーバー処理実装 (Phase 2) の残課題

[issue #6](https://github.com/loopsketch/madori-creator/issues/6) と派生 sub-issue (#9〜#18) は [PR #19](https://github.com/loopsketch/madori-creator/pull/19) で一通りマージされ closed になったが、運用・実機テスト・将来 Phase に持ち越した項目が複数ある。本ドキュメントは「issue #6 系列のあと、何が残っているか」を一望するためのもの。

関連: [architecture.md](architecture.md) / [development.md](development.md) / [structure.md](structure.md)

## sub-issue 進捗サマリ

| # | タイトル | 状態 | 備考 |
|---|---------|------|------|
| #9 | 画像受信・検証パイプライン | closed | multer + Sharp + validator 完了 |
| #10 | COLMAP Docker 連携 | closed (未実装) | real-time 方針への切替で取りやめ |
| #11 | OpenMVS Docker 連携 | closed (未実装) | 同上 |
| #12 | 床面・壁線抽出 (RANSAC) | closed | 軽量実装で完了。品質は要改善 (後述) |
| #13 | SVG/DXF 出力整備 | closed | 上面ビュー SVG + AutoCAD R12 DXF 実装。CAD 互換性検証は未完 |
| #14 | セッションストアの Redis 永続化 | closed | Repository 抽象 + Redis 実装。再起動跨ぎ動作検証は未完了 |
| #15 | セッション API 設計と実装 | closed | POST/GET/DELETE /api/sessions, POST .../frames |
| #16 | 単眼深度推定 (ONNX) | closed | Depth Anything V2 small。性能目標は未達 |
| #17 | DeviceMotion + 疑似スケール | closed | 重力で世界座標確定、持ち手 150cm 仮定 |
| #18 | フロント撮影ストリーミング UI | closed | レスポンス駆動ループで SVG 逐次反映 |
| #20 | ONNX 推論の GPU (CUDA) 化 | open | Phase 3 へ向けた性能改善 (開発機 CUDA 利用可) |

## 1. PR #19 の Test plan で未確認のままの項目

PR #19 のテスト計画で `- [ ]` のまま残っている項目。実装はあるが運用検証だけが未完。

- [ ] `docker compose restart backend` してもセッションが残ること (Redis 永続化の確認)
- [ ] `curl -X POST -F frame=@...jpg` でフレームを送ると JSON レスポンスに SVG が含まれること
- [ ] `DELETE` で `finalSvg` と `finalDxf` が返り、Redis から key が削除されること

### 推奨アクション
- E2E 用の小さな bash スクリプト (`scripts/e2e-session.sh` 程度) を追加し、CI でも回せる形にする
- Redis 永続化の検証は `docker compose restart backend` 前後で `GET /api/sessions/:id` の `totalFrames` が維持されることを確認

## 2. 各 sub-issue の完了条件で未チェックのままの項目

issue 本文のチェックボックスは PR で機械的にチェックされなかったものが多い。実装済み = 動作確認も済んでいる、とは限らない点に注意。

### #12 床面・壁線抽出
- [ ] サンプル点群から平面 (床) を1つ以上抽出できる ← 単体テストでは確認、実フレームで検証は別件
- [ ] 床と直交する壁線が抽出できる
- 既知の課題: フレームごとに RANSAC を独立実行しているため、検出される壁線が安定せず**フレーム間で増減する**

### #13 SVG/DXF 出力
- [ ] SVG がブラウザで描画される (frontend MapView で表示はしているが、サイズ・スケールバー等は未整備)
- [ ] **DXF が LibreCAD で開ける** ← 互換性の実機検証が未完。AutoCAD R12 DXF として書き出しているが要確認
- viewBox とスケール (1m=1unit, Y 反転) は揃っているが、レイヤー化 (壁・床・天井の `<g>`) は単純化されている

### #16 単眼深度推定
- **1フレームの推論時間 <500ms 目標**: issue #20 で GPU 化対応中
  - backend イメージを `nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04` へ切替済 (#20)
  - `docker-compose.yml` に GPU 予約追加済 (#20)
  - `ONNX_EXECUTION_PROVIDER` 環境変数 (auto / cuda / cpu) 追加済 (#20)
  - 実機での推論時間計測は #20 内で実施
  - GPU 化でも目標未達なら、より軽量なモデル (MiDaS small 等) への切替を再検討
- カメラ intrinsics は機種推定をやめ「横画角 77° の固定値」になっているため、機種判別の余地あり

### #17 DeviceMotion + 疑似スケール
- 設定 UI (校正画面) は将来スコープとして据え置き。現状はコードに固定値 `HAND_HELD_HEIGHT_M = 1.5m`

## 3. issue #6 で「後回し」と明記された項目

issue #6 のコメント (作業変更) で意図的にスコープ外にした事項。

- **データのエクスポート処理は後回し**: SVG/DXF の最低限は #13 で実装したが、レイヤー構造の完全表現や CAD 互換テストは Phase 3 へ
- **鳥観図を重ね合わせ表示**: 撮影中に間取り図を鳥瞰図として重ねて表示する UI。階層判断 (1F/2F 等) も含めて未着手
- **単体テスト**: backend 53 件 / frontend 2 件で完了済み。frontend 側のカバレッジ拡充は継続課題

## 4. PR #19 の「既知の制約」として明示された将来課題

撮影 → 間取り図のパイプラインは通ったが、**「使える間取り図」品質には未到達**。本格的に役立てるには次フェーズで以下に取り組む必要がある。

| 項目 | 内容 | 想定アプローチ |
|------|------|--------------|
| 絶対スケールが出ない | 単眼カメラ原理上の制約 | ユーザー校正 UI (最初の壁長入力)、AR 系 API (WebXR) 併用、両眼/ToF 端末対応 |
| 壁線が増減して安定しない | フレームごと独立 RANSAC | 壁線の時系列クラスタリング、信頼度ベースのマージ、Kalman フィルタ |
| 姿勢が初期固定 | worldOrientation が初期値で固定。撮影中に向きを変えると点群が歪む | 簡易 Visual-Inertial 推定、DeviceMotion の継続積分、本格 SLAM (ORB-SLAM3 等) |
| 階層 (1F/2F 等) 認識なし | 鳥瞰図の重ね合わせ表示の前提 | 重力方向の累積位置から床高さクラスタリング |

これらは **Phase 3 (issue #7)** や新規 issue 群で取り扱う想定。issue #7 は現在 OPEN だが Phase 3 のスコープ整理は未着手。

## 5. backend/_legacy/ の扱い

`backend/_legacy/` は issue #6-1 で退避した旧コード。real-time 方針への切替で **#10/#11 (COLMAP/OpenMVS) は復活予定なし**。残るファイルの状況:

| _legacy ファイル | 当初の復活予定 | 現状 |
|------------------|--------------|------|
| `api/reconstruction.ts` | #6-2 | #9 で新規実装済 (コードは資料扱い) |
| `services/reconstruction.ts` | #12 | #12 でリライト済 |
| `services/export.ts` | #13 | #13 でリライト済 |
| `services/cache/*` | #14 | #14 のスコープ変更 (Redis 永続化に集約) で**未復活** |
| `services/validators/imageValidator.ts` | #9 | #9 で新規実装 |
| `docker/{colmap,openmvs}.ts` | #10/#11 | **復活予定なし** (close) |
| `errors/reconstruction.ts` | 各 sub-issue | 一部のみ復活 (`InputValidationError` / `ImageProcessingError`) |
| `utils/queue.ts` | #14 | **復活予定なし** (レスポンス駆動と相性が悪い) |
| `types/task.ts` | 統合 | `types/index.ts` に統合済 |

### 推奨アクション
- `_legacy/` は資料としての価値が薄れている。Phase 3 着手時に削除するか、`docs/legacy-reference.md` に要点だけ抽出して退避する判断を行う

## 6. インフラ・運用面の積み残し

PR #19 では触れていないが、運用に乗せる前に必要になる項目。

- **本番ビルド経路の未整備**: `Dockerfile` は `npm run dev` を CMD にしている。`vite build` + `vite preview` or 静的配信、backend は `tsc` ビルド成果物の `node` 起動への切替が必要
- **CI 未整備**: GitHub Actions 等で `type-check` + `vitest` を回す設定なし
- **MySQL 未使用**: `docker-compose.yml` に `db` がいるが backend からは未接続。セッション履歴の長期保存が必要なら設計から
- **証明書管理**: 自己署名のまま。LAN 開発はこれで OK だが、本番想定なら Let's Encrypt or 別経路
- **モデル DL 失敗時のリトライ**: 現状は ONNX 失敗時にモック深度へ恒久フォールバック。ネットワーク復旧後の再試行ポリシーなし
- **ログ整備**: `console.log` ベース。構造化ログ (pino 等) と外部送出は未整備

## 7. 次に着手するなら何から

依存と効果を考慮した推奨順 (あくまで提案):

1. **Test plan の未確認 3 項目** を E2E スクリプトで自動化 (1 日)
2. **撮影中の姿勢追従** (issue #23): 重力ベクトルを毎フレーム更新して点群歪みを軽減 (#17 の延長、3〜5 日)
3. **壁線の時系列マージ** (issue #22): フレーム間でクラスタリングし安定化 (#12 の延長、5〜7 日)
4. **校正 UI** (issue #24): 「最初の壁の長さ」入力でスケール補正 (#17 の将来分、3 日)
5. **本番ビルド経路と CI** (1〜2 日)

2〜4 は Phase 3 (issue #7) のスコープ分解として #22 / #23 / #24 に切り出し済み。

### Phase 3 送り (短期スコープ外)

- **DXF の CAD 互換性検証** (LibreCAD で実物を開く) → 不備があれば書き出しを修正。issue #5 のクローズ条件には含めず、Phase 3 (issue #7) で扱う
- ONNX 推論の GPU 化 (issue #20) は PR #21 でマージ済み
