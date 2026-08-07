# Resumo de alterações — Refinamento visual do Painel V-CORP

> Sessão de refinamento de UI/UX (Agosto/2026). Foco: consolidar a identidade visual (glass + dourado da marca), corrigir bugs de usabilidade e padronizar componentes.
>
> **Importante:** nenhuma alteração foi commitada, enviada ou deployada. O ambiente local roda contra o **banco de PRODUÇÃO**.

---

## 1. Post de LinkedIn + card "Antes × Depois"
- Redigidos 3 textos de post (principal, curto e "bastidores") exaltando stack e uso de IA.
- Gerado um **card 1080×1080** comparando a Home antiga × nova (telas reais, com dados fictícios) dentro de moldura dourada da marca.
- *Entregável de imagem — não afeta o código.*

## 2. Correção da foto de perfil + modal redesenhado
**Bug corrigido:** ao salvar a foto, o front lia `res.data.avatarUrl` (inexistente) e chamava `login()` sem token, gravando `"undefined"` no `localStorage` e quebrando a sessão.
- `frontend/src/components/forms/AvatarModal.tsx` — passa a usar `res.data.user` + `res.data.token`; visual reescrito no padrão **glass/dourado** (anel dourado, overlay de câmera no hover, botões Salvar dourado / Cancelar ghost / Remover vermelho).
- `frontend/src/context/AuthContext.tsx` — `login()` defensivo: nunca grava token `undefined` e preserva o token atual quando nenhum novo é enviado.
- `backend/routes/users.js` — `DELETE /:id/avatar` agora retorna o `token` (já era gerado, mas não era enviado). *Requer redeploy do backend para valer em produção.*

## 3. Avatar do menu superior (tamanho)
- `frontend/src/styles/4-Menu.css` — `.profile-image-container` ganhou tamanho fixo (círculo 40×40, `overflow:hidden`), corrigindo a foto que aparecia em tamanho original e esticava o menu.

## 4. Padronização de TODOS os modais (visual glass)
- `frontend/src/styles/2-components.css`:
  - `.modal-overlay` — fundo escurecido + **blur** + fade-in.
  - `.modal-content` — superfície **glass**, borda/sombra por token, cantos 18px, animação de entrada.
  - `.modal-content h2`, `.modal-close-button` (X circular com hover) padronizados.
  - Botões de ação escopados a modais: primário **dourado**, cancelar **ghost**.
- Atinge os ~30 modais de uma vez (herdam das classes-base).

## 5. Botões "Pesquisar" → dourado
- `frontend/src/styles/2-components.css` — `.search-bar .form-button` no dourado da marca (Documentos, FAQ, Arquivos, Logs, Usuários).

## 6. Tela de Usuários reorganizada
- `frontend/src/pages/admin/AdminUsers.tsx` — botão **"+ Adicionar Novo"** movido para a mesma linha do título da página.
- `frontend/src/pages/admin/TabContent.tsx` — removidos o subtítulo "Cadastrar…" e o título "Usuários Cadastrados"; sobrou: **título+ação → abas → listagem**.

## 7. Botões "Salvar" / "Cancelar" no novo visual (global)
- `frontend/src/styles/2-components.css` — base `.form-button` → **dourado**; `.form-button-cancel` → **ghost** (borda de vidro). Aplica dentro e fora de modais.
- `frontend/src/pages/admin/ChecklistTemplatesAdmin.tsx` — "Cancelar" inline trocado de `.delete-button` (vermelho) para `.form-button-cancel`.
- *Efeito global:* todo botão primário (`.form-button`) passou a ser dourado — inclui "Consultar", "Baixar Certificado", "Criar…", etc.

## 8. `--glass-surface` no modo claro
- `frontend/src/styles/1-global.css` — no tema claro a superfície de vidro era quase transparente e sumia no fundo claro. Passou a ser **branco opaco** (`linear-gradient(127deg,#ffffff,#f6f6f8)`), com borda/sombra levemente reforçadas. Modo escuro intacto.

## 9. Bordas dos elementos glass
- Elementos com `background: var(--glass-surface)` **e** borda passaram a usar `border: 1px solid var(--glass-border)`:
  - `frontend/src/styles/12-Internal.css` (`.vacation-history-item`)
  - `frontend/src/styles/6-ContentPages.css` (`.lesson-sidebar`)

## 10. Filtro de empresa (telas de conteúdo)
- `frontend/src/styles/6-ContentPages.css` — pills no padrão glass/dourado: inativas em vidro com borda; hover com acento dourado; **ativa em dourado** com leve brilho (antes era preta).

## 11. Correção de z-index do dropdown de Notificações
- `frontend/src/styles/4-Menu.css` — `.main-menu` recebeu `position: relative; z-index: 500;`.
- **Causa:** o `backdrop-filter` (glass) do menu criava um contexto de empilhamento; sem `z-index`, o dropdown ficava atrás do conteúdo. Agora abre à frente do conteúdo e continua **abaixo dos modais** (`z-index:1000`).

## 12. Modal de formulário — fim do "vidro sobre vidro"
- `frontend/src/styles/2-components.css` — `.modal-content .admin-form` / `.on-screen-form` ficam **sem superfície própria** dentro de modais (só o `.modal-content` dá o vidro). Corrige o gradiente duplicado no modal de cadastro/edição. Fora de modal, esses forms mantêm o card de vidro.

## 13. Ícone "X" para fechar em todos os modais
- Adicionado botão `.modal-close-button` (`&times;`) como 1º filho do `.modal-content` em **16 modais** que não tinham: Archive, Event, Course, Interview, Lesson, File, Video, UserForm, FAQ, OptionEdit, QuestionEdit, Notice, Meeting, Confirmation, SocialPost, WidgetTenants.
- 14 modais já possuíam; `ForcePasswordResetModal` mantido **sem X** de propósito (troca de senha obrigatória).

---

## Explorações visuais (mockups — ainda NÃO implementados)
Aguardando sua decisão para virar código:
- **3 variações de visual da Home** usando preto + branco + dourado (claro e escuro): A) acento dourado sóbrio; B) bloco preto + dourado; C) cartões emoldurados.
- Comparativo de **3 layouts de modal de cadastro/edição** (a Opção 1 "Flat" foi a implementada no item 12).

## Pendências / observações
- **Nada commitado/deployado.** Recomenda-se testar recarregando o app.
- A correção do `DELETE /avatar` (backend) só vale em produção **após redeploy** do backend.
- Decidir se o **dourado global** nos botões primários (item 7) fica como está ou se restringe a "Salvar/Cancelar".
- Escolher qual variação da Home (se alguma) implementar.

## Arquivos tocados (código)
- `backend/routes/users.js`
- `frontend/src/context/AuthContext.tsx`
- `frontend/src/components/forms/AvatarModal.tsx`
- `frontend/src/pages/admin/AdminUsers.tsx`, `TabContent.tsx`, `ChecklistTemplatesAdmin.tsx`
- `frontend/src/styles/1-global.css`, `2-components.css`, `4-Menu.css`, `6-ContentPages.css`, `12-Internal.css`
- **+X em modais:** `components/forms/` (ArchiveModal, EventModal, CourseModal, LessonEditModal, FileModal, VideoModal, UserFormModal, FaqModal, OptionEditModal, QuestionEditModal, NoticeModal, MeetingModal, SocialPostModal), `components/recruitment/InterviewModal.tsx`, `components/ui/ConfirmationModal.tsx`, `pages/itsm/WidgetTenants.tsx`
