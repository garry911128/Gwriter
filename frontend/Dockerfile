# 使用 Node.js 18 作為基礎映像
FROM node:18-alpine AS builder

# 設定工作目錄
WORKDIR /app

# 複製 package.json 和 package-lock.json（若有）
COPY package.json package-lock.json* ./

# 安裝依賴（使用 `ci` 確保乾淨環境）
RUN npm ci

# 複製專案代碼
COPY . .

# 執行 Vite 打包
RUN npm run build

# 使用 Nginx 作為靜態伺服器
FROM nginx:1.25-alpine AS server

# 設定工作目錄
WORKDIR /usr/share/nginx/html

# 清除預設的 Nginx 靜態檔案
RUN rm -rf ./*

# 複製前端打包後的檔案到 Nginx 伺服器
COPY --from=builder /app/dist . 

# 複製 Nginx 設定檔
# COPY nginx.conf /etc/nginx/nginx.conf
COPY default.conf /etc/nginx/conf.d/default.conf

# 開放 80 端口
EXPOSE 80

# 啟動 Nginx
CMD ["nginx", "-g", "daemon off;"]
