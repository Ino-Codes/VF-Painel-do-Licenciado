# Usa uma imagem oficial do Node.js
FROM node:20-alpine

# Define o diretório de trabalho dentro do container
WORKDIR /usr/src/app

# Copia os arquivos de dependência
COPY package*.json ./

# Use uma imagem base do Node.js
FROM node:18-slim

# Crie o diretório da aplicação
WORKDIR /usr/src/app

# Copie os arquivos de dependências
COPY package*.json ./

# Instala o wget e descompacta, depois instala as dependências necessárias para o Chromium
RUN apt-get update && apt-get install -yq \
    gconf-service \
    libasound2 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgcc1 \
    libgconf-2-4 \
    libgdk-pixbuf2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    ca-certificates \
    fonts-liberation \
    libappindicator1 \
    libnss3 \
    lsb-release \
    xdg-utils \
    wget \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*
# ---> FIM DAS LINHAS ADICIONADAS <---

# Instale as dependências da aplicação
RUN npm install --production

# Copie o resto do código da sua aplicação
COPY . .

# Exponha a porta
EXPOSE 3001

# Comando para iniciar a aplicação
CMD [ "node", "app.js" ]