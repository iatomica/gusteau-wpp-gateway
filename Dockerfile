# syntax=docker/dockerfile:1
FROM node:20-alpine

WORKDIR /usr/src/app

# 1) Evitar que Puppeteer intente bajar su propio Chromium en postinstall
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true

# 2) Instalar Chromium del sistema (y fuentes/deps que Puppeteer necesita)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# 3) Instalar dependencias de Node sin devDeps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# 4) Copiar el código
COPY . .

# 5) Apuntar Puppeteer al binario del sistema
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# 6) Directorio de media
RUN mkdir -p /usr/src/app/whatsapp-media

EXPOSE 3000
CMD ["node", "index.js"]
