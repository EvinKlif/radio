FROM node:20-slim

# Устанавливаем системные зависимости для MediaSoup
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    python3-pip \
    pkg-config \
    curl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Копируем package.json и устанавливаем зависимости
COPY package*.json ./
RUN npm install --omit=dev

# Копируем остальной код
COPY . .

# Создаем директорию для логов
RUN mkdir -p /app/logs

# Создаем non-root пользователя
RUN useradd -m -s /bin/bash mediasoup && \
    chown -R mediasoup:mediasoup /app
USER mediasoup

EXPOSE 3000
EXPOSE 40000-40100/udp

# Health check

CMD ["node", "server.js"]

