const express = require("express");
const bcrypt = require("bcryptjs");
const csv = require("csv-parser");
const { Readable } = require("stream");
const router = express.Router();
const { ROLE_TO_SLUG, SLUG_TO_ROLE } = require("../permissions.js");
const {
  validarSenha,
  gravarSenha,
  emitirSessao,
  excedeuLimite,
} = require("../authSession.js");
const { senhaInutilizavel, enviarConvite } = require("../linkDeSenha.js");

// ── Convite de 1º acesso ─────────────────────────────────────────────────
// Reenvio individual: até 3 por conta a cada 15 min (evita encher a caixa
// de alguém por clique repetido). O reenvio em massa pula quem recebeu um
// convite na última hora. O Resend aceita ~2 envios/s: o envio em lote
// espera um pouco entre um e-mail e outro.
const CONVITE_MAX_REENVIOS = 3;
const CONVITE_JANELA_MIN = 15;
const CONVITE_MASSA_INTERVALO_MIN = 60;
const CONVITE_PAUSA_ENTRE_ENVIOS_MS = 600;
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

// Só o próprio usuário mexe na própria foto/senha pelas rotas /:id/...
// (o admin edita os outros pelas rotas /admin).
const ehOProprio = (req) => Number(req.params.id) === Number(req.user.id);

// Resolve group_id/role a partir do corpo da requisição, espelhando um no
// outro para compatibilidade (role continua preenchido; group_id é a fonte).
async function resolveGroupAndRole(pool, body) {
  let effectiveRole = body.role || "licenciado";
  let effectiveGroupId = body.group_id || null;
  if (body.group_id) {
    const g = await pool.query(
      "SELECT slug, is_system FROM user_groups WHERE id = $1",
      [body.group_id],
    );
    if (g.rows.length === 0) return { error: "Grupo inválido." };
    const { slug, is_system } = g.rows[0];
    effectiveRole = is_system ? SLUG_TO_ROLE[slug] || slug : slug;
  } else if (effectiveRole) {
    const slug = ROLE_TO_SLUG[effectiveRole];
    if (slug) {
      const g = await pool.query(
        "SELECT id FROM user_groups WHERE slug = $1",
        [slug],
      );
      effectiveGroupId = g.rows[0] ? g.rows[0].id : null;
    }
  }
  return { effectiveRole, effectiveGroupId };
}

// Resolve o setor a partir do id (tabela setores) e devolve id + nome. Espelha
// o nome em users.setor (texto) para manter compatibilidade com as telas que
// ainda leem esse campo. Aceita texto legado quando não houver id.
async function resolveSetor(pool, body) {
  const rawId = body.setor_id;
  const setorId = rawId ? Number(rawId) : null;
  if (setorId) {
    const r = await pool.query("SELECT nome FROM setores WHERE id = $1", [
      setorId,
    ]);
    if (r.rows.length === 0) {
      return { setorId: null, setorNome: null, error: "Setor inválido." };
    }
    return { setorId, setorNome: r.rows[0].nome };
  }
  const texto = (body.setor || "").trim();
  return { setorId: null, setorNome: texto || null };
}

// Função para capitalizar nomes
const capitalizeNameWithPrepositions = (name) => {
  if (!name || typeof name !== "string") return name;

  const prepositions = ["de", "di", "do", "da", "dos", "das", "e", "d'"];

  return name
    .toLowerCase()
    .split(" ")
    .map((word, index) => {
      // Primeira palavra sempre capitalizada
      if (index === 0) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      // Preposições sempre em minúsculas
      if (prepositions.includes(word)) {
        return word;
      }
      // Outras palavras com primeira letra maiúscula
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
};

module.exports = function (pool, cloudinary, upload, logActivity, resend) {
  const { isLoggedIn, checkPermission } = require("../middleware/auth.js");

  // Envia o convite e registra. Não lança: devolve true/false para quem
  // chamou poder avisar o admin (a conta continua criada; dá para reenviar).
  const convidar = async (user, req, { trocarSenha, detalhe }) => {
    try {
      await enviarConvite(pool, resend, user, { trocarSenha });
      logActivity(
        user.id,
        req.user.email,
        "Convite Enviado",
        detalhe || `Convite de 1º acesso enviado para ${user.email}.`,
        req.ipAddress,
      );
      return true;
    } catch (err) {
      console.error(`Falha ao enviar o convite para ${user.email}:`, err.resend || err);
      logActivity(
        user.id,
        req.user.email,
        "Falha no Convite",
        `Não foi possível enviar o convite para ${user.email}.`,
        req.ipAddress,
      );
      return false;
    }
  };

  // Filtro interno/V-Partner (mesma regra da listagem).
  const filtroInterno = (internal) =>
    internal === "true" || internal === true
      ? `AND EXISTS (SELECT 1 FROM group_permissions gp WHERE gp.group_id = users.group_id AND gp.permission_key = 'internal_access')`
      : internal === "false" || internal === false
        ? `AND NOT EXISTS (SELECT 1 FROM group_permissions gp WHERE gp.group_id = users.group_id AND gp.permission_key = 'internal_access')`
        : "";

  // --- Rotas de Admin (Listar, Criar, Editar, Excluir) ---

  // LISTAR USUÁRIOS (Admin)
  router.get(
    "/admin",
    isLoggedIn,
    checkPermission("users.view"),
    async (req, res) => {
      const {
        search,
        page = 1,
        limit = 10,
        roles,
        sortBy,
        sortOrder,
      } = req.query;
      try {
        const offset = (page - 1) * limit;
        let whereClauses = [];
        const params = [];

        if (roles) {
          const roleList = roles.split(",");
          params.push(roleList);
          whereClauses.push(`role = ANY($${params.length})`);
        }

        // Filtro por acesso interno (RBAC): distingue colaboradores de licenciados
        // pelo grupo (permissão internal_access), independente do role legado.
        if (req.query.internal === "true") {
          whereClauses.push(
            `EXISTS (SELECT 1 FROM group_permissions gp WHERE gp.group_id = users.group_id AND gp.permission_key = 'internal_access')`,
          );
        } else if (req.query.internal === "false") {
          whereClauses.push(
            `NOT EXISTS (SELECT 1 FROM group_permissions gp WHERE gp.group_id = users.group_id AND gp.permission_key = 'internal_access')`,
          );
        }

        if (search) {
          params.push(`%${search}%`);
          whereClauses.push(
            `(nome ILIKE $${params.length} OR email ILIKE $${params.length} OR nickname ILIKE $${params.length})`,
          );
        }

        const whereString =
          whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

        const countSql = `SELECT COUNT(*) FROM users ${whereString}`;

        // "role" é legado e inconsistente entre os usuários; a ordenação da
        // coluna Tipo usa o nome do grupo, que é o dado vigente.
        const allowedSortBy = [
          "nome",
          "email",
          "role",
          "group_name",
          "unidade",
        ];
        let orderByClause = "ORDER BY nome ASC"; // Padrão

        if (
          allowedSortBy.includes(sortBy) &&
          ["ASC", "DESC"].includes(sortOrder?.toUpperCase())
        ) {
          orderByClause = `ORDER BY "${sortBy}" ${sortOrder.toUpperCase()}`;
        }

        // Subconsulta em vez de JOIN: as cláusulas do WHERE (e o COUNT) usam
        // `users` sem apelido, e trocar isso mexeria em coisas que funcionam.
        const usersSql = `SELECT id, nome, nickname, email, role, group_id,
          (SELECT g.name FROM user_groups g WHERE g.id = users.group_id) AS group_name,
          avatar_url, corporate_photo_url, birth_date, cargo, setor, setor_id, unidade, unidade_id, telefone, data_admissao,
          must_change_password AS convite_pendente FROM users ${whereString} ${orderByClause} LIMIT $${
          params.length + 1
        } OFFSET $${params.length + 2}`;

        const [countResult, usersResult] = await Promise.all([
          pool.query(countSql, params),
          pool.query(usersSql, [...params, limit, offset]),
        ]);

        const totalCount = parseInt(countResult.rows[0].count, 10);
        res.json({
          users: usersResult.rows,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        });
      } catch (err) {
        console.error("Erro ao buscar usuários:", err);
        res.status(500).json({ error: "Erro ao buscar usuários" });
      }
    },
  );

  // CRIAR USUÁRIO
  router.post(
    "/admin",
    isLoggedIn,
    checkPermission("users.manage"),
    async (req, res) => {
      const {
        nome: nomeOriginal, // CORREÇÃO AQUI
        email: emailOriginal, // CORREÇÃO AQUI
        // `password` não é mais aceito: o usuário cria a senha pelo convite.
        birth_date,
        cargo,
        setor,
        setor_id,
        telefone,
        data_admissao,
        nickname, // Opcional na criação
      } = req.body;

      const nome = capitalizeNameWithPrepositions(nomeOriginal);
      const email = emailOriginal ? emailOriginal.toLowerCase().trim() : "";

      // Resolve grupo e espelha o role (compat).
      const resolved = await resolveGroupAndRole(pool, req.body);
      if (resolved.error) {
        return res.status(400).json({ error: resolved.error });
      }
      const role = resolved.effectiveRole;
      const groupId = resolved.effectiveGroupId;

      const client = await pool.connect();

      try {
        // Setor normalizado: resolve pelo id (tabela setores) e espelha o nome
        // no campo texto users.setor (mantido por compatibilidade com telas que
        // ainda leem o texto). Aceita texto legado se vier sem id.
        const {
          setorId,
          setorNome,
          error: setorError,
        } = await resolveSetor(pool, { setor_id, setor });
        if (setorError) {
          return res.status(400).json({ error: setorError });
        }

        if (role !== "licenciado" && !data_admissao) {
          return res.status(400).json({
            error: "A Data de Admissão é obrigatória para colaboradores.",
          });
        }

        if (!nome || !email) {
          return res.status(400).json({ error: "Informe nome e e-mail." });
        }

        // Senha aleatória que ninguém conhece: a conta só passa a ter senha
        // quando o usuário a cria pelo link do convite.
        const hash = await senhaInutilizavel();

        await client.query("BEGIN");

        const userResult = await client.query(
          "INSERT INTO users (nome, email, password, role, group_id, birth_date, cargo, setor, setor_id, telefone, data_admissao, nickname) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id",
          [
            nome,
            email,
            hash,
            role,
            groupId,
            birth_date || null,
            cargo || null,
            setorNome,
            setorId,
            telefone || null,
            role === "licenciado" ? null : data_admissao,
            nickname || null,
          ],
        );
        const newUserId = userResult.rows[0].id;

        if (role !== "licenciado" && birth_date) {
          const [_, month, day] = birth_date.split("-");
          const eventTitle = `Aniversário de ${nome}`;

          for (let i = 0; i < 10; i++) {
            const eventYear = new Date().getFullYear() + i;
            const eventStartDate = new Date(
              `${eventYear}-${month}-${day}T11:00:00`,
            );
            await client.query(
              `INSERT INTO events (title, description, start_date, end_date, category, color, created_by_user_id) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                eventTitle,
                "Dia de comemorar!",
                eventStartDate,
                eventStartDate,
                "Aniversário",
                "#81e18c",
                newUserId,
              ],
            );
          }
        }

        await client.query("COMMIT");

        logActivity(
          newUserId,
          req.user.email, // CORREÇÃO AQUI (estava re.user.email)
          "Usuário Criado",
          `Usuário ${email} (${role}) foi criado.`,
          req.ipAddress,
        );

        // Depois do COMMIT: se o e-mail falhar, a conta fica criada e o admin
        // reenvia o convite pela lista.
        const conviteEnviado = await convidar(
          { id: newUserId, nome, email },
          req,
          { trocarSenha: false },
        );

        res.status(201).json({
          success: true,
          id: newUserId,
          convite_enviado: conviteEnviado,
        });
      } catch (err) {
        await client.query("ROLLBACK");
        if (err.code === "23505") {
          return res
            .status(409)
            .json({ error: "Este e-mail já está em uso por outro usuário." });
        }
        console.error("Erro ao criar usuário:", err);
        res.status(500).json({ error: "Erro ao criar usuário" });
      } finally {
        client.release();
      }
    },
  );

  // EDITAR USUÁRIO (Admin ou Próprio Usuário com Restrições)
  router.put("/admin/:id", isLoggedIn, async (req, res) => {
    const { id } = req.params;
    const isSelfUpdate = req.user.id == id;
    const hasPrivilegedRole =
      Array.isArray(req.user.permissions) &&
      req.user.permissions.includes("users.manage");

    if (!hasPrivilegedRole && !isSelfUpdate) {
      return res.status(403).json({
        error:
          "Acesso negado. Você não tem permissão para editar este usuário.",
      });
    }

    const {
      nome: nomeOriginal,
      email: emailOriginal,
      role,
      birth_date,
      cargo,
      setor,
      setor_id,
      telefone,
      data_admissao,
      nickname,
    } = req.body;

    const client = await pool.connect();

    try {
      const currentUserResult = await client.query(
        "SELECT * FROM users WHERE id = $1",
        [id],
      );

      if (currentUserResult.rowCount === 0) {
        return res.status(404).json({ error: "Usuário não encontrado." });
      }
      const currentUser = currentUserResult.rows[0];

      let finalNome = currentUser.nome;
      let finalRole = currentUser.role;
      let finalGroupId = currentUser.group_id;
      let finalEmail = currentUser.email;
      let finalCargo = currentUser.cargo;
      let finalSetor = currentUser.setor;
      let finalSetorId = currentUser.setor_id;
      // Unidade descontinuada: preserva o que já existe no banco, sem editar.
      const finalUnidade = currentUser.unidade;
      const finalUnidadeId = currentUser.unidade_id;
      let finalDataAdmissao = currentUser.data_admissao;
      let finalBirthDate = currentUser.birth_date;

      if (hasPrivilegedRole) {
        finalNome =
          capitalizeNameWithPrepositions(nomeOriginal) || currentUser.nome;
        finalRole = role || currentUser.role;
        finalEmail = emailOriginal
          ? emailOriginal.toLowerCase().trim()
          : currentUser.email;
        finalCargo = cargo;
        // Setor normalizado (id + espelho de texto).
        const {
          setorId,
          setorNome,
          error: setorError,
        } = await resolveSetor(pool, { setor_id, setor });
        if (setorError) {
          client.release();
          return res.status(400).json({ error: setorError });
        }
        finalSetor = setorNome;
        finalSetorId = setorId;
        finalDataAdmissao = data_admissao;
        finalBirthDate = birth_date;

        // Grupo (RBAC): resolve e espelha o role quando informado.
        if (req.body.group_id || role) {
          const resolved = await resolveGroupAndRole(pool, req.body);
          if (resolved.error) {
            client.release();
            return res.status(400).json({ error: resolved.error });
          }
          finalRole = resolved.effectiveRole;
          finalGroupId = resolved.effectiveGroupId;
        }
      }

      const finalNickname = nickname ? nickname.trim() : null;
      const finalTelefone = telefone;

      await client.query("BEGIN");

      await client.query(
        `UPDATE users SET
          nome = $1,
          email = $2,
          role = $3,
          birth_date = $4,
          cargo = $5,
          setor = $6,
          setor_id = $7,
          unidade = $8,
          unidade_id = $9,
          telefone = $10,
          data_admissao = $11,
          nickname = $12,
          group_id = $13
        WHERE id = $14`,
        [
          finalNome,
          finalEmail,
          finalRole,
          finalBirthDate,
          finalCargo,
          finalSetor,
          finalSetorId || null,
          finalUnidade,
          finalUnidadeId || null,
          finalTelefone,
          finalRole === "licenciado" ? null : finalDataAdmissao,
          finalNickname,
          finalGroupId,
          id,
        ],
      );

      const updatedUserResult = await client.query(
        `SELECT id, nome, nickname, email, role, group_id,
           (SELECT g.name FROM user_groups g WHERE g.id = users.group_id) AS group_name,
           avatar_url, corporate_photo_url, birth_date, cargo, setor, setor_id, unidade, unidade_id AS unit_id, telefone, data_admissao,
           must_change_password AS convite_pendente
         FROM users WHERE id = $1`,
        [id],
      );

      if (hasPrivilegedRole && finalBirthDate !== currentUser.birth_date) {
        await client.query(
          "DELETE FROM events WHERE created_by_user_id = $1 AND category = 'Aniversário'",
          [id],
        );

        if (finalRole !== "licenciado" && finalBirthDate) {
          const birthDate = new Date(finalBirthDate);
          const eventTitle = `Aniversário de ${finalNome}`;

          for (let i = 0; i < 10; i++) {
            const eventYear = new Date().getFullYear() + i;
            const eventStartDate = new Date(
              Date.UTC(
                eventYear,
                birthDate.getUTCMonth(),
                birthDate.getUTCDate(),
                8,
              ),
            );

            await client.query(
              `INSERT INTO events (title, description, start_date, end_date, category, color, created_by_user_id) 
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                eventTitle,
                "Dia de comemorar!",
                eventStartDate,
                eventStartDate,
                "Aniversário",
                "#81e18c",
                id,
              ],
            );
          }
        }
      }

      await client.query("COMMIT");

      logActivity(
        id,
        req.user.email,
        "Usuário Editado",
        `Dados do usuário ${finalEmail} foram atualizados.`,
        req.ipAddress,
      );

      const updatedUser = updatedUserResult.rows[0];
      delete updatedUser.password;

      let responsePayload = { success: true, user: updatedUser };

      // Editou a si mesmo → token novo com os dados atuais. Antes o grupo
      // não vinha no SELECT e o token novo saía sem group_id.
      if (req.user.id == id) {
        const sessao = await emitirSessao(pool, id);
        if (sessao) responsePayload.token = sessao.token;
      }

      res.json(responsePayload);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Erro ao atualizar usuário:", err);
      if (err.code === "23505" && err.constraint === "users_email_key") {
        return res
          .status(409)
          .json({ error: "Este e-mail já está em uso por outro usuário." });
      }
      res.status(500).json({ error: "Erro no servidor" });
    } finally {
      client.release();
    }
  });

  // DELETAR USUÁRIO
  router.delete(
    "/admin/:id",
    isLoggedIn,
    checkPermission("users.manage"),
    async (req, res) => {
      const { id } = req.params;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const userResult = await client.query(
          "SELECT email FROM users WHERE id = $1",
          [id],
        );
        if (userResult.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: "Usuário não encontrado." });
        }
        const userEmail = userResult.rows[0].email;

        // Equipamentos do Inventário de TI com o colaborador: a exclusão é
        // bloqueada até que sejam devolvidos ou transferidos, para nenhum
        // ativo ficar "com ninguém".
        const ativos = await client.query(
          `SELECT COALESCE(a.patrimonio, 'sem patrimônio') AS patrimonio,
                  CONCAT_WS(' ', a.marca, a.modelo) AS modelo
             FROM it_assets a
            WHERE a.user_id = $1
            ORDER BY a.patrimonio NULLS LAST`,
          [id],
        );
        if (ativos.rowCount > 0) {
          await client.query("ROLLBACK");
          const lista = ativos.rows
            .map((a) => `${a.patrimonio} ${a.modelo}`.trim())
            .join(", ");
          return res.status(409).json({
            error: `Este colaborador ainda tem equipamentos do Inventário de TI. Devolva ou transfira antes de excluir: ${lista}.`,
          });
        }

        // Arquivos dos certificados externos: as linhas saem em cascata com o
        // usuário, mas os arquivos no Cloudinary/Azure são apagados à parte,
        // depois do COMMIT.
        const arquivosCertificados = await client.query(
          `SELECT f.storage, f.url, f.public_id, f.blob_name
             FROM user_certificate_files f
             JOIN user_certificates c ON c.id = f.certificate_id
            WHERE c.user_id = $1`,
          [id],
        );

        await client.query(
          "UPDATE activity_logs SET user_id = NULL WHERE user_id = $1",
          [id],
        );
        await client.query("DELETE FROM users WHERE id = $1", [id]);
        logActivity(
          null,
          userEmail,
          "Usuário Excluído",
          `Usuário ${userEmail} (ID: ${id}) foi excluído.`,
          req.ipAddress,
        );
        await client.query("COMMIT");
        const documentos = require("../storage/documentos.js")(cloudinary);
        await Promise.allSettled(
          arquivosCertificados.rows.map((a) =>
            documentos.excluir({ ...a, filename: a.url }),
          ),
        );
        res.json({ success: true, message: "Usuário excluído com sucesso." });
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("Erro ao excluir usuário:", err);
        res
          .status(500)
          .json({ error: "Erro no servidor ao tentar excluir usuário." });
      } finally {
        client.release();
      }
    },
  );

  // --- Rotas Específicas (Bulk Upload, Gestores, Fotos Corporativas) ---

  router.post(
    "/admin/bulk-upload",
    isLoggedIn,
    checkPermission("users.manage"),
    upload.single("file"),
    async (req, res) => {
      if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo CSV enviado." });
      }
      const results = [];
      const errors = [];
      let successCount = 0;
      const stream = Readable.from(req.file.buffer.toString());
      stream
        .pipe(csv({ mapHeaders: ({ header }) => header.trim() }))
        .on("data", (data) => results.push(data))
        .on("end", async () => {
          let convitesFalharam = 0;
          for (const user of results) {
            // A coluna `password` (formato antigo da planilha) é aceita e
            // ignorada: a senha é criada pelo usuário no link do convite.
            const { nome, email, role } = user;
            if (!nome || !email || !role) {
              errors.push(
                `Dados incompletos para o e-mail: ${email || "desconhecido"}.`,
              );
              continue;
            }
            try {
              // CORREÇÃO AQUI
              const emailNormalizado = email.toLowerCase().trim();
              const nomeCapitalizado = capitalizeNameWithPrepositions(nome);

              const existingUser = await pool.query(
                "SELECT id FROM users WHERE email = $1",
                [emailNormalizado],
              );
              if (existingUser.rowCount > 0) {
                errors.push(`E-mail já cadastrado: ${email}.`);
                continue;
              }
              const hash = await senhaInutilizavel();
              const novo = await pool.query(
                "INSERT INTO users (nome, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id",
                [nomeCapitalizado, emailNormalizado, hash, role],
              );
              const novoId = novo.rows[0].id;
              logActivity(
                novoId,
                req.user.email,
                "Usuários Criados em Massa",
                `Usuário ${emailNormalizado} criado via importação em massa.`,
                req.ipAddress,
              );
              successCount++;

              if (successCount > 1) await pausa(CONVITE_PAUSA_ENTRE_ENVIOS_MS);
              const ok = await convidar(
                { id: novoId, nome: nomeCapitalizado, email: emailNormalizado },
                req,
                { trocarSenha: false },
              );
              if (!ok) {
                convitesFalharam++;
                errors.push(
                  `Usuário ${emailNormalizado} criado, mas o convite não foi enviado. Use "Reenviar convite".`,
                );
              }
            } catch (dbError) {
              console.error(`Erro ao inserir usuário ${email}:`, dbError);
              errors.push(`Erro de banco de dados para o e-mail: ${email}.`);
            }
          }
          res.json({
            message: "Processamento do CSV finalizado.",
            successCount,
            convitesEnviados: successCount - convitesFalharam,
            errorCount: errors.length,
            errors,
          });
        });
    },
  );

  // REENVIAR CONVITE (uma conta). Só para quem ainda não criou a senha
  // (must_change_password). A senha atual vira aleatória e o link anterior
  // deixa de valer: uma senha inicial antiga, previsível ou compartilhada,
  // para de funcionar aqui.
  router.post(
    "/admin/:id/convite",
    isLoggedIn,
    checkPermission("users.manage"),
    async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ error: "Usuário inválido." });
      }
      try {
        const r = await pool.query(
          "SELECT id, nome, email, must_change_password FROM users WHERE id = $1",
          [id],
        );
        const alvo = r.rows[0];
        if (!alvo) return res.status(404).json({ error: "Usuário não encontrado." });
        if (!alvo.must_change_password) {
          return res.status(409).json({
            error: "Este usuário já criou a senha. Para recuperar o acesso, ele pode usar “Esqueceu a senha?” no login.",
          });
        }
        if (
          await excedeuLimite(pool, {
            acao: "Convite Enviado",
            minutos: CONVITE_JANELA_MIN,
            maximo: CONVITE_MAX_REENVIOS,
            userId: id,
          })
        ) {
          return res.status(429).json({
            error: "Vários convites já foram enviados para este usuário agora há pouco. Aguarde 15 minutos.",
          });
        }
        const ok = await convidar(alvo, req, {
          trocarSenha: true,
          detalhe: `Convite de 1º acesso reenviado para ${alvo.email}.`,
        });
        if (!ok) {
          return res.status(502).json({
            error: "Não foi possível enviar o e-mail do convite. Tente novamente em instantes.",
          });
        }
        res.json({ success: true, message: `Convite reenviado para ${alvo.email}.` });
      } catch (err) {
        console.error("Erro ao reenviar convite:", err);
        res.status(500).json({ error: "Erro no servidor" });
      }
    },
  );

  // Contas com convite pendente (nunca criaram a senha). `internal` segue o
  // filtro da listagem: "false" = V-Partners, "true" = colaboradores.
  const sqlPendentes = (internal) => `
    SELECT id, nome, email FROM users
     WHERE must_change_password = TRUE ${filtroInterno(internal)}
       AND NOT EXISTS (
         SELECT 1 FROM activity_logs a
          WHERE a.user_id = users.id AND a.action = 'Convite Enviado'
            AND a.created_at > now() - make_interval(mins => $1))
     ORDER BY nome`;

  router.get(
    "/admin/convites/pendentes",
    isLoggedIn,
    checkPermission("users.manage"),
    async (req, res) => {
      try {
        const [pendentes, recentes] = await Promise.all([
          pool.query(sqlPendentes(req.query.internal), [CONVITE_MASSA_INTERVALO_MIN]),
          pool.query(
            `SELECT COUNT(*)::int AS n FROM users
              WHERE must_change_password = TRUE ${filtroInterno(req.query.internal)}`,
          ),
        ]);
        res.json({
          // Quem vai receber no reenvio em massa (sem convite na última hora).
          total: pendentes.rowCount,
          // Todos com convite pendente, inclusive os convidados há pouco.
          totalPendentes: recentes.rows[0].n,
        });
      } catch (err) {
        console.error("Erro ao contar convites pendentes:", err);
        res.status(500).json({ error: "Erro no servidor" });
      }
    },
  );

  // REENVIAR CONVITE EM MASSA: todas as contas que ainda não criaram a senha,
  // exceto as convidadas na última hora (um clique duplo não manda 2 e-mails).
  router.post(
    "/admin/convites/reenviar-pendentes",
    isLoggedIn,
    checkPermission("users.manage"),
    async (req, res) => {
      const internal = req.body?.internal;
      try {
        const alvos = (
          await pool.query(sqlPendentes(internal), [CONVITE_MASSA_INTERVALO_MIN])
        ).rows;
        let enviados = 0;
        const falhas = [];
        for (const [i, alvo] of alvos.entries()) {
          if (i > 0) await pausa(CONVITE_PAUSA_ENTRE_ENVIOS_MS);
          const ok = await convidar(alvo, req, {
            trocarSenha: true,
            detalhe: `Convite de 1º acesso reenviado em massa para ${alvo.email}.`,
          });
          if (ok) enviados++;
          else falhas.push(alvo.email);
        }
        logActivity(
          req.user.id,
          req.user.email,
          "Convites Reenviados em Massa",
          `${enviados} convite(s) reenviado(s)${falhas.length ? `, ${falhas.length} falha(s)` : ""}.`,
          req.ipAddress,
        );
        res.json({ success: true, total: alvos.length, enviados, falhas });
      } catch (err) {
        console.error("Erro ao reenviar convites em massa:", err);
        res.status(500).json({ error: "Erro no servidor" });
      }
    },
  );

  router.put(
    "/admin/:id/corporate-photo",
    isLoggedIn,
    checkPermission("users.manage"),
    upload.single("corporate_photo"),
    async (req, res) => {
      const { id } = req.params;
      if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado." });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const userResult = await client.query(
          "SELECT corporate_photo_url FROM users WHERE id = $1",
          [id],
        );
        const oldPhotoUrl = userResult.rows[0]?.corporate_photo_url;

        // Se já existir uma foto, apaga a antiga do Cloudinary
        if (oldPhotoUrl) {
          const publicId = oldPhotoUrl.split("/").pop().split(".")[0];
          await cloudinary.uploader.destroy(publicId, {
            resource_type: "image",
          });
        }

        // Faz o upload da nova foto para o Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
          cloudinary.uploader
            .upload_stream({ resource_type: "image" }, (error, result) => {
              if (error) reject(error);
              resolve(result);
            })
            .end(req.file.buffer);
        });

        const newPhotoUrl = uploadResult.secure_url;

        // Atualiza o URL no banco de dados
        const updateResult = await client.query(
          "UPDATE users SET corporate_photo_url = $1 WHERE id = $2 RETURNING corporate_photo_url",
          [newPhotoUrl, id],
        );

        await client.query("COMMIT");
        res.json({
          success: true,
          corporatePhotoUrl: updateResult.rows[0].corporate_photo_url,
        });
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("Erro no upload de foto corporativa:", err);
        res.status(500).json({ error: "Erro no servidor durante o upload." });
      } finally {
        client.release();
      }
    },
  );

  router.delete(
    "/admin/:id/corporate-photo",
    isLoggedIn,
    checkPermission("users.manage"),
    async (req, res) => {
      const { id } = req.params;
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        const userResult = await client.query(
          "SELECT corporate_photo_url FROM users WHERE id = $1",
          [id],
        );
        const oldPhotoUrl = userResult.rows[0]?.corporate_photo_url;

        if (oldPhotoUrl) {
          const publicId = oldPhotoUrl.split("/").pop().split(".")[0];
          await cloudinary.uploader.destroy(publicId, {
            resource_type: "image",
          });
        }

        const updateResult = await client.query(
          "UPDATE users SET corporate_photo_url = NULL WHERE id = $1 RETURNING *",
          [id],
        );

        await client.query("COMMIT");

        const updatedUser = updateResult.rows[0];
        delete updatedUser.password;

        res.json({ success: true, user: updatedUser });
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("Erro ao remover foto corporativa:", err);
        res.status(500).json({ error: "Erro no servidor ao remover a foto." });
      } finally {
        client.release();
      }
    },
  );

  // --- Rotas Públicas ou de Utilizador Logado ---

  router.get("/internal", isLoggedIn, async (req, res) => {
    try {
      // "Internos" = usuários cujo grupo tem a permissão internal_access.
      const internalUsersSql = `
      SELECT u.id, u.nome, u.nickname, u.email, u.role, u.group_id, u.avatar_url, u.corporate_photo_url, u.cargo, u.setor, u.unidade, u.unidade_id, u.telefone, u.birth_date, u.data_admissao,
        (SELECT COUNT(*)::int FROM praises p WHERE p.recipient_id = u.id AND p.published_at IS NOT NULL) AS praise_count
      FROM users u
      WHERE EXISTS (
        SELECT 1 FROM group_permissions gp
        WHERE gp.group_id = u.group_id AND gp.permission_key = 'internal_access'
      )
      ORDER BY u.nome ASC
    `;

      const result = await pool.query(internalUsersSql);
      res.json(result.rows);
    } catch (err) {
      console.error("Erro ao buscar usuários internos:", err);
      res.status(500).json({ error: "Erro ao buscar usuários internos" });
    }
  });

  // Troca obrigatória do 1º acesso. Não pede a senha atual (o usuário acabou
  // de entrar com ela), por isso só vale enquanto a troca está pendente —
  // senão qualquer sessão aberta trocaria a senha sem conhecê-la.
  router.put("/force-change-password", isLoggedIn, async (req, res) => {
    const { id: userId } = req.user;
    const { password } = req.body || {};

    try {
      const atual = await pool.query(
        "SELECT email, password, must_change_password FROM users WHERE id = $1",
        [userId],
      );
      const conta = atual.rows[0];
      if (!conta) return res.status(404).json({ error: "Usuário não encontrado." });
      if (!conta.must_change_password) {
        return res.status(409).json({
          error: "Sua senha já foi definida. Para trocá-la, use o seu perfil.",
        });
      }

      const erroSenha = validarSenha(password, conta.email);
      if (erroSenha) return res.status(400).json({ error: erroSenha });
      if (await bcrypt.compare(password, conta.password)) {
        return res
          .status(400)
          .json({ error: "A nova senha precisa ser diferente da senha inicial." });
      }

      const newHash = await bcrypt.hash(password, 10);
      await gravarSenha(pool, userId, newHash);

      logActivity(
        userId,
        req.user.email,
        "Alteração de Senha Forçada",
        "Senha alterada no primeiro acesso.",
        req.ipAddress,
      );
      // Sessão nova: o usuário segue direto, sem fazer login (e 2FA) de novo.
      const sessao = await emitirSessao(pool, userId);
      res.json({
        success: true,
        message: "Senha alterada com sucesso!",
        user: sessao.user,
        token: sessao.token,
      });
    } catch (err) {
      console.error("Erro ao forçar mudança de senha:", err);
      res.status(500).json({ error: "Erro no servidor" });
    }
  });

  router.post(
    "/:id/avatar",
    isLoggedIn,
    upload.single("avatar"),
    async (req, res) => {
      const { id } = req.params;
      if (!ehOProprio(req)) {
        return res
          .status(403)
          .json({ error: "Você só pode alterar a sua própria foto." });
      }
      if (!req.file)
        return res.status(400).json({ error: "Nenhum arquivo enviado." });
      try {
        const userResult = await pool.query(
          "SELECT avatar_url FROM users WHERE id = $1",
          [id],
        );
        const oldAvatarUrl = userResult.rows[0]?.avatar_url;
        if (oldAvatarUrl) {
          const publicId = oldAvatarUrl.split("/").pop().split(".")[0];
          await cloudinary.uploader.destroy(publicId);
        }
        const uploadResult = await new Promise((resolve, reject) => {
          cloudinary.uploader
            .upload_stream({ resource_type: "image" }, (error, result) => {
              if (error) reject(error);
              resolve(result);
            })
            .end(req.file.buffer);
        });
        const newAvatarUrl = uploadResult.secure_url;
        await pool.query("UPDATE users SET avatar_url = $1 WHERE id = $2", [
          newAvatarUrl,
          id,
        ]);

        // Token sempre do próprio usuário, montado do banco. (Antes era
        // assinado com o id da URL: qualquer logado obtinha o token de outro.)
        const sessao = await emitirSessao(pool, req.user.id);
        res.json({ success: true, user: sessao.user, token: sessao.token });
      } catch (err) {
        console.error("Erro no upload de avatar:", err);
        res.status(500).json({ error: "Erro no servidor durante o upload." });
      }
    },
  );

  router.delete("/:id/avatar", isLoggedIn, async (req, res) => {
    const { id } = req.params;
    if (!ehOProprio(req)) {
      return res
        .status(403)
        .json({ error: "Você só pode alterar a sua própria foto." });
    }
    try {
      const userResult = await pool.query(
        "SELECT avatar_url FROM users WHERE id = $1",
        [id],
      );
      const oldAvatarUrl = userResult.rows[0]?.avatar_url;
      if (oldAvatarUrl) {
        const publicId = oldAvatarUrl.split("/").pop().split(".")[0];
        await cloudinary.uploader.destroy(publicId);
      }
      await pool.query("UPDATE users SET avatar_url = NULL WHERE id = $1", [id]);

      const sessao = await emitirSessao(pool, req.user.id);
      res.json({ success: true, user: sessao.user, token: sessao.token });
    } catch (err) {
      console.error("Erro ao remover avatar:", err);
      res.status(500).json({ error: "Erro no servidor" });
    }
  });

  // ── Capa do perfil ─────────────────────────────────────────────────────────
  // Faixa do topo da tela de Perfil. A imagem é recortada no Cloudinary para
  // 1584 × 396 px (4:1, o padrão do LinkedIn), pelo centro — o mesmo recorte
  // que a pré-visualização do modal mostra.
  const CAPA_MAX_BYTES = 8 * 1024 * 1024;
  const CAPA_TIPOS = ["image/jpeg", "image/png", "image/webp"];

  // "…/upload/v123/capas-perfil/abc.jpg" → "capas-perfil/abc"
  const publicIdDaUrl = (url) => {
    const m = /\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i.exec(url || "");
    return m ? m[1] : null;
  };

  // Apagar a imagem antiga é faxina: se falhar, a troca já valeu.
  const apagarCapaAntiga = async (url) => {
    const publicId = publicIdDaUrl(url);
    if (!publicId) return;
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      console.error("Não foi possível apagar a capa antiga:", err.message);
    }
  };

  router.post(
    "/:id/cover",
    isLoggedIn,
    upload.single("cover"),
    async (req, res) => {
      const { id } = req.params;
      if (!ehOProprio(req)) {
        return res
          .status(403)
          .json({ error: "Você só pode alterar a sua própria capa." });
      }
      if (!req.file)
        return res.status(400).json({ error: "Nenhum arquivo enviado." });
      if (!CAPA_TIPOS.includes(req.file.mimetype)) {
        return res
          .status(400)
          .json({ error: "Envie uma imagem JPG, PNG ou WEBP." });
      }
      if (req.file.size > CAPA_MAX_BYTES) {
        return res
          .status(400)
          .json({ error: "A imagem deve ter no máximo 8 MB." });
      }
      try {
        const atual = await pool.query(
          "SELECT cover_url FROM users WHERE id = $1",
          [id],
        );
        const uploadResult = await new Promise((resolve, reject) => {
          cloudinary.uploader
            .upload_stream(
              {
                resource_type: "image",
                folder: "capas-perfil",
                transformation: [
                  { width: 1584, height: 396, crop: "fill", gravity: "center" },
                  { quality: "auto", fetch_format: "auto" },
                ],
              },
              (error, result) => (error ? reject(error) : resolve(result)),
            )
            .end(req.file.buffer);
        });
        await pool.query("UPDATE users SET cover_url = $1 WHERE id = $2", [
          uploadResult.secure_url,
          id,
        ]);
        await apagarCapaAntiga(atual.rows[0]?.cover_url);

        logActivity(
          req.user.id,
          req.user.email,
          "Capa do Perfil Alterada",
          "Nova imagem de capa enviada.",
          req.ipAddress,
        );
        const sessao = await emitirSessao(pool, req.user.id);
        res.json({ success: true, user: sessao.user, token: sessao.token });
      } catch (err) {
        console.error("Erro no upload da capa:", err);
        res.status(500).json({ error: "Erro no servidor durante o upload." });
      }
    },
  );

  router.delete("/:id/cover", isLoggedIn, async (req, res) => {
    const { id } = req.params;
    if (!ehOProprio(req)) {
      return res
        .status(403)
        .json({ error: "Você só pode alterar a sua própria capa." });
    }
    try {
      const atual = await pool.query(
        "SELECT cover_url FROM users WHERE id = $1",
        [id],
      );
      await pool.query("UPDATE users SET cover_url = NULL WHERE id = $1", [id]);
      await apagarCapaAntiga(atual.rows[0]?.cover_url);

      const sessao = await emitirSessao(pool, req.user.id);
      res.json({ success: true, user: sessao.user, token: sessao.token });
    } catch (err) {
      console.error("Erro ao remover a capa:", err);
      res.status(500).json({ error: "Erro no servidor" });
    }
  });

  router.put("/:id/change-password", isLoggedIn, async (req, res) => {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body || {};
    // Antes qualquer logado podia chamar com o id de outro: virava um jeito
    // de testar senhas alheias sem 2FA, sem limite e sem registro de falha.
    if (!ehOProprio(req)) {
      return res
        .status(403)
        .json({ error: "Você só pode alterar a sua própria senha." });
    }
    try {
      if (
        await excedeuLimite(pool, {
          acao: "Falha na Troca de Senha",
          minutos: 15,
          maximo: 5,
          userId: req.user.id,
        })
      ) {
        return res.status(429).json({
          error: "Muitas tentativas com a senha atual errada. Aguarde 15 minutos.",
        });
      }

      const userResult = await pool.query(
        "SELECT email, password FROM users WHERE id = $1",
        [id],
      );
      if (userResult.rowCount === 0)
        return res.status(404).json({ error: "Usuário não encontrado." });
      const { email, password: storedHash } = userResult.rows[0];
      if (
        typeof currentPassword !== "string" ||
        !(await bcrypt.compare(currentPassword, storedHash))
      ) {
        logActivity(
          req.user.id,
          req.user.email,
          "Falha na Troca de Senha",
          "Senha atual incorreta.",
          req.ipAddress,
        );
        return res.status(400).json({ error: "A senha atual está incorreta." });
      }
      const erroSenha = validarSenha(newPassword, email);
      if (erroSenha) return res.status(400).json({ error: erroSenha });
      if (newPassword === currentPassword) {
        return res
          .status(400)
          .json({ error: "A nova senha precisa ser diferente da atual." });
      }

      const newHash = await bcrypt.hash(newPassword, 10);
      await gravarSenha(pool, id, newHash);
      logActivity(
        req.user.id,
        req.user.email,
        "Alteração de Senha",
        "Senha alterada pelo perfil. Outras sessões foram encerradas.",
        req.ipAddress,
      );
      // As outras sessões caem; esta continua com um token novo.
      const sessao = await emitirSessao(pool, req.user.id);
      res.json({
        success: true,
        message: "Senha alterada com sucesso.",
        user: sessao.user,
        token: sessao.token,
      });
    } catch (err) {
      console.error("Erro ao alterar senha:", err);
      res.status(500).json({ error: "Erro no servidor" });
    }
  });

  return router;
};
