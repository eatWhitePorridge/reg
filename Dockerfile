# ---- Stage 1: Build frontend ----
FROM node:20-slim AS frontend-build
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ---- Stage 2: Python runtime ----
FROM python:3.12-slim
WORKDIR /app

# 安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端代码
COPY *.py ./
COPY config.json .
COPY zhuce5_cfmail_accounts.json .

# 复制前端构建产物
COPY --from=frontend-build /frontend/dist ./frontend/dist

# 创建数据目录
RUN mkdir -p codex_tokens

EXPOSE 8081

# 启动 API Server（前端 + 后端 + 调度器 一体化）
CMD ["python3", "api_server.py"]
