# Painel da V-CORP 🏢

O **Painel da V-CORP** é o sistema interno da **V-CORP Soluções Corporativas**: uma plataforma (intranet + LMS) que centraliza comunicação, gestão de conhecimento, rotinas de RH, inventário de TI e atendimento de chamados para as empresas do grupo (**V-TAX, V-BANKING, V-BUSINESS, V-CORP e V-TECH**) e para os parceiros externos (**V-PARTNER**).

## 🎯 Objetivo

Prover um ambiente unificado e seguro onde colaboradores internos e V-Partners possam acessar documentos oficiais, assistir a treinamentos, realizar avaliações, gerar certificados, acompanhar avisos corporativos, abrir e acompanhar chamados de suporte e executar rotinas de RH — tudo com controle de acesso por **grupos e permissões** e separação por **empresa**.

## ✨ Principais Funcionalidades

### 👥 Usuários e Acessos

- **Grupos & Permissões (RBAC):** cada tela do sistema gera uma permissão `.view` e, quando tem ações de escrita, uma `.manage`. O administrador cria grupos e marca as permissões de cada um. Grupos-padrão: **Administrador**, **RH**, **Comercial**, **Operacional** e **V-Partner**.
- **Interno × V-Partner:** a permissão especial `internal_access` define o colaborador interno. Quem não a tem é tratado como V-Partner e vê apenas o conteúdo da empresa V-PARTNER.
- **Multi-empresa:** colaboradores internos alternam entre as empresas do grupo; o conteúdo exibido segue a empresa selecionada.
- **Convite por e-mail:** o admin não define mais a senha inicial. Ao cadastrar um usuário (individualmente ou por CSV), o Painel envia um convite com um link para ele criar a própria senha, válido por 72 horas. A lista de usuários mostra quem tem convite pendente e permite reenviar o convite, individualmente ou em massa.
- **Login com verificação em duas etapas:** após a senha, um código de 6 dígitos é enviado por e-mail. Detalhes em [Autenticação e Senhas](#-autenticação-e-senhas).
- **Perfil:** dados pessoais, apelido (_nickname_), troca de senha, foto/avatar e **certificados externos** (diplomas e cursos feitos fora do Painel, com anexos).
- **Logs de atividade:** registro das ações relevantes dos usuários, incluindo tentativas de login, bloqueios, convites e trocas de senha.

### 📚 Plataforma de Ensino (LMS)

- **Trilhas de conhecimento:** cursos modulares com aulas em vídeo e texto.
- **Avaliações (Quiz):** testes com nota de corte.
- **Certificados:** gerados em PDF após conclusão e aprovação, a partir de um modelo SVG único (`backend/assets/certificado/modelo-cursos.svg`).

### 📂 Conteúdo e Comunicação

- **Documentos, Arquivos, Vídeos e Social Media:** repositórios centrais com visibilidade por empresa.
- **Mural de Avisos:** comunicados na tela inicial, com formatação, emojis e envio por e-mail.
- **FAQ:** base de perguntas e respostas frequentes.
- **Atas de Reuniões:** registro e consulta de atas, com anexos e envio por e-mail aos participantes.
- **Calendário Corporativo:** eventos e aniversariantes do mês.

### 🎫 Central de Chamados (Suporte / ITSM)

- **Canais de abertura:**
  - **Widget embutível:** botão flutuante para qualquer site de terceiro via _snippet_ `<script>` (ver [Widget de chamados](#-widget-de-chamados-embed)).
  - **E-mail:** mensagens recebidas viram chamados (webhook de entrada do Resend, com validação de assinatura), incluindo anexos.
  - **WhatsApp:** bot de atendimento via Zenvia para colaboradores internos — abertura guiada (assunto → descrição → confirmação), consulta dos próprios chamados e vínculo do telefone ao cadastro por código enviado por e-mail.
- **Quadro de atendimento (Kanban):** fluxo _Novo → Em Andamento → Concluído / Pausado_, com atribuição de atendente, instruções de resolução e anexos (até 3 arquivos de 10 MB).
- **Classificação pelo atendente:** quem abre o chamado não escolhe o tipo, em nenhum canal. O atendente classifica ao **iniciar o atendimento**, como _Bug_, _Dúvida_, _Solicitação_, _Melhoria_ ou _Acesso_, e pode reclassificar até concluir. Chamados antigos mantêm a classificação original (_Ajuda_, _Sugestão_).
- **Trava de atendimento:** só o atendente responsável pode mover, pausar, concluir ou reclassificar o chamado. O modal mostra quem está atendendo e oferece **Assumir atendimento**, com motivo, para quem tem a permissão especial `tickets_reassign`. Essa permissão também é exigida para excluir chamados.
- **Linha do tempo:** o modal do chamado mostra a abertura, as trocas de status, as classificações, o atendimento assumido e os **comentários** da equipe. Comentários só se somam, sem edição nem exclusão, e substituem o antigo campo único de observação.
- **Notificações:** e-mails de abertura e conclusão com link direto de acompanhamento; aviso de conclusão também pelo WhatsApp (template aprovado).
- **Avaliação do atendimento:** o solicitante dá uma nota ao chamado concluído.
- **Acompanhamento público (`/acompanhar`):** o solicitante externo consulta o status por _magic link_ ou por protocolo + e-mail — sem login.
- **Meus Chamados:** consulta interna dos próprios chamados.
- **Sistemas Integrados:** cadastro de tokens por sistema de terceiro, com _snippet_ pronto e instruções de integração.
- **Histórico de movimentação:** cada transição de status é registrada em `ticket_status_history`, base para os indicadores de atendimento nas Estatísticas.

### 🤝 RH e Gestão

- **Feedbacks 360:** criação, agendamento e resposta de convites.
- **Mural de Elogios:** reconhecimentos a colaboradores ou setores, apurados de uma urna física e transcritos por um curador; o autor nunca é exibido.
- **Eneagrama:** teste comportamental com estatísticas da equipe.
- **Projetos:** acompanhamento de projetos e tarefas.
- **Inventário de TI:** cadastro de ativos com sugestão de número de patrimônio. O status muda apenas por ações (entregar, devolver, transferir, manutenção, retorno, baixa), e cada ação fica registrada no histórico do ativo. O responsável pode ser uma pessoa ou um setor.
- **Estatísticas do Painel:** quatro abas.
  - **Atividade:** usuários ativos, adoção por público (colaboradores × V-Partners), horários de uso, saúde do acesso (logins concluídos × senha incorreta × e-mail não cadastrado) e arquivos mais baixados, com filtro de 30, 90 ou 180 dias.
  - **Central de Chamados:** volume, tipos, canais, tempos de atendimento e avaliações por atendente.
  - **Eneagrama:** participação por setor e perfil médio da equipe.
  - **Cursos.**

### 🎨 Interface (UI/UX)

- **Modo Claro/Escuro** com persistência de preferência.
- **Design responsivo** para desktop e mobile.

---

## 🔑 Autenticação e Senhas

As regras ficam centralizadas em `backend/authSession.js` (sessão, política de senha, limite de tentativas) e `backend/linkDeSenha.js` (links de convite e de redefinição).

- **Login em duas etapas:** a senha e, depois, um código de 6 dígitos enviado por e-mail. O código vale por 2 minutos e uma única vez, com até 5 tentativas. Reenviar o código não zera as tentativas, e cada conta recebe no máximo 5 códigos a cada 15 minutos. O e-mail é aceito com maiúsculas e espaços.
- **Bloqueio por tentativas:** 10 senhas erradas para o mesmo e-mail, ou 30 falhas vindas do mesmo IP, bloqueiam novos logins por 15 minutos, mesmo com a senha certa. Os bloqueios ficam registrados no log de atividades.
- **Primeiro acesso:** enquanto a troca de senha obrigatória estiver pendente, o modal de troca aparece em qualquer tela e o backend recusa as demais rotas (`403 TROCA_DE_SENHA_OBRIGATORIA`).
- **Redefinição ("Esqueceu a senha?"):** link válido por 15 minutos e uma única vez, com no máximo 3 pedidos por e-mail a cada 15 minutos. A resposta é a mesma exista ou não a conta.
- **Política de senha:** mínimo de 8 caracteres, com letras e números, sem conter o e-mail. Vale no convite, na redefinição, no primeiro acesso e na troca pelo perfil, e é validada no backend (o frontend repete a regra em `frontend/src/utils/senha.ts`).
- **Encerramento de sessões:** trocar ou redefinir a senha derruba as outras sessões abertas, comparando o `iat` do token com `users.password_changed_at`. A sessão atual recebe um token novo. O frontend leva quem teve a sessão derrubada de volta ao login (`401 SESSAO_ENCERRADA`).
- **Tokens:** JWT de 12 horas, sempre montado a partir do banco. As rotas de foto e de senha só aceitam o próprio usuário.

---

## 🛠️ Tecnologias

**Frontend**

- React 19 + TypeScript (Create React App / `react-scripts`)
- React Router DOM (navegação)
- Axios (consumo da API)
- Chart.js + react-chartjs-2 (gráficos)
- FullCalendar (calendário)
- Tiptap (editor de texto rico)
- dnd-kit (drag-and-drop)
- react-icons, react-select, react-imask, react-hot-toast, emoji-picker-react, DOMPurify

**Backend**

- Node.js 22 + Express
- PostgreSQL (`pg`, SQL direto) — **migrations aplicadas automaticamente no boot**
- JWT (`jsonwebtoken`) + Bcrypt.js (autenticação e senhas)
- Cloudinary (imagens)
- Azure Blob Storage (documentos: PDF, Office etc., em container privado com links temporários)
- Resend (e-mails transacionais e e-mails de entrada para chamados)
- Zenvia (WhatsApp)
- Multer (upload multipart)
- Puppeteer-core + @sparticuz/chromium (geração de PDF de certificados)

**Infra**

- **Frontend:** hospedado na **Vercel**
- **Backend e banco de dados (PostgreSQL):** hospedados no **Render** (com `Dockerfile`)

---

## 📁 Estrutura do Repositório

```
VF-Painel-do-Licenciado/
├── backend/
│   ├── app.js               # Entrada do Express, CORS por rota, wiring das rotas
│   ├── migrationRunner.js   # Executa as migrations no boot (transacional, rastreado em _migrations)
│   ├── migrations/          # Migrations .sql versionadas (idempotentes)
│   ├── permissions.js       # Catálogo de permissões (RBAC) e presets dos grupos-padrão
│   ├── permissionCache.js   # Cache em memória das permissões por grupo
│   ├── seedGroups.js        # Cria os grupos-padrão no boot (sem sobrescrever customizações)
│   ├── companyAccess.js     # Regra de visibilidade por empresa (interno × V-Partner)
│   ├── authSession.js       # Token, política de senha, limite de tentativas, sessões
│   ├── linkDeSenha.js       # Links de convite (1º acesso) e de redefinição de senha
│   ├── middleware/          # Autenticação e permissões (isLoggedIn, checkPermission)
│   ├── routes/              # Rotas por domínio (auth, users, tickets, courses, itAssets, ...)
│   ├── storage/             # Destino dos arquivos (Cloudinary × Azure Blob)
│   ├── certificados/        # Geração do PDF do certificado de curso
│   ├── assets/certificado/  # Modelo SVG do certificado
│   ├── whatsappSender.js    # Cliente de envio de mensagens (Zenvia)
│   ├── public/              # widget.js e widget-form.html (widget de chamados)
│   └── Dockerfile
└── frontend/
    └── src/
        ├── index.tsx        # Rotas da aplicação (react-router), protegidas por permissão
        ├── api.ts           # Instância Axios + interceptor de token
        ├── context/         # AuthContext (usuário, permissões, empresa), ThemeContext
        ├── pages/           # Telas por domínio (admin, itsm, internal, courses, ...)
        ├── components/      # Componentes reutilizáveis (layout, ui, forms, ...)
        └── styles/          # CSS numerado (1-global.css tem os tokens de tema)
```

---

## 🔐 Permissões (RBAC)

O catálogo de permissões fica em **código**, em `backend/permissions.js` (fonte única). O frontend o consome por `GET /api/groups/permissions-catalog` para montar a tela de **Grupos & Permissões**.

- No backend, as rotas são protegidas com `isLoggedIn` + `checkPermission("tela.view")` / `checkPermission("tela.manage")`.
- No frontend, as rotas usam `<ProtectedRoute permission="tela.view">` e os menus usam `hasPermission(...)` do `AuthContext`. **Toda tela e item de menu só aparece para quem tem o `.view` da tela.**
- Para criar uma tela nova, adicione-a em `SCREENS` no `permissions.js` e conceda a permissão aos grupos pela tela de Grupos & Permissões.
- Além das permissões por tela, há permissões especiais: `internal_access` (colaborador interno) e `tickets_reassign` (assumir e excluir chamados de outros atendentes, concedida de início só ao Administrador).
- Os grupos **Administrador** e **V-Partner** (slug `licenciado`) são protegidos e não podem ser excluídos.

---

## 🗄️ Banco de Dados & Migrations

As migrations ficam em `backend/migrations/` como arquivos `.sql` numerados e são **executadas automaticamente na inicialização** do servidor pelo `migrationRunner.js` — de forma transacional e rastreada na tabela `_migrations` (cada arquivo roda uma única vez, em ordem alfabética).

> ⚠️ Convenção do projeto: **toda migration deve ser idempotente** (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `INSERT ... ON CONFLICT DO NOTHING`), pois pode ser aplicada sobre um banco já existente.

Para criar uma nova alteração de schema, basta adicionar um arquivo com o próximo número (ex.: `0054_minha_alteracao.sql`) — ele será aplicado no próximo boot.

> ⚠️ O backend rodando localmente aplica as migrations no banco para o qual o `.env` aponta. Se for o banco de produção, reiniciar o servidor local já altera a produção.

---

## 🚀 Rodando Localmente

### Pré-requisitos

- **Node.js** v22+ (o Azure Blob Storage precisa de `crypto.randomUUID`, que falta nas versões antigas; o `Dockerfile` usa `node:22`)
- **PostgreSQL** acessível via _connection string_
- Contas em **Cloudinary** e **Resend** (upload de imagens e e-mails)
- Opcional: **Azure Storage Account** (documentos) e **Zenvia** (WhatsApp)

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

Copie o modelo [`backend/.env.example`](backend/.env.example) para `backend/.env` e preencha com os valores reais. O modelo lista todas as variáveis que o backend lê, separando as obrigatórias das opcionais. Em ambiente local, defina `FRONTEND_URL=http://localhost:3000` para os links de convite e de redefinição apontarem para o frontend local (o padrão é o endereço de produção).

```bash
cp .env.example .env
```

Inicie o servidor (as migrations e o seed dos grupos rodam automaticamente no boot):

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

### Webhooks dos outros canais

| Canal    | Endpoint                               | Observação                                             |
| -------- | -------------------------------------- | ------------------------------------------------------ |
| E-mail   | `POST /api/ticket/inbound`             | Webhook de entrada do Resend (assinatura validada)     |
| WhatsApp | `POST /api/whatsapp/webhook/:secret`   | Webhook da Zenvia; `:secret` = `WHATSAPP_WEBHOOK_SECRET` |

---

## 📜 Scripts

**Backend** (`backend/`)

| Comando     | Descrição                                           |
| ----------- | --------------------------------------------------- |
| `npm start` | Inicia o servidor, roda migrations e o seed de grupos |

**Frontend** (`frontend/`)

| Comando         | Descrição                                |
| --------------- | ---------------------------------------- |
| `npm start`     | Ambiente de desenvolvimento (porta 3000) |
| `npm run build` | Gera o _build_ de produção               |
