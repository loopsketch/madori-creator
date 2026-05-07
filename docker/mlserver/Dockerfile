# MASt3R-SLAM 推論サーバ用イメージ (issue #30)
#
# 設計方針:
# - conda を使わず pip wheels で固める (ホスト直接インストール時の MKL 衝突を回避)
# - PyTorch は cu124 wheels (CUDA 12.4 ホストでも CUDA 12.8 WSL でも forward compat で動作)
# - WSL2 を主たる開発環境とするため MASt3R-SLAM の windows ブランチを採用
#   (multiprocessing 由来の shared memory 問題を回避)
# - thirdparty / 本体ともに --no-build-isolation で torch を見つけられるようにする
# - checkpoints (~2GB) と datasets はイメージに焼かず named volume にマウント

FROM nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    TZ=Asia/Tokyo \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    # ビルド時に nvcc がターゲットにする CUDA capability 一覧。
    # MASt3R-SLAM 本体の setup.py と揃える (Pascal..Ampere)。
    TORCH_CUDA_ARCH_LIST="6.0;6.1;7.0;7.5;8.0;8.6"

# システム依存
# - python3.11 (MASt3R-SLAM 推奨)
# - build-essential / cmake / git: thirdparty (curope, lietorch 等) のビルド用
# - libgl1 / libglib2.0-0 / libsm6 / libxext6 / libxrender1: OpenCV / moderngl ランタイム
# - libusb-1.0-0: pyrealsense2 のランタイム依存
# - wget / ca-certificates: checkpoints DL 用
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates curl wget git \
        build-essential cmake \
        python3.11 python3.11-dev python3.11-venv \
        python3-pip \
        libgl1 libglib2.0-0 libsm6 libxext6 libxrender1 \
        libusb-1.0-0 \
    && rm -rf /var/lib/apt/lists/*

# python -> python3.11 を既定に
RUN ln -sf /usr/bin/python3.11 /usr/local/bin/python \
    && ln -sf /usr/bin/python3.11 /usr/local/bin/python3

# pip / setuptools (MASt3R-SLAM の build-system が setuptools==70.0.0 を要求)
RUN python -m pip install --upgrade "pip>=24.0" "setuptools==70.0.0" "wheel"

# numpy を先に固定。MASt3R-SLAM が numpy==1.26.4 をピンしているため、
# torch インストール時に numpy 2 系が引かれて後段で衝突するのを防ぐ。
RUN pip install "numpy==1.26.4"

# Cython を先入れ。thirdparty/in3d が依存する pyimgui (2.0.0) は cp311 用の
# wheel が PyPI に無く、sdist からのビルドが必須。pyimgui の cythonize は
# Cython 3.x との非互換が報告されているため 0.29 系で固定する。
# (`--no-build-isolation` で thirdparty が走るので、ここで個別 install しないと
#  pyimgui の build 時に Cython が見えない)
RUN pip install "Cython<3"

# PyTorch (CUDA 12.4 wheels)
RUN pip install \
    --index-url https://download.pytorch.org/whl/cu124 \
    "torch==2.5.1" "torchvision==0.20.1" "torchaudio==2.5.1"

WORKDIR /opt

# MASt3R-SLAM 本体 (windows ブランチ; WSL 推奨)
ARG MAST3R_SLAM_REF=windows
ARG MAST3R_SLAM_REPO=https://github.com/rmurai0610/MASt3R-SLAM.git
RUN git clone --recursive --depth 1 --branch ${MAST3R_SLAM_REF} \
        ${MAST3R_SLAM_REPO} mast3r-slam

WORKDIR /opt/mast3r-slam

# thirdparty を先にインストール (本体 pip install -e . 中の依存解決で順序問題を避ける)。
# --no-build-isolation: setup.py 内で torch を import するため、隔離環境ではなく
#                       既にインストール済みの torch を見せる必要がある。
RUN pip install --no-build-isolation -e thirdparty/mast3r \
    && pip install --no-build-isolation -e thirdparty/in3d

# MASt3R-SLAM の setup.py は build 中に torch.cuda.is_available() で分岐しており、
# Docker build コンテナでは GPU driver に繋がらず False になる結果、ext_modules が
# 未定義のまま setup() に渡されて NameError になる。CUDAExtension のビルド自体は
# nvcc + headers のみで完結するため、ここで has_cuda=True に強制パッチする。
RUN sed -i 's/^has_cuda = torch.cuda.is_available()/has_cuda = True/' setup.py

# 本体 (CUDA 拡張 mast3r_slam_backends を nvcc でビルドする)
RUN pip install --no-build-isolation -e .

# 推論サーバ化 (Phase 2) で使用予定。Phase 1 段階では未利用だが、
# 後段の作業を別レイヤで足せるよう先に入れておく。
RUN pip install \
        "fastapi" \
        "uvicorn[standard]" \
        "python-multipart" \
        "pillow"

# checkpoints / datasets は volume に置く想定。
# ホストから docker compose exec で wget するのを基本フローとする。
RUN mkdir -p /opt/mast3r-slam/checkpoints /opt/mast3r-slam/datasets

# Phase 2 で FastAPI サーバを起動するための既定ポート。
EXPOSE 5001

# Phase 1 (動作確認) では起動したコンテナに `docker compose exec mlserver bash` で入り、
# checkpoints DL → main.py で TUM-RGBD を流す手順を取る。
# Phase 2 で FastAPI 化したらこの CMD を uvicorn 起動に差し替える。
CMD ["sleep", "infinity"]
