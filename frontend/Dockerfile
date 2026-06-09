# Stage 1: Build
FROM node:22-alpine AS build

WORKDIR /app

# Copiar manifiestos de dependencias primero (cache de capas Docker)
COPY package.json package-lock.json* pnpm-lock.yaml* ./

# Instalar todas las dependencias (incluyendo devDependencies para build)
RUN npm ci 2>/dev/null || npm install

# Copiar codigo fuente
COPY . .

# Build de produccion (tsc + vite build)
RUN npm run build

# Stage 2: Servir con nginx
FROM nginx:alpine

# Eliminar config por defecto de nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copiar config personalizada
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar archivos de build desde stage 1
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
