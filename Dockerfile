# Etapa de construcción
FROM node:22-alpine AS builder

WORKDIR /app

# Instalar dependencias del sistema necesarias para la construcción
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    openssl \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copiar archivos de configuración
COPY package*.json ./
COPY prisma ./prisma/
COPY tsconfig*.json ./

# Instalar dependencias
RUN npm ci --include=optional

# Copiar código fuente y construir
COPY src/ ./src/
RUN npm run build

# Generar cliente de Prisma
RUN npx prisma generate

# Limpiar cache de npm para reducir tamaño
RUN npm cache clean --force && rm -rf /tmp/*

# Etapa de dependencias de producción
FROM node:22-alpine AS deps

WORKDIR /app

# Instalar solo las dependencias mínimas necesarias para npm
RUN apk add --no-cache \
    openssl

# Copiar archivos de configuración
COPY package*.json ./
COPY prisma ./prisma/

# Instalar solo dependencias de producción
RUN npm ci --only=production --include=optional && \
    npm cache clean --force && rm -rf /tmp/*

# Generar cliente de Prisma para producción
RUN npx prisma generate

# Etapa de producción final
FROM node:22-alpine AS production

# Crear usuario no-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Instalar solo las dependencias de runtime necesarias
RUN apk add --no-cache \
    openssl \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    tzdata \
    postgresql-client && \
    rm -rf /var/cache/apk/*

# Configurar zona horaria
ENV TZ=America/El_Salvador
RUN ln -sf /usr/share/zoneinfo/America/El_Salvador /etc/localtime && \
    echo "America/El_Salvador" > /etc/timezone

# Variables de entorno
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production

# Copiar solo los archivos necesarios desde las etapas anteriores
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma

# Copiar archivos estáticos necesarios
COPY templates ./templates
COPY firebase-service-account.json /app/firebase-service-account.json
# COPY assets ./assets

# Cambiar permisos y usuario
RUN chown -R appuser:appgroup /app
USER appuser

# Exponer puerto
EXPOSE 3000

# Comando de inicio
CMD ["npm", "run", "start:prod"]