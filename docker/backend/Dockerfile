FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

# CUDA + cuDNN ランタイム同梱イメージ。onnxruntime-node の CUDA EP 利用に必要。
# CUDA 非対応のホストでも、コンテナ自体はそのまま起動して CPU EP でフォールバックする。

ENV DEBIAN_FRONTEND=noninteractive \
    TZ=Asia/Tokyo \
    NODE_VERSION=20

# Node.js 20 と sharp / onnxruntime のネイティブビルドに必要なツールを導入。
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates curl gnupg \
        python3 make g++ \
    && curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --ignore-scripts

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
