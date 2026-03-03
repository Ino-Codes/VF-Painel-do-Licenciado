# Painel da Valor Corp 🏢

O **Painel da Valor Corp** é uma plataforma corporativa (intranet e LMS) desenvolvida para centralizar a comunicação, gestão de conhecimento e rotinas de Recursos Humanos para as empresas do grupo (Valor Fiscal, Valor Banking e Valor Business).

## 🎯 Objetivo

Prover um ambiente unificado e seguro onde colaboradores e licenciados possam acessar documentos oficiais, assistir a treinamentos, realizar testes de conhecimento, gerar certificados, acompanhar avisos corporativos e realizar solicitações de RH (recrutamento, feedbacks, etc.), com controle de acesso dinâmico baseado em níveis de permissão e multi-tenancy (separação por empresa).

## ✨ Principais Funcionalidades

### 👥 Gestão de Usuários e Acessos

- **Perfis de Acesso:** Controle estrito para Administradores, RH, Comercial, Operacional e Licenciados.
- **Multi-Empresa:** Visualização dinâmica de conteúdos dependendo da empresa acessada (Valor Fiscal, Banking, Business).
- **Gestão de Perfil:** Atualização de dados, apelido (nickname), troca de senha e upload de foto de perfil/avatar.

### 📚 Plataforma de Ensino (LMS)

- **Trilhas de Conhecimento:** Cursos modulares com aulas em vídeo e texto.
- **Avaliações (Quiz):** Testes de conhecimento com nota de corte.
- **Certificados:** Geração automática de certificados em PDF após a conclusão e aprovação.

### 📂 Gestão de Conteúdo e Comunicação

- **Documentos e Vídeos:** Repositório centralizado com controle de visibilidade (Todos, Licenciados, Internos).
- **Mural de Avisos:** Mural dinâmico na tela inicial para comunicados com suporte a formatação e emojis.
- **FAQ:** Base de conhecimento com perguntas e respostas frequentes.

### 🤝 Recursos Humanos (RH) e Gestão

- **Feedbacks 360:** Módulo para criação, agendamento e resposta de convites de feedback.
- **Recrutamento:** Gestão de candidatos e calendário de entrevistas.
- **Eneagrama:** Teste de perfil comportamental com gráficos de estatísticas da equipe.
- **Calendário Corporativo:** Visualização de eventos da empresa e aniversariantes do mês.

### 🎨 Interface (UI/UX)

- **Modo Claro/Escuro:** Suporte nativo a temas (Light/Dark mode) com persistência de preferência.
- **Design Responsivo:** Layout adaptável para desktop e mobile.

---

## 🛠️ Tecnologias Utilizadas

**Frontend:**

- React (TypeScript)
- React Router Dom (Navegação)
- Chart.js (Gráficos)
- React-Hot-Toast (Notificações)
- Tiptap (Editor de texto rico)

**Backend:**

- Node.js com Express
- PostgreSQL (Banco de dados relacional)
- Cloudinary (Armazenamento de imagens e documentos)
- JWT (JSON Web Tokens para Autenticação)
- Bcrypt.js (Criptografia de senhas)

---

## 🚀 Como Rodar o Projeto Localmente

### Pré-requisitos

- **Node.js** (v16 ou superior)
- **PostgreSQL** (Rodando localmente ou via Docker)
- Conta no **Cloudinary** (para upload de arquivos)

### 1. Clonar o repositório

`git clone [https://github.com/seu-usuario/painel-valor-corp.git](https://github.com/seu-usuario/painel-valor-corp.git)`<br/>
`cd painel-valor-corp`

### 2. Configurar o Banco de Dados

1. Crie um banco de dados no PostgreSQL (ex: `valor_corp_db`).
2. Execute os scripts SQL localizados na pasta `backend/sql/` (ou equivalente) para criar as tabelas necessárias.

### 3. Configurar e Rodar o Backend

1. Acesse a pasta do backend `cd backend`

2. Instale as dependências `npm install`

3. Crie um arquivo .env na raiz do backend baseado no exemplo:
   `PORT=3001`<br/>
   `DB_USER=seu_usuario_pg`<br/>
   `DB_HOST=localhost`<br/>
   `DB_NAME=valor_corp_db`<br/>
   `DB_PASSWORD=sua_senha_pg`<br/>
   `DB_PORT=5432`<br/>
   `JWT_SECRET=sua_chave_secreta_jwt`<br/>
   `CLOUDINARY_CLOUD_NAME=seu_cloud_name`<br/>
   `CLOUDINARY_API_KEY=sua_api_key`<br/>
   `CLOUDINARY_API_SECRET=sua_api_secret`

4. Inicie o servidor:

- Para desenvolvimento (reinicia automaticamente ao salvar) `npm run dev`
- Ou para produção `npm start`

### 4. Configurar e Rodar o Frontend

1. Em outro terminal, abra a pasta do frontend `cd frontend`

2. Instale as dependências `npm install`

3. Crie um arquivo .env na raiz do frontend baseado no exemplo:
   `REACT_APP_API_URL=http://localhost:3001`

4. Inicie a aplicação `npm start`

- A aplicação frontend estará disponível em `http://localhost:3000`.
