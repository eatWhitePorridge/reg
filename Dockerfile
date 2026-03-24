FROM python:3.12-slim

WORKDIR /app

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制项目文件
COPY . .

# 默认运行调度器（全自动模式）
CMD ["python3", "auto_scheduler.py"]
