---
title: フォルダ構成
---

# フォルダ構成

リポジトリのトップレベルとサブディレクトリの役割をまとめる。実装の詳細は [architecture.md](architecture.md)、起動方法は [development.md](development.md) を参照。

## トップレベル

```
madori-creator/
├── README.md              プロジェクト概要・実機テスト手順
├── CLAUDE.md              プロジェクト固有の運用ガイドライン
├── docker-compose.yml     開発環境一式 (frontend / backend / nginx / db / redis)
├── docs/                  設計・運用ドキュメント
├── docker/                各サービスの Dockerfile / 設定ファイル
├── front/                 フロントエンド (React + Vite + PWA)
├── backend/               バックエンド (Express + ONNX Runtime)
└── res/                   実機テスト用のリソース置き場 (画像など、現在は空)
```

## docs/

| ファイル | 内容 |
|---------|------|
| [architecture.md](architecture.md) | システム全体の設計、撮影フロー、処理パイプライン、API 設計 |
| [development.md](development.md) | 開発環境の起動・停止、環境変数、テスト、トラブルシュート |
| [structure.md](structure.md) | (本ファイル) フォルダ構成 |
| [issue-6-followups.md](issue-6-followups.md) | issue #6 系列の残課題 (実機検証・将来 Phase へ持ち越した項目) |
| [mlserver.md](mlserver.md) | MASt3R-SLAM 推論サーバ (issue #30) のビルド・起動手順 |

## docker/

各サービスの Dockerfile と設定。Compose の `build.context` は各アプリディレクトリを指し、Dockerfile はこちらから参照する構成。

```
docker/
├── backend/Dockerfile     nvidia/cuda:12.4.1-cudnn-runtime ベース (onnxruntime-node + CUDA EP)
├── front/Dockerfile       node:20-alpine ベース
├── mlserver/Dockerfile    nvidia/cuda:12.4.1-cudnn-devel + Python 3.11 + MASt3R-SLAM (issue #30)
└── nginx/
    ├── nginx.conf         /api → backend:3000、/__vite_ws → frontend:3000、/ → frontend:3000
    ├── generate-certs.sh  自己署名証明書生成スクリプト
    └── certs/             server.crt / server.key (CN=localhost, 同梱)
```

## front/

```
front/
├── index.html             SPA エントリ
├── main.tsx               React マウント
├── App.tsx                撮影ループ + UI 全体 (レスポンス駆動でフレーム送信)
├── index.css              グローバル CSS
├── vite.config.ts         Vite + PWA + HMR over wss + /api プロキシ設定
├── tsconfig.json
├── vitest.config.ts
├── package.json
├── components/            UI コンポーネント
│   ├── CameraView.tsx       getUserMedia とフレームキャプチャ
│   ├── CanvasDrawing.tsx    画面上の手書きレイヤ (補助)
│   ├── MapView.tsx          受信した SVG を表示
│   ├── BirdEyeView.tsx      上面ビュー (補助)
│   └── index.ts             バレル
├── lib/                   API クライアント・センサ
│   ├── client.ts            /api 呼び出しラッパ (createSession / postFrame / closeSession)
│   ├── motion.ts            DeviceMotion / DeviceOrientation の許可と取得
│   └── types.ts             API レスポンス型
├── utils/
│   └── storage.ts           localStorage ヘルパ
├── types/index.ts         共通型 (Point など)
└── tests/                 vitest テスト
```

## backend/

```
backend/
├── index.ts               Express 起動とセッションストア初期化
├── package.json
├── tsconfig.json          _legacy を exclude
├── vitest.config.ts
├── api/                   ルーティング層
│   ├── index.ts             /api ルータ集約
│   ├── sessions.ts          POST/GET/DELETE /api/sessions と POST /:id/frames
│   └── reconstruction.ts    POST /api/reconstruction (バッチ画像受信)
├── services/              ドメインロジック
│   ├── sessions/            セッション永続化と撮影パイプライン本体
│   │   ├── store.ts           appendFrame で深度→点群→平面検出→SVG を進める
│   │   ├── repository.ts      抽象 (in-memory / Redis 切替インタフェース)
│   │   ├── memory-repository.ts
│   │   └── redis-repository.ts
│   ├── images/              画像受信とバリデーション
│   │   ├── validator.ts       multer の前段で形式・サイズを検査
│   │   └── processor.ts       Sharp で EXIF 補正・リサイズ・JPEG 統一
│   ├── depth/               単眼深度推定
│   │   ├── estimator.ts       ONNX/モックの切替 + フォールバック
│   │   ├── estimator.onnx.ts  Depth Anything V2 small (onnxruntime-node)
│   │   ├── estimator.mock.ts  常に固定深度を返す
│   │   ├── intrinsics.ts      カメラ内部パラメータ (デフォルト横画角 77°)
│   │   ├── pointcloud.ts      深度マップ → カメラ座標 → 世界座標
│   │   └── voxel.ts           voxel ダウンサンプル
│   ├── scale/
│   │   └── calibrator.ts      重力ベクトルから世界座標系を確定、持ち手 150cm 仮定
│   ├── reconstruction/      平面検出と壁線抽出
│   │   ├── ransac.ts          RANSAC 平面検出 (軽量実装)
│   │   ├── floor.ts           床面 (法線が重力方向の最大平面) 抽出
│   │   ├── walls.ts           床に直交する平面 → 2D ポリライン化
│   │   ├── types.ts           Floor / Wall / Plane / Vec3 / Point3D
│   │   └── index.ts           detectFloorAndWalls エクスポート
│   ├── render/              出力フォーマット生成
│   │   ├── svg.ts             上面ビュー SVG
│   │   ├── dxf.ts             DXF (CAD 取り込み用)
│   │   └── index.ts
│   └── tasks/
│       └── store.ts           reconstruction バッチ用のタスクメタ管理 (in-memory)
├── errors/
│   └── reconstruction.ts    InputValidationError / ImageProcessingError
├── types/index.ts         API/サービス層共通型 (SessionState / FrameRecord / DepthMap など)
├── tests/                 vitest テスト (api / depth / processor / reconstruction / render / sessions / validator / calibrator)
├── models/                ONNX モデル置き場 (実体は backend_models ボリューム)
└── _legacy/               旧 issue #6 実装の退避先 (型チェック対象外)
```

## backend/_legacy/

issue #6 の初期実装を退避したディレクトリ。現エントリポイントから参照されず、`tsconfig.json` の `exclude` で型チェックも外している。後続 issue で再構築する際の「資料」として保持。詳細は [backend/_legacy/README.md](../backend/_legacy/README.md) 参照。

`api/`, `services/`, `docker/`, `errors/`, `types/`, `utils/`, `tests/` の旧構造が原型のまま残っているが、リライト推奨と注記されている。

## データの流れと配置

| データ | 場所 | ライフサイクル |
|-------|------|--------------|
| 撮影フレーム JPEG | コンテナ内 `/tmp/madori/<sessionId>/frame-NNNN/` | セッション終了 (`DELETE`) で破棄 |
| ONNX モデル | コンテナ内 `/app/models/` (= `backend_models` ボリューム) | 初回 DL 後は永続化 |
| セッション状態 | Redis (`SESSION_STORE=redis`) または プロセスメモリ | プロセス再起動で in-memory は消える |
| MySQL データ | `mysql_data` ボリューム | 現状未使用 |

## 命名規約

- ファイル/ディレクトリ名は kebab-case または lowercase
- React コンポーネントファイルのみ PascalCase (`CameraView.tsx`)
- バックエンドの service モジュールは「機能ごとのフォルダ + 小さなファイル」を基本にする (例: `services/depth/{estimator,onnx,mock,voxel}.ts`)
- テストは各ロジックと同じディレクトリ階層には置かず、`backend/tests/` / `front/tests/` に集約
