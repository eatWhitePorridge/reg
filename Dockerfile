FROM python:3.12-slim
WORKDIR /app

# 安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端代码
COPY *.py ./
COPY config.json .
COPY zhuce5_cfmail_accounts.json .

# 复制前端（纯 HTML 单文件）
COPY frontend/index.html ./frontend/

# 创建数据目录
RUN mkdir -p codex_tokens

EXPOSE 8081

# 启动 API Server（前端 + 后端 + 调度器 一体化）
CMD ["python3", "api_server.py"]
