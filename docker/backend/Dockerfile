FROM node:20-slim

# onnxruntime-node や sharp など glibc 前提のネイティブモジュールが動くよう
# Debian 系の slim イメージを使う。Alpine (musl libc) では onnxruntime-node が
# ld-linux-x86-64.so.2 を要求して起動失敗するため。

WORKDIR /app

COPY package*.json ./
RUN npm install --ignore-scripts

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
