# 本地開發專用 Dockerfile
FROM node:18-alpine

# 設定工作目錄
WORKDIR /app

# 複製 package.json 檔案
COPY package*.json ./

# 安裝依賴
RUN npm install

# 複製專案檔案
COPY . .

# 設置環境變數
ENV VITE_BACKEND_API_URL=/api

# 暴露 5173 端口 (Vite 預設開發端口)
EXPOSE 5173

# 啟動開發伺服器
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
