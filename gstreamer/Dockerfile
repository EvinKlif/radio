#FROM ubuntu:22.04
#
## Установка зависимостей
#RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y \
#    gstreamer1.0-tools \
#    gstreamer1.0-plugins-base \
#    gstreamer1.0-plugins-good \
#    gstreamer1.0-plugins-bad \
#    gstreamer1.0-plugins-ugly \
#    gstreamer1.0-libav \
#    gstreamer1.0-alsa \
#    gstreamer1.0-pulseaudio \
#    libgstreamer-plugins-base1.0-dev \
#    libmpg123-dev \
#    python3 \
#    python3-gi \
#    python3-pip \
#    gir1.2-gst-plugins-base-1.0 \
#    gir1.2-gstreamer-1.0 \
#    curl \
#    netcat-openbsd \
#    ca-certificates \
#    && rm -rf /var/lib/apt/lists/*
#
## Создаем рабочую директорию
#WORKDIR /app
#
## Копируем Python-скрипт
#COPY play_all_media.py /app/
#
## Копируем медиафайлы
#COPY media /media
#
## Создаем пользователя
#RUN useradd -m -s /bin/bash gstreamer
#
## Устанавливаем переменные окружения для GStreamer
#ENV GST_PLUGIN_PATH=/usr/lib/x86_64-linux-gnu/gstreamer-1.0
#ENV GST_DEBUG=3
#ENV PULSE_RUNTIME_PATH=/tmp/pulse
#
## Даем права на папку media
#RUN chown -R gstreamer:gstreamer /media /app
#
#USER gstreamer
#
#EXPOSE 40000/udp
#
## Команда запуска
#CMD ["python3", "play_all_media.py"]

FROM ubuntu:22.04

# Установка зависимостей
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y \
    gstreamer1.0-tools \
    gstreamer1.0-plugins-base \
    gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-bad \
    gstreamer1.0-plugins-ugly \
    gstreamer1.0-libav \
    gstreamer1.0-alsa \
    gstreamer1.0-pulseaudio \
    libgstreamer-plugins-base1.0-dev \
    libmpg123-dev \
    python3 \
    python3-gi \
    python3-pip \
    gir1.2-gst-plugins-base-1.0 \
    gir1.2-gstreamer-1.0 \
    curl \
    netcat-openbsd \
    ca-certificates \
    libmfx1 \
    intel-media-va-driver-non-free \
    libva-drm2 \
    libva-x11-2 \
    vainfo \
    && rm -rf /var/lib/apt/lists/*

# Установка Python-зависимостей
RUN pip3 install minio python-dotenv boto3 redis

WORKDIR /app
COPY play_all_media.py /app/

RUN useradd -m -s /bin/bash gstreamer
ENV GST_PLUGIN_PATH=/usr/lib/x86_64-linux-gnu/gstreamer-1.0
ENV GST_DEBUG=2
ENV PULSE_RUNTIME_PATH=/tmp/pulse

# Переменные MinIO со значениями по умолчанию
ENV MINIO_ENDPOINT=host.docker.internal:9000
ENV MINIO_ACCESS_KEY=admin
ENV MINIO_SECRET_KEY=qwertasdfg
ENV MINIO_BUCKET=media
ENV MINIO_SECURE=False

RUN chown -R gstreamer:gstreamer /app
USER gstreamer
EXPOSE 40000/udp

CMD ["python3", "play_all_media.py"]