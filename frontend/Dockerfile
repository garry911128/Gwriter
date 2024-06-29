
FROM node:14

# 設定工作目錄
WORKDIR /app

# 複製 package.json 和 package-lock.json (如果存在)
COPY package*.json ./

# 安裝依賴
RUN npm install

# 複製前端項目中的所有文件到工作目錄
COPY . .

# 暴露 3000 端口
EXPOSE 3000

# 啟動 React 應用
CMD ["npm", "start"]
