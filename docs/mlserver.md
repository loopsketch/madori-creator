---
title: MASt3R-SLAM 推論サーバ (mlserver)
---

# mlserver: MASt3R-SLAM 推論サーバ

issue #30 (MASt3R-SLAM による撮影中 SLAM 統合 PoC) のための補助サービス。

ホストへの直接インストールでは conda の MKL 衝突 (`iJIT_NotifyEvent undefined symbol`) や `--no-build-isolation` の必要性で依存解決が複雑化したため、Docker で固める方針に転換した経緯がある (issue #30 のコメント参照)。

関連: [architecture.md](architecture.md) / [development.md](development.md)

## 構成

```
docker/
└── mlserver/
    └── Dockerfile        nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04 + Python 3.11 + MASt3R-SLAM
```

`docker-compose.yml` の `mlserver` サービスとして起動する。`profiles: [mlserver]` を指定しているため、`docker compose up` を素で叩いても起動しない (ビルドが重いため)。明示的に対象指定する。

## 主要な前提

- ホストに NVIDIA ドライバ + NVIDIA Container Toolkit (backend の CUDA EP と同じ要件)
- WSL2 / Linux で利用想定。WSL の場合は MASt3R-SLAM の `windows` ブランチを使う (multiprocessing 由来の shared memory 問題を回避するため)
- VRAM 6GB 環境で動くかは未検証 (Phase 1 の山場)。動かない場合は入力解像度を落とすか、ViSTA-SLAM への切替を検討する

## ビルド

```bash
docker compose --profile mlserver build mlserver
```

初回は PyTorch / MASt3R / lietorch / curope などのビルドで 10〜30 分程度かかる。

### Dockerfile の設計メモ

- conda は使わず pip wheels のみ (MKL バージョン衝突回避)
- PyTorch は `--index-url https://download.pytorch.org/whl/cu124`
- numpy は MASt3R-SLAM 指定の `1.26.4` を **torch より先に** 固定 (後段の依存解決で 2.x が引かれて壊れるのを防ぐ)
- thirdparty (`mast3r` / `in3d`) と本体は `--no-build-isolation` でインストール (setup.py が torch を import するため)

## 起動と動作確認 (Phase 1: TUM-RGBD)

```bash
# 起動 (バックグラウンド)
docker compose --profile mlserver up -d mlserver

# コンテナに入る
docker compose exec mlserver bash
```

コンテナ内 (`/opt/mast3r-slam`):

```bash
# checkpoints (合計 ~2GB) を DL
cd /opt/mast3r-slam/checkpoints
wget https://download.europe.naverlabs.com/ComputerVision/MASt3R/MASt3R_ViTLarge_BaseDecoder_512_catmlpdpt_metric.pth
wget https://download.europe.naverlabs.com/ComputerVision/MASt3R/MASt3R_ViTLarge_BaseDecoder_512_catmlpdpt_metric_retrieval_trainingfree.pth
wget https://download.europe.naverlabs.com/ComputerVision/MASt3R/MASt3R_ViTLarge_BaseDecoder_512_catmlpdpt_metric_retrieval_codebook.pkl
cd /opt/mast3r-slam

# サンプル dataset (TUM-RGBD)
bash scripts/download_tum.sh

# ヘッドレスで動作確認
python main.py \
    --dataset datasets/tum/rgbd_dataset_freiburg1_room/ \
    --config config/calib.yaml \
    --no-viz
```

別ターミナルで VRAM を監視:

```bash
nvidia-smi -l 2
```

### Phase 1 完了条件

- TUM-RGBD `freiburg1_room` を最後まで処理できる
- VRAM 使用量と FPS を実測し issue #30 にレポート

## ライセンス上の注意

MASt3R checkpoints は学習データセット由来で **non-commercial 相当**。本リポジトリでは PoC 検証目的で利用する。商用化フェーズでは ARKit ネイティブ化または自前訓練済みモデルへの切替が必要 (issue #30 参照)。

checkpoints 自体は Docker イメージに焼き込まず named volume (`mlserver_checkpoints`) に置く運用とすることで、配布物に non-commercial 資産が混入しないようにしている。

## 既知の積み残し / Phase 2 以降

- FastAPI ラップ (Phase 2): `POST /sessions` `POST /sessions/:id/frames` `DELETE /sessions/:id` の実装
- backend からの呼び出し統合 (Phase 3): `backend/services/sessions/store.ts` で MASt3R-SLAM クライアントを呼び、返ってきた点群を既存 RANSAC + wallTracker (#22) に流す
- AlvaAR 関連コード (front/public/poc) の整理 or 隔離
