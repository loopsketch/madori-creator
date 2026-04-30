---
title: 開発環境ガイド
---

# 開発環境ガイド

本プロジェクトは Docker Compose で完結する開発環境を提供する。フロント/バックエンド/プロキシ/DB/Redis を一括で起動し、ホスト側からは HTTPS の単一ポート (8443) で動作確認できる。

関連ドキュメント:
- アーキテクチャ詳細: [architecture.md](architecture.md)
- フォルダ構成: [structure.md](structure.md)

## 前提

- Docker Engine / Docker Compose v2 (`docker compose` サブコマンド形式)
- Node.js は不要 (コンテナ内で実行)。ホストでテストや型チェックだけ行いたい場合は Node.js 20.x を使う
- Linux / macOS / Windows + WSL2 で動作確認 (本リポジトリは WSL2 上で開発)
- iPhone 実機テストには PC と iPhone を同一 LAN に置き、PC のローカル IP を控える

### 開発機の参考スペック

- メモリ 6GB (frontend / backend / nginx / redis / db を全部走らせると逼迫気味)
- **CUDA 利用可能**。NVIDIA Container Toolkit が入っていれば `docker run --gpus all` / Compose の `deploy.resources.reservations.devices` で GPU をコンテナへ渡せる
- backend イメージは `nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04` ベース。`docker-compose.yml` の `backend.deploy.resources.reservations.devices` で GPU を全て予約済み
- `ONNX_EXECUTION_PROVIDER=auto` (デフォルト) は CUDA → CPU の順に試行する。CUDA が使えない環境でも CPU EP で起動できる

### GPU 推論の動作確認

```bash
# ホスト側で NVIDIA Container Toolkit が動いているか
docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi

# backend コンテナ内で GPU が見えるか
docker compose exec backend nvidia-smi

# 起動ログで EP=cuda が選ばれているか
docker compose logs backend | grep -E "depth|EP="
```

CUDA を使いたくない環境では `ONNX_EXECUTION_PROVIDER=cpu` にして再起動する。

## サービス構成

`docker-compose.yml` で以下 5 サービスを起動する。

| サービス | コンテナ名 | ホスト公開ポート | 役割 |
|---------|-----------|----------------|------|
| `nginx` | `madori-nginx` | `8443` (HTTPS) | TLS 終端 + フロント/API のリバースプロキシ |
| `frontend` | `madori-frontend` | `3000` | Vite dev server (React + PWA) |
| `backend` | `madori-backend` | `3001` | Express API + ONNX 深度推定 |
| `db` | `madori-db` | `3306` | MySQL 8 (将来用、現在未使用) |
| `redis` | `madori-redis` | `6379` | セッションストア (`SESSION_STORE=redis`) |

ボリューム:

| ボリューム | 用途 |
|-----------|------|
| `frontend_node_modules` | フロントの `node_modules` をコンテナ内で永続化 |
| `backend_node_modules` | バックエンドの `node_modules` を永続化 |
| `backend_models` | ONNX モデル (`Depth Anything V2 small`) を永続化 (初回起動時にダウンロード) |
| `mysql_data` | MySQL のデータディレクトリ |

## 主要環境変数

`backend` サービスで利用する環境変数 (`docker-compose.yml` で定義済み):

| 変数 | デフォルト | 意味 |
|------|-----------|------|
| `PORT` | `3000` | バックエンドの listen ポート (コンテナ内) |
| `DATABASE_URL` | `mysql://root:password@db:3306/madori` | MySQL 接続先 (現状未使用) |
| `REDIS_URL` | `redis://redis:6379` | Redis 接続先 |
| `SESSION_STORE` | `redis` | `redis` で永続化、それ以外で in-memory にフォールバック |
| `DEPTH_ESTIMATOR` | `onnx` | `onnx` で Depth Anything V2 small、`mock` で固定深度モック |
| `ONNX_EXECUTION_PROVIDER` | `auto` | `auto` (CUDA→CPU フォールバック) / `cuda` / `cpu` |

## 起動と停止

```bash
# 起動 (バックグラウンド)
docker compose up -d

# ログ確認
docker compose logs -f backend
docker compose logs -f frontend

# 停止
docker compose down

# ボリュームごと破棄 (モデル/DB/Redis のキャッシュもクリア)
docker compose down -v
```

ブラウザで `https://localhost:8443/` (LAN テスト時は `https://<host-ip>:8443/`) を開く。自己署名証明書のため、初回は警告ページから訪問を許可する必要がある。

## 自己署名 SSL 証明書

`docker/nginx/certs/server.crt` と `server.key` をマウントして利用する。リポジトリには既に同梱済み (CN=localhost, 365 日)。再生成したい場合は `docker/nginx/generate-certs.sh` を参考に再作成する。

注意: スクリプト先頭の `cd /home/user/works/madori-creator/nginx` はパスが固定されているため、自身の環境に合わせて修正してから実行する。

## nginx ルーティング

`docker/nginx/nginx.conf` で以下のように振り分けている。

| パス | プロキシ先 | 備考 |
|------|-----------|------|
| `/api/` | `backend:3000` | prefix を維持して `/api/...` を転送 |
| `/__vite_ws` | `frontend:3000` | Vite HMR の WebSocket (Upgrade) |
| `/` | `frontend:3000` | Vite dev server |

`client_max_body_size 20M` でフレーム画像のアップロードを許容。タイムアウトは 120 秒。

## フロント (Vite) 設定

[front/vite.config.ts](../front/vite.config.ts):

- `host: 0.0.0.0`, `port: 3000`
- HMR は `wss://<host>:8443/__vite_ws` で接続 (nginx 経由)
- `proxy: '/api' → http://backend:3000` (Docker ネットワーク内)
- `vite-plugin-pwa` で PWA マニフェスト/SW を生成。dev 時は `devOptions.enabled: false` (キャッシュ起因の真っ白画面回避)

## バックエンド初期化フロー

[backend/index.ts](../backend/index.ts):

1. `express` を生成、`/health` と `/api` ルータを登録
2. `initSessionStore()` で `SESSION_STORE=redis` のとき `REDIS_URL` に接続。失敗時は in-memory にフォールバック
3. `0.0.0.0:${PORT}` で listen

ONNX 深度推定は初回フレーム到着時にモデルを `/app/models` (`backend_models` ボリューム) にダウンロードする。失敗時はプロセス全体ではなくモック (`estimator.mock.ts`) にフォールバックして撮影パイプラインを継続する。

## ホストでのテスト/型チェック

コンテナを介さず、ホストの Node.js 20.x で実行可能。

```bash
# バックエンド
cd backend
npm install
npm run type-check    # tsc --noEmit
npm run test          # vitest run

# フロント
cd front
npm install
npm run type-check
npm run test
npm run lint
```

`backend/_legacy/` は `tsconfig.json` の `exclude` に入っており型チェック対象外 (詳細は [structure.md](structure.md) 参照)。

## トラブルシュート

| 症状 | 対処 |
|------|------|
| iPhone でカメラ/モーション許可ダイアログが出ない | HTTP でアクセスしている可能性。`https://` で開く。Safari は許可状態を `設定 > Safari > Web サイト` で確認 |
| HMR が効かない/真っ白 | dev 時の Service Worker が古い asset を返している。ブラウザの `Application > Service Workers` で Unregister |
| `onnxruntime-node` が起動しない | Alpine (musl) は不可。backend は `nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04` (glibc) を使用 |
| GPU を渡したのに CPU で動く | コンテナ内 `nvidia-smi` が動かない場合はホストの NVIDIA Container Toolkit を確認。動くのに CPU が選ばれる場合は cuDNN バージョン不整合の可能性 (`docker compose logs backend` で `EP=cuda のセッション作成に失敗` を確認) |
| Redis 接続失敗ログ | コンテナ起動順や Redis 障害時。in-memory にフォールバックして動作継続するためログのみ。永続化が必要なら復旧後に `docker compose restart backend` |
| 画像アップロードで 413 | nginx の `client_max_body_size` が 20MB。JPEG が極端に大きい場合は前処理側でリサイズしてから送信する |

## 実機テスト手順

1. PC で `docker compose up -d`
2. 同一 LAN の iPhone Safari で `https://<PC の LAN IP>:8443/` を開く
3. 自己署名証明書の警告から訪問を許可
4. 中央下の白い丸ボタン (開始) をタップ
5. DeviceMotion / カメラ許可ダイアログを「許可」
6. ステータスが「撮影中」になったら、ゆっくり部屋を歩きながらかざす
7. 部屋を一周したらもう一度ボタンをタップして停止

詳細な期待挙動と既知の制約は [README.md](../README.md) を参照。
