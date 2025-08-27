# Passo 1: Use uma imagem base do Node.js baseada em Debian (como a 'slim')
FROM node:18-slim

# Passo 2: Crie e defina o diretório de trabalho dentro do container
WORKDIR /usr/src/app

# Passo 3: Instale as dependências de sistema necessárias para o Chromium (Puppeteer)
RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-liberation \
    gconf-service \
    libappindicator1 \
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
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
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
    lsb-release \
    wget \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Passo 4: Copie os arquivos de definição de pacotes
COPY package*.json ./

# Passo 5: Instale as dependências do Node.js
RUN npm install --production

# Passo 6: Copie o resto do código da sua aplicação para o diretório de trabalho
COPY . .

# Passo 7: Exponha a porta em que a sua aplicação corre
EXPOSE 3001

# Passo 8: Defina o comando para iniciar a aplicação
CMD [ "node", "app.js" ]