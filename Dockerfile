FROM node:18-alpine

WORKDIR /app

# Copiar archivos de dependencias primero (para cache de Docker)
COPY package*.json ./

# Instalar dependencias de producción
RUN npm ci --production

# Copiar el resto de la app
COPY . .

# Exponer puerto
EXPOSE 3000

# Arrancar el servidor
CMD ["node", "server.js"]
