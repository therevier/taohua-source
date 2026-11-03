# 桃花源码 · Docker 部署
FROM node:24-slim

WORKDIR /app
ENV NODE_ENV=production

# Python 运行时（可选：让 Python 任务也能在沙箱里运行）
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# 只拷贝依赖清单，利用 Docker 层缓存
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

# 拷贝源码并构建前端产物
COPY . .
RUN npm run build

# 数据目录（会话 + 计划缓存），生产环境请挂载卷持久化
VOLUME ["/app/data"]

EXPOSE 8787
CMD ["npm", "start"]
