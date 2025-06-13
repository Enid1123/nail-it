# 使用 Node.js 作為基礎映像
FROM node:18-alpine

# 設定工作目錄
WORKDIR /app

# 複製package.json和package-lock.json（如果存在）
COPY nail-resv/package*.json ./

# 安裝依賴
RUN npm install

# install Python for image search utilities
RUN apk add --no-cache python3 py3-pip
COPY python/requirements.txt ./python/requirements.txt
RUN pip3 install --break-system-packages --no-cache-dir -r python/requirements.txt


# 複製專案文件
COPY nail-resv/ ./
COPY python/ ./python/
COPY models/ ./models/

# 設置環境變數
ENV PORT=4000

# 確保不會創建 VOLUME（Railway 不允許使用 VOLUME）
RUN mkdir -p /app/uploads && chmod -R 777 /app/uploads

# 暴露 4000 端口
EXPOSE 4000

# 啟動命令
CMD ["node", "server.js"]

