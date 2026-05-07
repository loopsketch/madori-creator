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

### Phase 1 動作確認時に必要だった追加対処

最初の起動で 2 回連続でクラッシュしたため対処を入れた経緯を残しておく。

1. **`/dev/shm` を 4GB に拡大**
   - 症状: dataloader 初期化付近で `Bus error (core dumped)` (EXIT=135)、約 1 分 43 秒で死亡
   - 原因: Docker デフォルトの `/dev/shm` (64MB) が PyTorch multiprocessing の shared memory IPC に不足。`config/calib.yaml` は `single_thread: false` なので並列で大きな共有メモリを要求する
   - 対処: `docker-compose.yml` の `mlserver` サービスに `shm_size: '4gb'` を追加

2. **`libusb-1.0-0` を apt で追加**
   - 症状: `import pyrealsense2` で `libusb-1.0.so.0: cannot open shared object file` (EXIT=1)、3 秒で死亡
   - 原因: MASt3R-SLAM の `mast3r_slam/dataloader.py` がトップレベルで `pyrealsense2` を import しており、データセットが TUM でも実 RealSense 機器が無くても dlopen が走る。`pyrealsense2` の wheel は libusb-1.0 に動的依存
   - 対処: Dockerfile の apt-get install 行に `libusb-1.0-0` を追加

### Phase 1 計測結果 (2026-05-07)

開発機: WSL2 + RTX 3050 Laptop 6GB + CUDA 12.8 host。

- **動くは動く** が、VRAM が上限ギリギリで実用速度に到達せず
  - peak VRAM: **5976 MiB / 6144 MiB (97%)**
  - FPS: **0.024** (ログの `FPS: 0.0239...` 行、約 42 秒/frame)
  - `freiburg1_room` (1362 frames, `subsample: 2` で 681 frames) の完走見込み: 約 8 時間 → 完走前に中断
- 仮説: VRAM 上限張り付きで CUDA cache thrashing が発生しているか、論文値 (RTX 4090 で 〜15 fps) との計算性能差がそのまま出ている
- 結論: **6GB クラス GPU では PoC 用途であっても実用不可**。Phase 2 (FastAPI ラップ) に進む前に、以下のどれを採るか #30 で要判断
  - (a) ViSTA-SLAM など軽量代替への切替
  - (b) `dataset.subsample` / `dataset.img_downsample` を上げて軽量化した上で再計測
  - (c) ターゲット GPU を 8GB+ クラスに引き上げる前提に変更

## ライセンス上の注意

MASt3R checkpoints は学習データセット由来で **non-commercial 相当**。本リポジトリでは PoC 検証目的で利用する。商用化フェーズでは ARKit ネイティブ化または自前訓練済みモデルへの切替が必要 (issue #30 参照)。

checkpoints 自体は Docker イメージに焼き込まず named volume (`mlserver_checkpoints`) に置く運用とすることで、配布物に non-commercial 資産が混入しないようにしている。

## 既知の積み残し / Phase 2 以降

- FastAPI ラップ (Phase 2): `POST /sessions` `POST /sessions/:id/frames` `DELETE /sessions/:id` の実装
- backend からの呼び出し統合 (Phase 3): `backend/services/sessions/store.ts` で MASt3R-SLAM クライアントを呼び、返ってきた点群を既存 RANSAC + wallTracker (#22) に流す
- AlvaAR 関連コード (front/public/poc) の整理 or 隔離
