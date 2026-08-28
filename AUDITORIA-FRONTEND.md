# Auditoria do Frontend — Painel da V-CORP

> Levantamento de melhorias do código em `frontend/src`: código morto, bugs, más práticas, segurança, acessibilidade, TypeScript, consistência e performance.
> **Data:** 2026-08-27 · **Escopo:** `frontend/src` (React 19 + TypeScript / CRA) · 106 arquivos `.tsx`/`.ts`.
> **Natureza:** apenas levantamento — nenhuma correção aplicada além das indicadas no changelog. Marque os itens conforme forem resolvidos.

## Changelog

- **2026-08-27** — Funcionalidades **Recrutamento** e **Férias** removidas do sistema (backend, frontend e banco). Os itens desta lista que se referiam a arquivos de recrutamento (`pages/admin/Recruitment*`, `InterviewsCalendar`, `ChecklistTemplatesAdmin`, `components/recruitment/*`, `components/admin/TemplateItemsModal`, `types/recruitment.ts`) foram **removidos** desta auditoria por não existirem mais. Resolvidos como efeito colateral: o conflito de tipos `Unit` (o `types/recruitment.ts` deixou de existir; sobra apenas `types.ts`) e a coexistência de duas libs de drag-and-drop (`react-dnd` só era usada no recrutamento; restou só `@dnd-kit`).
  - ⚠️ `frontend/src/styles/13-Recruitment.css` foi **mantido de propósito**: apesar do nome, concentra estilos compartilhados por telas vivas (`.kanban-*` na Central de Chamados; `.page-header/title/actions/filters` em ~10 páginas; `.form-group` em vários modais). As regras exclusivas de recrutamento dentro dele seguem como CSS morto inofensivo (candidatas a um *trim* cuidadoso futuro).

## Convenções deste documento

- **Severidade:** `[alta]` (corrigir cedo — crash, dado errado, segurança) · `[média]` (impacto real, sem urgência) · `[baixa]` (higiene/limpeza).
- Referências no formato `caminho:linha`.
- ⚠️ **O build passa mesmo com erros de tipo** porque é executado com `CI=false`, que rebaixa erros do type-checker a *warnings*. Vários itens de TypeScript abaixo são erros reais mascarados por isso.

---

## 🔴 Bugs de correção / crashes

- [x] **[média]** `frontend/src/pages/profile/EnneagramPage.tsx:19` e `frontend/src/pages/profile/EnneagramResultsPage.tsx:56` — `fetch` sem `.catch` → *spinner eterno* em falha. ✅ _Resolvido (2026-08-27): `.catch`/`.finally` + estado de erro nas duas telas._
- [x] **[média]** `frontend/src/pages/profile/EnneagramResultsPage.tsx:173` — desreferencia `dominantTypeInfo` possivelmente `undefined` → crash da página. ✅ _Resolvido (2026-08-27): guarda de `dominantTypeInfo` com tela de erro._
- [x] **[média]** `frontend/src/components/ui/SortableModuleItem.tsx:58-72` — sem null-check de `over` (crash ao soltar fora de um alvo) + mutação de estado aninhado no handler de drag. Mesmo padrão de `over` em `frontend/src/pages/admin/AdminCourseEditor.tsx:53`. ✅ _Resolvido (2026-08-27): null-check de `over`, guardas de índice e atualização imutável nos dois handlers (`DragEndEvent` tipado)._
- [x] **[média]** *UTC date-shift*: `new Date(...).toISOString().split("T")[0]` desloca o dia conforme o fuso — `frontend/src/components/forms/EventModal.tsx:129`. ✅ _Resolvido (2026-08-27): helper `getFormattedDate` em fuso local._
- [x] **[média]** `frontend/src/components/forms/TimePicker.tsx:39-47` — sem validação/máscara; string inválida ("99:99", "abc") flui para `new Date().toISOString()` nos consumidores e pode lançar no submit. ✅ _Resolvido (2026-08-27): máscara `HH:mm` na digitação + clamp no blur (só horário válido ou vazio é emitido)._
- [x] **[média]** `frontend/src/components/forms/MeetingModal.tsx:115` — remoção de anexo dispara `DELETE` imediatamente; cancelar o modal não desfaz a exclusão. ✅ _Resolvido (2026-08-27): remoção marcada localmente; `DELETE` só é efetivado ao salvar._
- [x] **[baixa]** Modais que não resetam campos ao reabrir: `frontend/src/components/forms/OptionEditModal.tsx:18`, `frontend/src/components/forms/QuestionEditModal.tsx:18`. ✅ _Resolvido (2026-08-27): effect sempre sincroniza (reset para "" ao abrir para novo item)._
- [x] **[baixa]** `frontend/src/index.tsx` — `<meta viewport>` solto no meio do JSX: no-op (pertence a `public/index.html`). ✅ _Resolvido (2026-08-27): removido (o viewport já existe em `public/index.html`)._
- [x] **[baixa]** `frontend/src/components/ui/EmptyState.tsx:5` — o tipo aceita `imageKey="logo"`, mas `logo` não existe no `iconMap` (`utils/assets.ts`) → sempre cai no fallback `—`. ✅ _Resolvido (2026-08-27): tipo `IconKey` exportado de `assets.ts` e usado no `EmptyState` (chaves reais do `iconMap`)._
- [x] **[baixa]** Acesso sem guarda: `frontend/src/pages/social/SocialMedia.tsx:167` (`post.images[0]`). ✅ _Resolvido (2026-08-27): render de imagem guardado por `post.images?.length > 0`._
- [x] **[baixa]** `frontend/src/pages/profile/Perfil.tsx:80-120` — estado `nome` sem input associado para não-internos → o nome nunca fica editável na UI. ✅ _Resolvido (2026-08-27): estado `nome` morto removido; save usa `editForm.nome` (interno) ou `user.nome` (não-interno)._

## 🔒 Segurança

- [x] **[média]** `dangerouslySetInnerHTML` com HTML do servidor **sem sanitização** (ex.: DOMPurify): `frontend/src/pages/home/Home.tsx:175`, `frontend/src/pages/notices/MuralDeAvisos.tsx:190`, `frontend/src/pages/courses/LessonPlayer.tsx:261`. Risco de XSS armazenado se o conteúdo (Tiptap/aulas) não for sanitizado no backend. ✅ _Resolvido (2026-08-27): adicionado `dompurify`; helper `frontend/src/utils/sanitize.ts` (`sanitizeHtml`) aplicado nos 3 pontos._
- [x] **[média]** Identidade via header `x-user-id` (falsificável) em vez do token: `frontend/src/pages/courses/LessonPlayer.tsx:63`, `frontend/src/pages/courses/QuizPlayer.tsx`, `frontend/src/pages/admin/AdminCourses.tsx:37`. ✅ _Resolvido (2026-08-27): header `x-user-id`/`getAuthHeaders` removido dos 3 arquivos (o backend já ignorava e usa o JWT). **Bug real encontrado e corrigido:** `backend/routes/quizzes.js` gravava a tentativa com o `userId` vindo do body — agora usa `req.user.id`; o `userId` saiu do body do `QuizPlayer`._
- [ ] **[baixa]** Token de widget hardcoded no fonte: `frontend/src/components/layout/SupportWidget.tsx:7` (marcado como público — confirmar que não é sensível). ⏳ _Requer decisão: qualquer token embarcado no frontend é **público** (vai no bundle do navegador). Se for realmente segredo, não pode viver no frontend — mover para o backend. Se for um identificador público de widget, está OK como está. Aguardando confirmação._

## ☠️ Código morto / duplicação

- [x] **[média]** Casca de modal copiada em ~18 modais → extrair um `<Modal>` único. **`ArchiveModal.tsx` e `FileModal.tsx` são ~95% idênticos**; `Documentos.tsx` e `Arquivos.tsx` idem. ✅ _Resolvido (2026-08-27): criado `components/ui/Modal.tsx` (casca reutilizável); `FileModal`+`ArchiveModal` unificados em `components/forms/ContentFileModal.tsx` (por `resource`) usando o `<Modal>`; `Documentos`+`Arquivos` unificados em `pages/content/ContentLibrary.tsx` (as páginas viraram wrappers finos); os 2 modais antigos foram deletados._ **Adoção do `<Modal>` concluída (2026-08-27):** 15 modais migrados para o `<Modal>` (Course, Event, Faq, FeedbackFill, FeedbackInitiate, LessonEdit, Meeting, Notice, OptionEdit, Project, QuestionEdit, SocialPost, Task, UserForm, Video). O `<Modal>` ganhou `closeOnOverlayClick`/`className`/`overlayClassName`/`title` opcional para cobrir as variações. **Não migrados (de propósito):** `AvatarModal` (card próprio, sem `modal-content`), `ForcePasswordResetModal` (não-dispensável, sem `onClose`), `UserDetailModal` (botão de fechar com classe própria), `ConfirmationModal` (primitivo à parte) e os modais inline de páginas (WidgetTenants/GroupsManagement/HelpDeskKanban, com header customizado).
- [ ] **[média]** ⏳ _PARCIAL:_ `COMPANIES_OPTIONS` duplicado literalmente em modais. ✅ _File/Archive agora usam uma única cópia em `ContentFileModal`._ Restam **3 dups** (`CourseModal`, `SocialPostModal`, `VideoModal`). _Não é drop-in com o `COMPANY_OPTIONS` de `CompanyFilter.tsx`: formas diferentes (`{slug,name}` × `{value,label}`) e semântica distinta (o `COMPANY_OPTIONS` inclui "all", que é filtro, não alvo de publicação). Ideal: uma constante compartilhada `{slug,name}` para publicação._
- [x] **[média]** Rótulos `htmlFor="visibility"` apontando para id inexistente (resíduo da visibilidade removida): `ArchiveModal`, `FileModal`, `TaskModal`, `VideoModal`. String "visibilidade" também em `NoticeModal`. ✅ _Resolvido (2026-08-27): `htmlFor="visibility"` removido dos 4 rótulos; string do NoticeModal atualizada para "Todos os destinatários da empresa selecionada"._
- [x] **[média]** Uploads mortos (arquivo nunca setado → funcionalidade inerte): thumbnail em `CourseModal` e documento em `FaqModal`. ✅ _Resolvido (2026-08-27): estados e caminhos de upload mortos removidos (o recurso já estava desativado); bloco comentado de thumbnail do CourseModal também removido._
- [x] **[média]** `frontend/src/pages/company/Empresa.tsx` + `MapaEscritorios.tsx` — mapa não renderizado, `selectedState` congelado, `stateNames`/imports não usados, blocos comentados ("Nossa História"). ✅ _Resolvido (2026-08-27): `MapaEscritorios.tsx` **deletado**; `Empresa` limpo (removidos `selectedState`/`unitMap`/`filteredUsers`/`stateNames`/`useUnits` e os blocos comentados; passa a listar todos os colaboradores — comportamento idêntico ao que já ocorria)._
- [x] **[média]** `frontend/src/pages/itsm/WidgetTenants.tsx:46` — estado `copiedId` escrito mas nunca lido; + imports não usados. ✅ _Resolvido (2026-08-27): `copiedId`/`setCopiedId` removidos e imports `useNavigate`/`useParams`/`FiPlus`/`FiCheck` retirados._
- [x] **[média]** `console.log` de debug em `Recruitment.tsx`. ✅ _Resolvido (arquivo removido na eliminação do Recrutamento)._
- [x] **[média]** Bloco comentado de injeção de widget (com token/localhost) em `Footer.tsx`; bloco de thumbnail comentado em `CourseModal.tsx`. ✅ _Resolvido (2026-08-27): Footer reescrito sem o bloco (e sem o `useEffect` órfão); bloco do CourseModal removido._
- [x] **[baixa]** `useNavigate`/`navigate` importados e não usados em telas admin: `ActivityLogs`, `AdminCalendar`, `AdminStatistics`, `AdminUsers`, `Dashboards`. Também `Menu.tsx` com `<h2>`/`NavLink` de FAQ comentados. ✅ _Resolvido (2026-08-27): import + `const navigate` removidos das 5 telas; comentários do Menu removidos._
- [x] **[baixa]** Imports/estados não usados diversos: `MapaEscritorios`/`LogosTheme`/`useUnits` (company). ✅ _Resolvido (2026-08-27): imports mortos removidos de `Empresa`, `UserCard` (LogosTheme) e `UserDetailModal` (useUnits/Unit/getUnitNameById). **Nota:** `components/ui/LogosTheme.tsx` ficou **órfão** (sem importadores) — mantido por ora; candidato a exclusão se confirmado que não será usado._

## ⚛️ Boas práticas React

- [x] **[média]** `useEffect`/`useCallback` com deps faltando `hasPermission` (stale-closure): Home, AdminCalendar, SupportWidget. ✅ _Resolvido (2026-08-27): `hasPermission`/`hasAnyPermission` memoizados com `useCallback` no `AuthContext` (identidade estável) e incluídos nas deps dos 3 consumidores._
- [x] **[média]** Ausência de estado de erro (só toast → tela/board vazio, indistinguível de "sem dados"): HelpDeskKanban, AdminUsers, ActivityLogs, EnneagramStats, CourseEngagementDash, AdminCourses. ✅ _Resolvido (2026-08-27): estado `loadError` nas 6 telas — em falha mostra mensagem de erro no lugar do vazio; reseta em cada fetch bem-sucedido._
- [x] **[média]** Erros engolidos (`catch(()=>{})` ou toast sem log): `ForcePasswordResetModal`, `useUnits`, `AuthContext:refreshUser`. ✅ _Resolvido (2026-08-27): `console.error` em `useUnits` e `ForcePasswordResetModal`. (O catch de `refreshUser` no AuthContext é silencioso **de propósito** — expiração de token é tratada pelo fluxo normal; mantido.)_
- [x] **[média]** `ResetPassword` — botão de submit sem `disabled`/loading → duplo-submit possível. ✅ _Resolvido (2026-08-27): estado `submitting` (botão desabilitado + "Redefinindo…"); removido o `message` morto._
- [ ] **[média]** ⏳ _ADIADO (requer backend):_ `frontend/src/pages/profile/Perfil.tsx` — *over-posting*: espalha o objeto `user` inteiro no `PUT`. _O handler de update do backend substitui colunas nomeadas e **depende de receber os valores atuais** (o `...user` hoje evita zerar `telefone`/`data_admissao`/etc.). Um fix só no frontend zeraria dados; o correto é tornar o `UPDATE` parcial no backend (COALESCE) antes de enxugar o payload._
- [x] **[baixa]** Vazamento de `URL.createObjectURL` nunca revogado: `AvatarModal`, `SocialPostModal`. ✅ _Resolvido (2026-08-27): revoga ao trocar/remover e no unmount._
- [x] **[baixa]** `window.confirm` em vez do `ConfirmationModal`: `WidgetTenants` (excluir + regenerar) e `EventModal` (delete sem confirmação). ✅ _Resolvido (2026-08-27): ambos usam `ConfirmationModal` (WidgetTenants via estado de ação pendente; EventModal com diálogo de confirmação de exclusão)._
- [x] **[baixa]** `localStorage`/`JSON.parse` sem `try/catch` (quebra o boot em modo privado/storage bloqueado): AuthContext, ThemeContext, api.ts. ✅ _Resolvido (2026-08-27): helper `utils/safeStorage.ts` (get/set/remove com try/catch) usado nos 3; `JSON.parse` do boot protegido._
- [x] **[baixa]** `toast.dismiss()` sem id descarta todos os toasts: `AdminCourseEditor`. ✅ _Resolvido (2026-08-27): usa o id do toast de loading (`toast.dismiss(toastId)`)._

> **Achado incidental (fora do escopo desta seção, não alterado):** `frontend/src/api.ts` tem `baseURL` **hardcoded** em `http://localhost:3001` (a linha com `process.env.REACT_APP_API_URL` está comentada). Se o build de produção usa este arquivo, as chamadas apontam para localhost — confirmar como o deploy define a URL da API.

## 🧩 TypeScript (build passa por causa do `CI=false`)

- [ ] **[alta]** `frontend/src/pages/admin/TabContent.tsx` — tipos fora de sincronia com o uso: `state.sortConfig` ausente do tipo, prop obrigatória `fetchUsers` nunca passada, união `tab` (`"colaboradores"`) diverge dos callers (`"interno"`). Erros de tipo reais, mascarados.
- [ ] **[média]** `any` difundido: `frontend/src/hooks/useApi.ts:11,18` (vaza para o app inteiro), `frontend/src/pages/internal/Projetos.tsx:136` (`useAuth() as {user:any}`), `EventModal`, `SocialPostModal`, `EnneagramPage`/`EnneagramResultsPage` (modelos inteiros sem tipo), + ~40 `catch(err:any)`/`params:any`.

## ♿ Acessibilidade

- [x] **[média]** `<a href="#">` usado como botão no fluxo de login/2FA/recuperação: `frontend/src/pages/public/App.tsx:211,255,266,307`. Mesmo padrão em `LessonPlayer.tsx:304`. — ✅ Resolvido (2026-08-27): trocados por `<button type="button" className="link-button">`; nova classe utilitária `.link-button` em `1-global.css` (reset de botão herdando cor/fonte), seletor de cor do login estendido (`3-Login.css`), e `.sidebar-lesson-item` ajustado p/ botão (largura total, alinhamento à esquerda). Sem mudança visual.
- [x] **[média]** Elementos clicáveis `<div onClick>` sem `role`/`tabIndex`/teclado: `CourseCard`, swatches de cor (`EventModal`, `TaskModal`), opções do `TimePicker`, cards de gestão (`AdminGestao`/`InternalGestao`). — ✅ Resolvido (2026-08-27): helper `utils/a11y.ts` (`onKeyActivate` → Enter/Espaço); cards de navegação com `role="button"`+`tabIndex`+teclado; swatches como `role="radio"` dentro de `role="radiogroup"` (`aria-checked`/`aria-label` de cor); opções do TimePicker como `role="option"` em `role="listbox"` (`aria-selected`).
- [x] **[baixa]** Inputs sem `<label htmlFor>`/`aria-label`: `DatePicker`, `TimePicker`, `ProjectModal`, `CourseModal`. — ✅ Resolvido (2026-08-27): `aria-label` em DatePicker/TimePicker (sem rótulo visível) e no textarea de descrição do CourseModal; rótulos visíveis de ProjectModal/CourseModal associados via `htmlFor`/`id`.

## 🔁 Consistência / convenções

- [ ] **[média]** Dependência do `role` legado onde deveria ser permissão: coluna "Tipo" em `frontend/src/pages/admin/TabContent.tsx:108`; `role` enviado como filtro de conteúdo em `frontend/src/pages/videos/Videos.tsx:71`.
- [ ] **[média]** *Anti-cache hack* (`_t` + headers `no-cache/no-store`) copiado em 5 páginas (`CoursesPage`, `Documentos`, `Arquivos`, `Videos`, `Faq`) — sintoma de cache/304 a resolver **no servidor** (ETag/`Cache-Control`).
- [ ] **[média]** `frontend/src/components/ui/ThemeToggleButton.tsx:13` — estilo via `onMouseOver`/`onMouseOut` manipulando `.style` (deveria ser `:hover` no CSS).
- [ ] **[baixa]** Modais artesanais sem foco-trap/ESC (ex.: `frontend/src/pages/admin/GroupsManagement.tsx:255`); URLs de imagem Cloudinary repetidas em ~8 arquivos (candidatas a uma constante compartilhada); `frontend/src/components/ui/LoadingSpinner.tsx:6` com `style` estático inline.

## ⚡ Performance

- [x] **[média]** Refetch desnecessário ao trocar aba/filtro (a função de fetch depende do próprio estado que ela seta): `SocialMedia`, `ContentLibrary` (Documentos/Arquivos). — ✅ Resolvido (2026-08-27): `setActiveCategory`/`setCategory` passaram a usar update funcional, removendo o estado da aba das deps do `useCallback`; trocar de aba não dispara mais a busca de categorias no servidor. **`Videos` verificado e mantido**: ali a categoria é filtro do servidor (vai como param `category`), então o refetch ao trocar de aba é legítimo — não é o mesmo bug.
- [x] **[baixa]** Cálculos pesados sem `useMemo`: `buildTimelineColumns`/`groupByYear` em `frontend/src/pages/internal/Projetos.tsx`. — ✅ Resolvido (2026-08-27): os dois cálculos do cronograma envoltos em `useMemo` (deps `tasks`→`columns`).
  - ⏳ `EnneagramStats.tsx` **mantido de propósito**: o cálculo do gráfico já roda só quando `[theme, stats, typesInfo]` mudam (via `useEffect`), não a cada render. Migrar para `useMemo` leria as CSS vars (`getComputedStyle`) **durante o render**, antes de o `ThemeProvider` aplicar a classe de tema no `body` (que acontece em `useEffect`, pós-paint) → risco de cor errada do gráfico ao alternar o tema. O `useEffect` pós-paint atual é o lugar seguro para essa leitura de DOM.

---

## ✅ Sinais positivos (já limpos)

- Nenhum **inline-style estático** (só o padrão sancionado de CSS-var para valores dinâmicos).
- Sem marcadores `TODO`/`FIXME`/`HACK`.
- Resíduo do campo `visibility` **removido de forma limpa** nas páginas de conteúdo.
- Ordenação do kanban de chamados **correta** (antigos→novos, `concluído` invertido) e coluna `pausado` presente.
- Todas as rotas em `index.tsx` **corretamente envoltas em `ProtectedRoute`** — nenhum gap de auth/rota encontrado.
- **Uma única lib de drag-and-drop** (`@dnd-kit`) após a remoção do Recrutamento.

---

## Sugestão de ordem de ataque

1. **🔴/🧩 severidade alta** — `TabContent` (tipos fora de sincronia), Enneagram sem `.catch` (spinner eterno) e `dominantTypeInfo` sem guarda (crash).
2. **🔒 segurança** — sanitizar HTML (`dangerouslySetInnerHTML`) e remover o header `x-user-id` como identidade.
3. **🔴 média com risco de crash/UX ruim** — drag sem null-check (`SortableModuleItem`/`AdminCourseEditor`), `TimePicker` sem validação, DELETE de anexo sem confirmação (`MeetingModal`).
4. **☠️ código morto / duplicação** — unificar `ArchiveModal`/`FileModal`, `COMPANIES_OPTIONS`, limpar dead code da tela de Empresa/mapa e imports não usados.
5. **⚛️/♿/🔁/⚡** — higiene contínua (deps de hooks, `any`, acessibilidade, anti-cache no servidor, `useMemo`).

> _Documento gerado a partir de uma varredura automatizada por área; cada item foi reportado com `arquivo:linha`. Revise antes de corrigir — alguns itens de severidade baixa são questões de estilo/convenção, não defeitos funcionais._
