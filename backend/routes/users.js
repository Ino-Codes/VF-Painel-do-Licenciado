const express = require("express");
const bcrypt = require("bcryptjs");
const csv = require("csv-parser");
const { Readable } = require("stream");
const router = express.Router();

module.exports = function (pool, cloudinary, upload, logActivity) {
  const { isAdmin, isLoggedIn } = require("../middleware/auth.js");
  const checkAdmin = isAdmin(pool);
  const checkLoggedIn = isLoggedIn(pool);

  // --- Rotas de Admin (Listar, Criar, Editar) ---

  router.get("/admin", async (req, res) => {
    const { search, page = 1, limit = 10 } = req.query;
    try {
      const offset = (page - 1) * limit;
      let whereClause = "";
      const params = [];
      if (search) {
        params.push(`%${search}%`);
        whereClause = `WHERE nome ILIKE $1 OR email ILIKE $1`;
      }
      const countSql = `SELECT COUNT(*) FROM users ${whereClause}`;

      const usersSql = `SELECT id, nome, email, role, avatar_url, birth_date, cargo, setor, unidade, telefone FROM users ${whereClause} ORDER BY nome ASC LIMIT $${
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
  });

  router.get("/internal", checkLoggedIn, async (req, res) => {
    try {
      const internalUsersSql = `
      SELECT id, nome, email, role, avatar_url, cargo, setor, unidade, telefone 
      FROM users 
      WHERE role IN ('admin', 'colaborador') 
      ORDER BY nome ASC
    `;

      const result = await pool.query(internalUsersSql);
      res.json(result.rows);
    } catch (err) {
      console.error("Erro ao buscar usuários internos:", err);
      res.status(500).json({ error: "Erro ao buscar usuários internos" });
    }
  });

  router.post("/admin", checkLoggedIn, checkAdmin, async (req, res) => {
    const {
      nome,
      email,
      password,
      role,
      birth_date,
      cargo,
      setor,
      unidade,
      telefone,
    } = req.body;
    const client = await pool.connect();

    try {
      if (
        (role === "admin" || role === "colaborador") &&
        (!unidade || !unidade.trim())
      ) {
        return res.status(400).json({
          error: "O campo Unidade é obrigatório para Admins e Colaboradores.",
        });
      }

      await client.query("BEGIN");

      const hash = await bcrypt.hash(password, 10);

      const userResult = await client.query(
        "INSERT INTO users (nome, email, password, role, birth_date, cargo, setor, unidade, telefone) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id",
        [
          nome,
          email,
          hash,
          role,
          birth_date || null,
          cargo || null,
          setor || null,
          unidade || null,
          telefone || null,
        ]
      );
      const newUserId = userResult.rows[0].id;

      if (role !== "licenciado" && birth_date) {
        const [_, month, day] = birth_date.split("-");

        const eventTitle = `Aniversário de ${nome}`;

        for (let i = 0; i < 10; i++) {
          const eventYear = new Date().getFullYear() + i;

          const eventStartDate = new Date(
            `${eventYear}-${month}-${day}T11:00:00`
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
            ]
          );
        }
      }

      await client.query("COMMIT");

      logActivity(
        newUserId,
        email,
        "CREATE_USER",
        `Usuário ${email} (${role}) foi criado.`,
        req.ipAddress
      );

      res.status(201).json({ success: true, id: newUserId });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Erro ao criar usuário:", err);
      res.status(500).json({ error: "Erro ao criar usuário" });
    } finally {
      client.release();
    }
  });

  router.put("/force-change-password", checkLoggedIn, async (req, res) => {
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
        [newHash, userId]
      );

      logActivity(
        userId,
        req.user.email,
        "FORCE_PASSWORD_RESET",
        "Senha alterada no primeiro acesso.",
        req.ipAddress
      );
      res.json({ success: true, message: "Senha alterada com sucesso!" });
    } catch (err) {
      console.error("Erro ao forçar mudança de senha:", err);
      res.status(500).json({ error: "Erro no servidor" });
    }
  });

  router.put("/admin/:id", async (req, res) => {
    const { id } = req.params;
    const { nome, email, role, birth_date, cargo, setor, unidade, telefone } =
      req.body;
    const client = await pool.connect();

    try {
      if (
        (role === "admin" || role === "colaborador") &&
        (!unidade || !unidade.trim())
      ) {
        return res.status(400).json({
          error: "O campo Unidade é obrigatório para Admins e Colaboradores.",
        });
      }

      await client.query("BEGIN");

      const finalBirthDate = role === "colaborador" ? birth_date : null;

      const userResult = await client.query(
        "UPDATE users SET nome = $1, email = $2, role = $3, birth_date = $4, cargo = $5, setor = $6, unidade = $7, telefone = $8 WHERE id = $9 RETURNING *",
        [
          nome,
          email,
          role,
          finalBirthDate,
          cargo,
          setor,
          unidade || null,
          telefone,
          id,
        ]
      );

      if (userResult.rowCount === 0) {
        await client.query("ROLLBACK");
        client.release();
        return res.status(404).json({ error: "Usuário não encontrado." });
      }

      await client.query(
        "DELETE FROM events WHERE created_by_user_id = $1 AND category = 'Aniversário'",
        [id]
      );

      if (role === "colaborador" && finalBirthDate) {
        const birthDate = new Date(finalBirthDate);
        const eventTitle = `Aniversário - ${nome}`;

        for (let i = 0; i < 10; i++) {
          const eventYear = new Date().getFullYear() + i;
          const eventStartDate = new Date(
            Date.UTC(
              eventYear,
              birthDate.getUTCMonth(),
              birthDate.getUTCDate(),
              8
            )
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
            ]
          );
        }
      }

      await client.query("COMMIT");

      logActivity(
        id,
        email,
        "UPDATE_USER_ADMIN",
        `Dados do usuário ID ${id} foram atualizados.`,
        req.ipAddress
      );

      const updatedUser = userResult.rows[0];
      delete updatedUser.password;

      res.json({ success: true, user: updatedUser });
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

  router.delete("/admin/:id", async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const userResult = await client.query(
        "SELECT email FROM users WHERE id = $1",
        [id]
      );
      if (userResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Usuário não encontrado." });
      }
      const userEmail = userResult.rows[0].email;
      await client.query(
        "UPDATE activity_logs SET user_id = NULL WHERE user_id = $1",
        [id]
      );
      await client.query("DELETE FROM users WHERE id = $1", [id]);
      logActivity(
        null,
        userEmail,
        "DELETE_USER",
        `Usuário ${userEmail} (ID: ${id}) foi excluído.`,
        req.ipAddress
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
  });

  router.post("/admin/bulk-upload", upload.single("file"), async (req, res) => {
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
              `Dados incompletos para o e-mail: ${email || "desconhecido"}.`
            );
            continue;
          }
          try {
            const existingUser = await pool.query(
              "SELECT id FROM users WHERE email = $1",
              [email]
            );
            if (existingUser.rowCount > 0) {
              errors.push(`E-mail já cadastrado: ${email}.`);
              continue;
            }
            const hash = await bcrypt.hash(password, 10);
            await pool.query(
              "INSERT INTO users (nome, email, password, role) VALUES ($1, $2, $3, $4)",
              [nome, email, hash, role]
            );
            logActivity(
              null,
              email,
              "BULK_CREATE_USER",
              `Usuário ${email} criado via importação em massa.`,
              req.ipAddress
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
  });

  // --- Rotas de Perfil do Usuário Logado ---

  router.post("/:id/avatar", upload.single("avatar"), async (req, res) => {
    const { id } = req.params;
    if (!req.file)
      return res.status(400).json({ error: "Nenhum arquivo enviado." });
    try {
      const userResult = await pool.query(
        "SELECT avatar_url FROM users WHERE id = $1",
        [id]
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
        "UPDATE users SET avatar_url = $1 WHERE id = $2 RETURNING avatar_url",
        [newAvatarUrl, id]
      );
      logActivity(
        id,
        null,
        "UPDATE_AVATAR",
        "Foto de perfil atualizada.",
        req.ipAddress
      );
      res.json({
        success: true,
        avatarUrl: updateResult.rows[0].avatar_url,
      });
    } catch (err) {
      console.error("Erro no upload de avatar:", err);
      res.status(500).json({ error: "Erro no servidor durante o upload." });
    }
  });

  router.put("/:id/profile", async (req, res) => {
    const { id } = req.params;
    const { nome, bio } = req.body;
    try {
      const result = await pool.query(
        "UPDATE users SET nome = $1, bio = $2 WHERE id = $3 RETURNING *",
        [nome, bio, id]
      );
      if (result.rowCount === 0)
        return res.status(404).json({ error: "Usuário não encontrado." });
      const updatedUser = result.rows[0];
      delete updatedUser.password;
      delete updatedUser.reset_token;
      delete updatedUser.reset_token_expires;
      logActivity(
        id,
        null,
        "UPDATE_PROFILE",
        "Nome do perfil atualizado.",
        req.ipAddress
      );
      res.json({ success: true, user: updatedUser });
    } catch (err) {
      console.error("Erro ao atualizar perfil:", err);
      res.status(500).json({ error: "Erro no servidor" });
    }
  });

  router.put("/:id/change-password", async (req, res) => {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
    try {
      const userResult = await pool.query(
        "SELECT password FROM users WHERE id = $1",
        [id]
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
        "CHANGE_PASSWORD",
        "Senha alterada com sucesso.",
        req.ipAddress
      );
      res.json({ success: true, message: "Senha alterada com sucesso." });
    } catch (err) {
      console.error("Erro ao alterar senha:", err);
      res.status(500).json({ error: "Erro no servidor" });
    }
  });

  router.delete("/:id/avatar", async (req, res) => {
    const { id } = req.params;
    try {
      const userResult = await pool.query(
        "SELECT avatar_url FROM users WHERE id = $1",
        [id]
      );
      const oldAvatarUrl = userResult.rows[0]?.avatar_url;
      if (oldAvatarUrl) {
        const publicId = oldAvatarUrl.split("/").pop().split(".")[0];
        await cloudinary.uploader.destroy(publicId);
      }
      const updateResult = await pool.query(
        "UPDATE users SET avatar_url = NULL WHERE id = $1 RETURNING *",
        [id]
      );
      const updatedUser = updateResult.rows[0];
      delete updatedUser.password;
      delete updatedUser.reset_token;
      delete updatedUser.reset_token_expires;
      logActivity(
        id,
        null,
        "REMOVE_AVATAR",
        "Foto de perfil removida.",
        req.ipAddress
      );
      res.json({ success: true, user: updatedUser });
    } catch (err) {
      console.error("Erro ao remover avatar:", err);
      res.status(500).json({ error: "Erro no servidor" });
    }
  });

  return router;
};
