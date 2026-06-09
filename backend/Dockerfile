FROM node:22-alpine

WORKDIR /app

# Copiar manifiestos de dependencias primero (cache de capas Docker)
COPY package.json package-lock.json* pnpm-lock.yaml* ./

# Instalar solo dependencias de produccion
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

# Copiar codigo fuente
COPY . .

# Crear directorio para uploads temporales
RUN mkdir -p uploads

EXPOSE 3001

CMD ["node", "index.js"]
