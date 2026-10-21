FROM node:24-bookworm-slim

ENV NODE_ENV=production \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PACKPROOF_PYTHON=/opt/packproof-venv/bin/python

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv build-essential libgomp1 ffmpeg tesseract-ocr tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./requirements.txt
RUN python3 -m venv /opt/packproof-venv \
    && /opt/packproof-venv/bin/pip install --no-cache-dir -r requirements.txt

COPY package.json ./package.json
RUN npm install --omit=dev

COPY . .
EXPOSE 10000
CMD ["node", "server.mjs"]
