# --- ETAPA 1: O Construtor (Builder) ---
# Usamos uma imagem completa do Node para construir tudo
FROM node:18-slim AS builder

# Define o diretório de trabalho
WORKDIR /usr/src/app

# Copia os package.json do backend e do frontend
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Instala as dependências de ambos
RUN cd backend && npm install
RUN cd frontend && npm install

# Copia todo o resto do código
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Constrói a aplicação React para produção
RUN cd frontend && npm run build

# --- ETAPA 2: A Imagem Final (Production) ---
# Começamos de novo com uma imagem limpa
FROM node:18-slim

WORKDIR /usr/src/app

# Instala apenas as dependências de sistema necessárias para o Puppeteer
RUN apt-get update && apt-get install -yq gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libgbm1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 lsb-release xdg-utils wget --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Copia o package.json do backend e instala APENAS as dependências de produção
COPY backend/package*.json ./
RUN npm install --production

# Copia o código do backend
COPY backend/ .

# Copia APENAS os ficheiros construídos do frontend da etapa 'builder'
COPY --from=builder /usr/src/app/frontend/build ./frontend/build

# Exponha a porta
EXPOSE 10000

# Comando para iniciar a aplicação
# A Azure define a porta através da variável de ambiente PORT
CMD [ "node", "app.js" ]