# Scrapling Actor Dockerfile
FROM apify/actor-python:3.11

# 设置工作目录
WORKDIR /app

# 复制 requirements 并安装
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# 复制主程序
COPY main.py ./main.py

# 设置入口点
CMD ["python", "main.py"]
