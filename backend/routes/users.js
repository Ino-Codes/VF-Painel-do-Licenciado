const express = require("express");
const bcrypt = require("bcryptjs");
const csv = require("csv-parser");
const { Readable } = require("stream");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { ROLE_TO_SLUG, SLUG_TO_ROLE } = require("../permissions.js");

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

module.exports = function (pool, cloudinary, upload, logActivity) {
  const { isLoggedIn, checkPermission } = require("../middleware/auth.js");

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

        const allowedSortBy = ["nome", "email", "role", "unidade"];
        let orderByClause = "ORDER BY nome ASC"; // Padrão

        if (
          allowedSortBy.includes(sortBy) &&
          ["ASC", "DESC"].includes(sortOrder?.toUpperCase())
        ) {
          orderByClause = `ORDER BY "${sortBy}" ${sortOrder.toUpperCase()}`;
        }

        const usersSql = `SELECT id, nome, nickname, email, role, group_id, avatar_url, corporate_photo_url, birth_date, cargo, setor, setor_id, unidade, unidade_id, telefone, data_admissao FROM users ${whereString} ${orderByClause} LIMIT $${
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
        password,
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

        await client.query("BEGIN");

        const hash = await bcrypt.hash(password, 10);

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

        res.status(201).json({ success: true, id: newUserId });
      } catch (err) {
        await client.query("ROLLBACK");
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
        "SELECT id, nome, nickname, email, role, avatar_url, corporate_photo_url, birth_date, cargo, setor, setor_id, unidade, unidade_id AS unit_id, telefone, data_admissao FROM users WHERE id = $1",
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

      if (req.user.id == id) {
        let groupName = null;
        if (updatedUser.group_id) {
          const gRes = await pool.query(
            "SELECT name FROM user_groups WHERE id = $1",
            [updatedUser.group_id],
          );
          groupName = gRes.rows[0] ? gRes.rows[0].name : null;
        }
        const newToken = jwt.sign(
          {
            id: updatedUser.id,
            email: updatedUser.email,
            role: updatedUser.role,
            nome: updatedUser.nome,
            nickname: updatedUser.nickname,
            avatar_url: updatedUser.avatar_url,
            data_admissao: updatedUser.data_admissao,
            group_id: updatedUser.group_id || null,
            group_name: groupName,
          },
          process.env.JWT_SECRET,
          { expiresIn: "12h" },
        );
        responsePayload.token = newToken;
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
          for (const user of results) {
            const { nome, email, password, role } = user;
            if (!nome || !email || !password || !role) {
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
              const hash = await bcrypt.hash(password, 10);
              await pool.query(
                "INSERT INTO users (nome, email, password, role) VALUES ($1, $2, $3, $4)",
                [nomeCapitalizado, emailNormalizado, hash, role],
              );
              logActivity(
                null,
                req.user.email,
                "Usuários Criados em Massa",
                `Usuário ${emailNormalizado} criado via importação em massa.`,
                req.ipAddress,
              );
              successCount++;
            } catch (dbError) {
              console.error(`Erro ao inserir usuário ${email}:`, dbError);
              errors.push(`Erro de banco de dados para o e-mail: ${email}.`);
            }
          }
          res.json({
            message: "Processamento do CSV finalizado.",
            successCount,
            errorCount: errors.length,
            errors,
          });
        });
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

  router.put("/force-change-password", isLoggedIn, async (req, res) => {
    const { id: userId } = req.user;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res
        .status(400)
        .json({ error: "A senha deve ter pelo menos 6 caracteres." });
    }

    try {
      const newHash = await bcrypt.hash(password, 10);
      await pool.query(
        "UPDATE users SET password = $1, must_change_password = FALSE WHERE id = $2",
        [newHash, userId],
      );

      logActivity(
        userId,
        req.user.email,
        "Alteração de Senha Forçada",
        "Senha alterada no primeiro acesso.",
        req.ipAddress,
      );
      res.json({ success: true, message: "Senha alterada com sucesso!" });
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
        const updateResult = await pool.query(
          "UPDATE users SET avatar_url = $1 WHERE id = $2 RETURNING id, nome, nickname, email, role, avatar_url, cargo, setor, unidade, unidade_id AS unit_id, telefone",
          [newAvatarUrl, id],
        );

        const updatedUser = updateResult.rows[0];

        const newToken = jwt.sign(
          {
            id: updatedUser.id,
            email: updatedUser.email,
            role: updatedUser.role,
            nome: updatedUser.nome,
            nickname: updatedUser.nickname,
            avatar_url: updatedUser.avatar_url,
            group_id: req.user.group_id || null,
            group_name: req.user.group_name || null,
          },
          process.env.JWT_SECRET,
          { expiresIn: "12h" },
        );

        res.json({ success: true, user: updatedUser, token: newToken });
      } catch (err) {
        console.error("Erro no upload de avatar:", err);
        res.status(500).json({ error: "Erro no servidor durante o upload." });
      }
    },
  );

  router.delete("/:id/avatar", isLoggedIn, async (req, res) => {
    const { id } = req.params;
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
      const updateResult = await pool.query(
        "UPDATE users SET avatar_url = NULL WHERE id = $1 RETURNING id, nome, nickname, email, role, avatar_url, cargo, setor, unidade, telefone",
        [id],
      );
      const updatedUser = updateResult.rows[0];
      const jwt = require("jsonwebtoken");
      const newToken = jwt.sign(
        {
          id: updatedUser.id,
          email: updatedUser.email,
          role: updatedUser.role,
          nome: updatedUser.nome,
          nickname: updatedUser.nickname,
          avatar_url: null,
          group_id: req.user.group_id || null,
          group_name: req.user.group_name || null,
        },
        process.env.JWT_SECRET,
        { expiresIn: "12h" },
      );

      res.json({ success: true, user: updatedUser, token: newToken });
    } catch (err) {
      console.error("Erro ao remover avatar:", err);
      res.status(500).json({ error: "Erro no servidor" });
    }
  });

  router.put("/:id/change-password", isLoggedIn, async (req, res) => {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
    try {
      const userResult = await pool.query(
        "SELECT password FROM users WHERE id = $1",
        [id],
      );
      if (userResult.rowCount === 0)
        return res.status(404).json({ error: "Usuário não encontrado." });
      const storedHash = userResult.rows[0].password;
      if (!(await bcrypt.compare(currentPassword, storedHash))) {
        return res.status(401).json({ error: "A senha atual está incorreta." });
      }
      const newHash = await bcrypt.hash(newPassword, 10);
      await pool.query("UPDATE users SET password = $1 WHERE id = $2", [
        newHash,
        id,
      ]);
      logActivity(
        id,
        null,
        "Alteração de Senha",
        "Senha alterada com sucesso.",
        req.ipAddress,
      );
      res.json({ success: true, message: "Senha alterada com sucesso." });
    } catch (err) {
      console.error("Erro ao alterar senha:", err);
      res.status(500).json({ error: "Erro no servidor" });
    }
  });

  return router;
};
