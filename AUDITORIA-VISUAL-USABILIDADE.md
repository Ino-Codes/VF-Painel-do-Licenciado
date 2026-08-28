# Auditoria de Visual & Usabilidade — Painel da V-CORP

> Análise da interface percorrendo as telas ao vivo (logado como Administrador), avaliando visual, hierarquia, consistência, estados (vazio/carregando/erro), responsividade e acessibilidade.
> **Data:** 2026-08-27 · **Método:** navegação/leitura no navegador embutido (desktop + mobile), sem alterar dados — o ambiente aponta para produção.
> **Escopo (1ª passada):** Login, Home (desktop + mobile), hub Conteúdos, Central de Documentos, Catálogo de Cursos, Perfil, hub Admin, Grupos & Permissões, Gestão de Usuários, Central de Chamados (kanban), Dashboards/Eneagrama, tema escuro e menu mobile.
> **Escopo (2ª passada):** 404, FAQ, Vídeos, Mídias Sociais, Quem Somos, Meus Chamados, Atas de Reunião, Mural de Avisos completo, Estatísticas do Sistema, Logs de Atividade, Gestão de Cursos (admin).

## Convenções deste documento

- **Severidade:** `[alta]` (atrapalha a tarefa / confunde) · `[média]` (impacto real, sem urgência) · `[baixa]` (higiene visual / estético).
- Marque os itens conforme forem resolvidos.

---

## ✅ Sinais positivos (já bons)

- **Identidade de marca coesa e sóbria** — dourado/preto/branco + Montserrat aplicados com consistência em todas as telas.
- **Padrão de hubs por cards** (Conteúdos / Admin / Área Interna) uniforme e fácil de escanear (ícone + título + descrição curta).
- **Dark mode completo e bem resolvido** — inclusive o gráfico do Eneagrama adapta as cores ao alternar o tema, com contraste preservado nos dois modos.
- **Estados vazios caprichados** — ilustração + copy acolhedora ("Nenhum Curso Disponível…"), e no kanban "Nenhum ticket aqui".
- **Filtros padronizados** nas telas de conteúdo (pills de empresa + abas de categoria + busca).
- **Convenção de botões respeitada** — adicionar em verde, primário dourado, excluir vermelho, e ações protegidas esmaecidas (delete desabilitado em Administrador/V-Partner).
- **Responsivo funcional** — header vira hambúrguer, grids passam para 2/1 colunas, drawer mobile com a navegação completa.
- **Página 404 bem resolvida** — "404" em dourado, mensagem clara e botão "Voltar para o Início".
- **Telas de conteúdo bem estruturadas** — FAQ (acordeão), Vídeos (embeds do YouTube), Mídias Sociais (preview do criativo + copiar legenda/baixar imagens), Atas de Reunião (metadados de participantes/arquivos).
- **Estatísticas do Sistema** com cards de métricas claros — e ali o rótulo já usa **"V-Partners"** corretamente.

---

## ⚠️ Pontos de atenção

- [x] **[média]** **Terminologia "Licenciado" × "V-Partner" ainda convive na interface.** Na Gestão de Usuários a aba diz "V-Partners", mas a coluna **TIPO** mostrava "Licenciado". — ✅ Resolvido (2026-08-27): mapeamento de rótulo em `TabContent.tsx` (`role` "licenciado" → exibe "V-Partner"; valor no banco intacto). Verificado ao vivo. _Obs.: a raiz (usar `role` legado como "tipo") continua na `AUDITORIA-FRONTEND.md` (🔁 Consistência); aqui só o rótulo visível foi padronizado._
- [x] **[média]** **Kanban da Central de Chamados força scroll horizontal no desktop.** As 4 colunas de largura fixa (300px) e o board `min-width: max-content` cortavam a última coluna. — ✅ Resolvido (2026-08-27): colunas passaram a `flex: 1 1 0` (min 240px / max 420px) e o board a `width: 100%` — preenchem a largura sem scroll no desktop; abaixo de ~240px/coluna o container rola, e o mobile continua empilhando. Verificado ao vivo.
- [x] **[média]** **Fotos de equipe quebradas em "Quem Somos".** Cards da "Nossa Equipe" exibiam o texto alternativo sobre um card vazio. Investigando ao vivo, **o próprio avatar padrão (Cloudinary) estava morto** (`naturalWidth: 0`), então nem o fallback existente funcionava. — ✅ Resolvido (2026-08-27): `UserCard.tsx` passou a renderizar um **avatar de iniciais** (dourado) quando não há foto ou a `<img>` falha (`onError`), sem depender de URL externa. Verificado ao vivo.
- [x] **[baixa]** **Excesso de espaço vazio com poucos dados.** — ✅ Resolvido (2026-08-27): `.document-center` (as 10 telas de conteúdo/lista) ganhou `max-width: 1200px` centralizado — em monitores largos o conteúdo fica contido e equilibrado, em vez de esticar de ponta a ponta. Verificado ao vivo (a 1700px: largura 1200 com 250px de margem de cada lado). Não afeta kanban/dashboards/hubs.
- [x] **[baixa]** **Estados de "Carregando…" ocupam um card grande de altura fixa** (Dashboards e Cursos). — ✅ Resolvido (2026-08-27): novo componente [`Skeleton`](frontend/src/components/ui/Skeleton.tsx) (bloco com brilho animado + presets `CoursesGridSkeleton`, `ChartSkeleton`, `RankingSkeleton`; respeita `prefers-reduced-motion`). Aplicado no catálogo de Cursos (`CoursesPage`, antes `LoadingSpinner`), no Dashboard do Eneagrama (`EnneagramStats`) e no ranking de engajamento (`CourseEngagementDash`, antes texto "Carregando ranking..."). CSS em `2-components.css`; dimensões dinâmicas via `--sk-w`/`--sk-h`. Visual validado ao vivo.
- [x] **[baixa]** **Menu hambúrguer mobile.** — ✅ Resolvido (2026-08-27): adicionado `aria-label` ("Abrir/Fechar menu") + `aria-expanded`; `-webkit-tap-highlight-color: transparent` remove o realce azul e o foco de teclado passou a usar `outline` dourado (`:focus-visible`). Verificado ao vivo.
- [x] **[baixa]** **"Desconectar" no Perfil.** — ✅ Resolvido (2026-08-27): a pedido, virou um **botão de ícone `FiLogOut`** com a classe `form-icon-delete` (consistente com as demais ações de ícone); classe `botao-logout` e seu CSS órfão removidos. Verificado ao vivo.
- [x] **[baixa]** **Três camadas de filtro empilhadas nas telas de conteúdo** (pills de empresa + abas de categoria + busca). — ✅ Resolvido (2026-08-27): margens da zona de filtros compactadas com escopo em `.document-center` (`.company-filter` 20→12px; `.tabs`/`.search-bar` 20→14px), aproximando os controles e subindo o conteúdo. Optei por **manter as pills** (filtro colorido de 1 clique) em vez do dropdown — evita perda de usabilidade; a troca por dropdown fica como opção futura, se desejado.
- [x] **[baixa]** **Última linha dos grids de hub tem card solitário** (7 itens em 3 colunas). — ✅ Resolvido (2026-08-27): `.gestao-modules-grid` passou de `grid` para `flex` com `wrap` + `justify-content: center`; cards com `flex: 1 1 320px` e `max-width: 380px`. Linhas cheias preenchem a largura; a última linha incompleta fica centralizada. Verificado ao vivo (card "Usuários" agora centralizado).
- [x] **[baixa]** **Estados vazios inconsistentes entre admin e consumo.** — ✅ Resolvido parcialmente (2026-08-27): a **Gestão de Cursos (admin)** passou a usar o `EmptyState` ilustrado (ícone `cursos` + mensagem de ação). Verificado ao vivo. _Outras listas admin (ex.: Grupos) podem receber o mesmo tratamento numa varredura futura._
- [x] **[baixa]** **Coluna "Ação" dos Logs mistura rótulos.** — ✅ Resolvido (2026-08-27): mapa `ACTION_LABELS` em `ActivityLogs.tsx` humaniza os enums (`DELETE_FILE`→"Documento Excluído", `*_ARCHIVE`→"Arquivo …", `*_SOCIAL_POST`, `WIDGET_*`); rótulos já legíveis passam intactos. Verificado ao vivo.
- [x] **[baixa]** **Mural de Avisos completo abria todos os avisos expandidos.** — ✅ Resolvido (2026-08-27): subcomponente `NoticeMessage` colapsa avisos altos (> 260px) com fade (`mask-image`) e botão "Ler mais"/"Ler menos"; o botão só aparece quando há conteúdo cortado (mede `scrollHeight`). _Build ok; verificação visual pendente de novo login (o pane descartou a sessão)._
- [x] **[baixa]** **Rota do FAQ fora do padrão.** — ✅ Resolvido (2026-08-27): rota movida para `/content/faq`; a antiga `/faq` agora faz `Navigate` (redirect) para a nova; referências no hub (`ContentGestao`) e no acesso rápido da `Home` atualizadas. _Build ok._
- [x] **[baixa]** **"Meus Chamados" com cabeçalho solto.** — ✅ Resolvido (2026-08-27): o cabeçalho deixou de usar `.page-header` (flex que jogava a instrução para a direita) e passou ao padrão título + `content-subtitle` (instrução como subtítulo muted abaixo do título). Adicionada a regra CSS de `.content-subtitle` (antes um hook sem estilo, também usado em AdminCourses/MeetingRecords). _Build ok._

---

## Não testável nesta passada

- **Editor de Curso (admin)** — não há nenhum curso cadastrado no banco (Gestão de Cursos e o catálogo estão vazios), então o editor não pôde ser aberto sem criar dados em produção.
- **Fluxo de 2FA / recuperação de senha** — exige deslogar; fica para uma passada dedicada.

---

> _Levantamento visual — cada ponto é uma sugestão de melhoria de UX/UI, não um defeito funcional. Complementa a `AUDITORIA-FRONTEND.md` (código)._
