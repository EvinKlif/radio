FROM node:18-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Этап копирования результатов
FROM alpine:latest
RUN mkdir -p /output
COPY --from=builder /app/dist /output
CMD ["sh", "-c", "cp -a /output/. /build-output/"]