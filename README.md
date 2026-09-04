# Painel da V-CORP 🏢

O **Painel da V-CORP** é uma plataforma corporativa (intranet + LMS) que centraliza comunicação, gestão de conhecimento, rotinas de RH e atendimento de chamados para as empresas do grupo (V-TAX, V-BANKING, V-BUSINESS, V-CORP e V-TECH).

## 🎯 Objetivo

Prover um ambiente unificado e seguro onde colaboradores e licenciados possam acessar documentos oficiais, assistir a treinamentos, realizar avaliações, gerar certificados, acompanhar avisos corporativos, abrir e acompanhar chamados de suporte e executar rotinas de RH — tudo com controle de acesso por papel (role) e separação por empresa (multi-tenancy).

## ✨ Principais Funcionalidades

### 👥 Usuários e Acessos

- **Papéis:** controle de permissão para **Administrador**, **RH** e **Licenciado**.
- **Multi-empresa:** conteúdos exibidos conforme a empresa acessada.
- **Perfil:** atualização de dados, apelido (_nickname_), troca de senha e foto/avatar.

### 📚 Plataforma de Ensino (LMS)

- **Trilhas de conhecimento:** cursos modulares com aulas em vídeo e texto.
- **Avaliações (Quiz):** testes com nota de corte.
- **Certificados:** geração automática em PDF após conclusão e aprovação.

### 📂 Conteúdo e Comunicação

- **Documentos, Vídeos e Arquivos:** repositório central com controle de visibilidade (Todos / Licenciados / Internos).
- **Mural de Avisos:** comunicados na tela inicial, com formatação e emojis.
- **FAQ:** base de perguntas e respostas frequentes.
- **Atas de Reuniões:** registro e consulta de atas, com anexos.

### 🎫 Central de Chamados (Suporte / ITSM)

- **Widget de abertura de chamados:** botão flutuante embutível em qualquer site de terceiro via _snippet_ `<script>` (ver [Widget de chamados](#-widget-de-chamados-embed)).
- **Quadro de atendimento (Kanban):** fluxo _Novo → Em Andamento → Concluído / Pausado_, com atribuição de atendente, observações internas e instruções de resolução.
- **E-mails automáticos:** confirmação de abertura e de conclusão para o solicitante, com link direto de acompanhamento.
- **Acompanhamento público (`/acompanhar`):** o solicitante externo consulta o status por _magic link_ ou por protocolo + e-mail — sem login.
- **Meus Chamados:** consulta interna de chamados (protocolo + e-mail).
- **Sistemas Integrados:** cadastro de tokens por sistema de terceiro, com _snippet_ pronto e instruções de integração.
- **Histórico de movimentação:** cada transição de status é registrada em `ticket_status_history`, base para indicadores de atendimento (tempo médio, tempo até 1º atendimento, volume por etapa).

### 🤝 RH e Gestão

- **Feedbacks 360:** criação, agendamento e resposta de convites.
- **Recrutamento:** gestão de candidatos e calendário de entrevistas.
- **Eneagrama:** teste comportamental com estatísticas da equipe.
- **Projetos:** acompanhamento de projetos e tarefas.
- **Calendário Corporativo:** eventos e aniversariantes do mês.

### 🎨 Interface (UI/UX)

- **Modo Claro/Escuro** com persistência de preferência.
- **Design responsivo** para desktop e mobile.

---

## 🛠️ Tecnologias

**Frontend**

- React 19 + TypeScript (Create React App / `react-scripts`)
- React Router DOM (navegação)
- Axios (consumo da API)
- Chart.js + react-chartjs-2 (gráficos)
- FullCalendar e React Big Calendar (calendários)
- Tiptap (editor de texto rico)
- react-icons, react-select, react-datepicker, emoji-picker-react, lottie-react
- dnd-kit e react-dnd (drag-and-drop)

**Backend**

- Node.js + Express
- PostgreSQL (`pg`) — **migrations aplicadas automaticamente no boot**
- JWT (`jsonwebtoken`) + Bcrypt.js (autenticação e senhas)
- Cloudinary (upload de imagens/arquivos)
- Resend (envio de e-mails transacionais)
- node-cron (rotinas agendadas)
- Multer (upload multipart)
- Puppeteer-core + @sparticuz/chromium (geração de PDF de certificados)

**Infra**

- Backend hospedado no **Render** (com `Dockerfile`)
- Frontend servido como _build_ estático

---

## 📁 Estrutura do Repositório

```
VF-Painel-do-Licenciado/
├── backend/
│   ├── app.js               # Entrada do Express, CORS por rota, wiring das rotas
│   ├── migrationRunner.js   # Executa as migrations no boot (transacional, rastreado em _migrations)
│   ├── migrations/          # Migrations .sql versionadas (idempotentes)
│   ├── routes/              # Rotas por domínio (auth, users, tickets, courses, ...)
│   ├── middleware/          # Autenticação/roles (isLoggedIn, checkRole)
│   ├── cron.js              # Tarefas agendadas
│   ├── public/              # widget.js e widget-form.html (widget de chamados)
│   └── Dockerfile
└── frontend/
    └── src/
        ├── index.tsx        # Rotas da aplicação (react-router)
        ├── api.ts           # Instância Axios + interceptor de token
        ├── context/         # AuthContext, ThemeContext
        ├── pages/           # Telas por domínio (admin, itsm, internal, courses, ...)
        ├── components/      # Componentes reutilizáveis (layout, ui, forms)
        └── styles/          # CSS numerado (1-global.css tem os tokens de tema)
```

---

## 🗄️ Banco de Dados & Migrations

As migrations ficam em `backend/migrations/` como arquivos `.sql` numerados e são **executadas automaticamente na inicialização** do servidor pelo `migrationRunner.js` — de forma transacional e rastreada na tabela `_migrations` (cada arquivo roda uma única vez, em ordem alfabética).

> ⚠️ Convenção do projeto: **toda migration deve ser idempotente** (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `INSERT ... ON CONFLICT DO NOTHING`), pois pode ser aplicada sobre um banco já existente.

Para criar uma nova alteração de schema, basta adicionar um arquivo com o próximo número (ex.: `0028_minha_alteracao.sql`) — ele será aplicado no próximo boot.

---

## 🚀 Rodando Localmente

### Pré-requisitos

- **Node.js** v18+ (recomendado)
- **PostgreSQL** acessível via _connection string_
- Contas em **Cloudinary** e **Resend** (para upload e e-mails)

### 1. Clonar

```bash
git clone https://github.com/Ino-Codes/VF-Painel-do-Licenciado.git
cd VF-Painel-do-Licenciado
```

### 2. Backend

```bash
cd backend
npm install
```

Crie um arquivo `.env` na pasta `backend/`:

```env
PORT=3001
DATABASE_URL=postgres://usuario:senha@host:5432/nome_do_banco
JWT_SECRET=sua_chave_secreta_jwt

# Cloudinary
CLOUDINARY_CLOUD_NAME=seu_cloud_name
CLOUDINARY_API_KEY=sua_api_key
CLOUDINARY_API_SECRET=sua_api_secret

# E-mail (Resend)
RESEND_API_KEY=sua_resend_api_key
EMAIL_FROM=nao-responda@seu-dominio.com

# URLs e cron
FRONTEND_URL=http://localhost:3000
CRON_SECRET_KEY=uma_chave_para_disparo_de_cron

# Logos das empresas (URLs)
LOGO_V_CORP=...
LOGO_V_TAX=...
LOGO_V_BANKING=...
LOGO_V_BUSINESS=...
LOGO_V_TECH=...
```

Inicie o servidor (as migrations rodam automaticamente no boot):

```bash
npm start
```

> O servidor sobe em `http://localhost:3001`.

### 3. Frontend

Em outro terminal:

```bash
cd frontend
npm install
```

Crie um arquivo `.env` na pasta `frontend/`:

```env
REACT_APP_API_URL=http://localhost:3001
```

Inicie a aplicação:

```bash
npm start
```

> A aplicação abre em `http://localhost:3000`.

---

## 🎫 Widget de Chamados (embed)

O widget de abertura de chamados é servido pelo **backend** (`backend/public/widget.js`). Para integrá-lo a um site de terceiro, cadastre o sistema em **Sistemas Integrados** e cole o _snippet_ gerado antes do fechamento da tag `</body>`:

```html
<script
  src="https://SEU-BACKEND/widget.js"
  data-api="https://SEU-BACKEND"
  data-token="TOKEN_DO_SISTEMA"
></script>
```

Funciona em qualquer site (com ou sem framework) — o botão flutuante, o formulário (iframe) e o envio do chamado são criados pelo próprio `widget.js`. O `data-token` identifica o sistema de origem.

---

## 📜 Scripts

**Backend** (`backend/`)

| Comando     | Descrição                                          |
| ----------- | -------------------------------------------------- |
| `node app.js` | Inicia o servidor e roda migrations |

**Frontend** (`frontend/`)

| Comando         | Descrição                                |
| --------------- | ---------------------------------------- |
| `npm start`     | Ambiente de desenvolvimento (porta 3000) |
| `npm run build` | Gera o _build_ de produção               |
| `npm test`      | Executa os testes                        |
