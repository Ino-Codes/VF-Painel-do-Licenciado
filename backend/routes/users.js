const express = require("express");
const bcrypt = require("bcryptjs");
const csv = require("csv-parser");
const { Readable } = require("stream");
const router = express.Router();

module.exports = function (pool, cloudinary, upload, logActivity) {
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
      const usersSql = `SELECT id, nome, email, role, avatar_url FROM users ${whereClause} ORDER BY nome ASC LIMIT $${
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

  router.post("/admin", async (req, res) => {
    const { nome, email, password, role } = req.body;
    try {
      const hash = await bcrypt.hash(password, 10);
      const result = await pool.query(
        "INSERT INTO users (nome, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id",
        [nome, email, hash, role]
      );
      logActivity(
        null,
        email,
        "CREATE_USER",
        `Usuário ${email} (${role}) foi criado.`,
        req.ipAddress
      );
      res.json({ success: true, id: result.rows[0].id });
    } catch (err) {
      console.error("Erro ao criar usuário:", err);
      res.status(500).json({ error: "Erro ao criar usuário" });
    }
  });

  router.put("/admin/:id", async (req, res) => {
    const { id } = req.params;
    const { nome, role } = req.body;
    try {
      const result = await pool.query(
        "UPDATE users SET nome = $1, role = $2 WHERE id = $3",
        [nome, role, id]
      );
      if (result.rowCount === 0)
        return res.status(404).json({ error: "Usuário não encontrado." });
      logActivity(
        id,
        null,
        "UPDATE_USER_ADMIN",
        `Dados do usuário ID ${id} foram atualizados para nome: ${nome}, role: ${role}.`,
        req.ipAddress
      );
      res.json({ success: true, message: "Usuário atualizado com sucesso." });
    } catch (err) {
      console.error("Erro ao atualizar usuário:", err);
      res.status(500).json({ error: "Erro no servidor" });
    }
  });

  router.delete("/admin/:id", async (req, res) => {
    app.delete("/api/admin/users/:id", async (req, res) => {
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
          client.release();
          return res.status(404).json({ error: "Usuário não encontrado." });
        }
        const userEmail = userResult.rows[0].email;

        await client.query(
          "UPDATE activity_logs SET user_id = NULL WHERE user_id = $1",
          [id]
        );

        await client.query("DELETE FROM users WHERE id = $1", [id]);

        const logSql =
          "INSERT INTO activity_logs (user_id, user_email, action, details, ip_address) VALUES ($1, $2, $3, $4, $5)";
        const logValues = [
          null,
          userEmail,
          "DELETE_USER",
          `Usuário ${userEmail} (ID: ${id}) foi excluído.`,
          req.ipAddress,
        ];
        await client.query(logSql, logValues);

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
  });

  router.post("/admin/bulk-upload", upload.single("file"), async (req, res) => {
    app.post(
      "/api/admin/users/bulk-upload",
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
      }
    );
  });

  // --- Rotas de Perfil do Usuário Logado ---

  router.post("/:id/avatar", upload.single("avatar"), async (req, res) => {
    app.post(
      "/api/users/:id/avatar",
      upload.single("avatar"),
      async (req, res) => {
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
      }
    );
  });

  router.put("/:id/profile", async (req, res) => {
    app.put("/api/users/:id/profile", async (req, res) => {
      const { id } = req.params;
      const { nome } = req.body;
      try {
        const result = await pool.query(
          "UPDATE users SET nome = $1 WHERE id = $2 RETURNING *",
          [nome, id]
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
  });

  router.put("/:id/change-password", async (req, res) => {
    app.put("/api/users/:id/change-password", async (req, res) => {
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
          return res
            .status(401)
            .json({ error: "A senha atual está incorreta." });
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
  });

  router.delete("/:id/avatar", async (req, res) => {
    app.delete("/api/users/:id/avatar", async (req, res) => {
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
  });

  return router;
};
