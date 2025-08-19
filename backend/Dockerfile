# Usa uma imagem oficial do Node.js
FROM node:20-alpine

# Define o diretório de trabalho dentro do container
WORKDIR /usr/src/app

# Copia os arquivos de dependência
COPY package*.json ./

# Instala as dependências do projeto
RUN npm install

# Copia o restante do código da sua aplicação
COPY . .

# Expõe a porta em que sua aplicação roda
EXPOSE 3001

# Comando para iniciar sua aplicação
CMD [ "node", "app.js" ]