#!/bin/sh
# docker-entrypoint.sh
# 用於啟動 Nginx 前，將環境變數注入 nginx.conf

# 將 BACKEND_API_URL 預設為 /api（如未設置）
BACKEND_API_URL=${BACKEND_API_URL:-/api}

# 用 envsubst 將模板中的 ${BACKEND_API_URL} 替換為實際值
envsubst '${BACKEND_API_URL}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

# 啟動 Nginx
exec "$@"
