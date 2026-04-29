#!/bin/bash
cd /home/user/works/madori-creator/nginx

# 自己署名SSL証明書を作成
openssl genrsa -out server.key 2048 2>/dev/null
openssl req -x509 -key server.key -out server.crt -days 365 \
  -subj "/CN=localhost" 2>/dev/null

echo "自己署名SSL証明書が生成されました"
