const express = require("express");
const { isLoggedIn } = require("../middleware/auth.js");
const blobStorage = require("../storage/blobStorage.js");

// ═══════════════════════════════════════════════════════════════════════════
// Certificados e diplomas externos do colaborador (Perfil)
// ═══════════════════════════════════════════════════════════════════════════
// Cada usuário cadastra os próprios: nome, organização emissora, mês/ano de
// emissão e de 1 a MAX_ARQUIVOS arquivos (imagem ou PDF).
// Arquivos: imagem → Cloudinary, PDF → Azure Blob (storage/documentos.js).
//
// Por enquanto só o dono vê os seus. Quando os certificados aparecerem para
// outros colaboradores, a regra de acesso fica em `podeVer` abaixo.

const MAX_ARQUIVOS = 5;
const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MES_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.httpStatus = status;
  }
}

const mesAtualSP = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);

const lerTexto = (valor, rotulo, max) => {
  const s = String(valor ?? "").trim();
  if (!s) throw new HttpError(400, `Informe ${rotulo}.`);
  if (s.length > max) throw new HttpError(400, `${rotulo[0].toUpperCase()}${rotulo.slice(1)} deve ter até ${max} caracteres.`);
  return s;
};

// "AAAA-MM" → "AAAA-MM-01". Não aceita mês futuro.
const lerMes = (valor) => {
  const s = String(valor ?? "").trim();
  if (!MES_RE.test(s)) throw new HttpError(400, "Informe o mês e o ano de emissão.");
  if (s > mesAtualSP()) throw new HttpError(400, "A data de emissão não pode ser futura.");
  return `${s}-01`;
};

const lerIds = (valor) => {
  if (!valor) return [];
  let lista = valor;
  if (typeof valor === "string") {
    try {
      lista = JSON.parse(valor);
    } catch {
      lista = valor.split(",");
    }
  }
  return (Array.isArray(lista) ? lista : [lista])
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
};

const tipoDoArquivo = (contentType) =>
  contentType === "application/pdf" ? "pdf" : "imagem";

module.exports = function (pool, cloudinary, upload, logActivity) {
  const router = express.Router();
  const documentos = require("../storage/documentos.js")(cloudinary);
  const receberArquivos = upload.array("arquivos", MAX_ARQUIVOS);

  // Multer como Promise, para tratar "arquivos demais" com mensagem própria.
  const runUpload = (req, res) =>
    new Promise((resolve, reject) => {
      receberArquivos(req, res, (err) => {
        if (!err) return resolve();
        if (err.code === "LIMIT_UNEXPECTED_FILE" || err.code === "LIMIT_FILE_COUNT") {
          return reject(new HttpError(400, `Envie no máximo ${MAX_ARQUIVOS} arquivos.`));
        }
        if (err.code === "LIMIT_FILE_SIZE") {
          return reject(new HttpError(413, "Arquivo grande demais."));
        }
        reject(err);
      });
    });

  const responderErro = (res, err, contexto) => {
    if (err.httpStatus) return res.status(err.httpStatus).json({ error: err.message });
    console.error(`Certificados externos — ${contexto}:`, err);
    return res.status(500).json({ error: "Erro no servidor." });
  };

  const validarTipos = (arquivos) => {
    const invalido = arquivos.find((f) => !TIPOS_ACEITOS.includes(f.mimetype));
    if (invalido) {
      throw new HttpError(
        400,
        `"${invalido.originalname}" não é aceito. Envie imagens (JPG, PNG, WEBP) ou PDF.`,
      );
    }
  };

  // Grava os arquivos no provedor certo. Se um falhar, apaga os que já
  // subiram — nada fica órfão no Cloudinary/Azure.
  const salvarArquivos = async (arquivos) => {
    const salvos = [];
    try {
      for (const file of arquivos) {
        const s = await documentos.salvar({
          file,
          nomeExibicao: file.originalname,
          pasta: "certificados",
          category: "certificados",
        });
        salvos.push({ ...s, file });
      }
      return salvos;
    } catch (err) {
      await Promise.allSettled(salvos.map((s) => excluirFisico(s)));
      throw err;
    }
  };

  // Remove o arquivo físico. Aceita tanto o retorno de documentos.salvar
  // quanto uma linha de user_certificate_files.
  const excluirFisico = (a) =>
    documentos.excluir({
      storage: a.storage,
      blob_name: a.blob_name ?? a.blobName,
      public_id: a.public_id ?? a.publicId,
      filename: a.url,
    });

  const inserirArquivos = async (client, certId, salvos, ordemInicial) => {
    let ordem = ordemInicial;
    for (const s of salvos) {
      await client.query(
        `INSERT INTO user_certificate_files
           (certificate_id, storage, url, public_id, blob_name, nome_original,
            content_type, tamanho, ordem)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [certId, s.storage, s.url, s.publicId, s.blobName, s.file.originalname,
         s.file.mimetype, s.file.size, ordem++],
      );
    }
  };

  // Certificados com os arquivos. Imagens já vêm com a URL (para miniatura);
  // PDFs não — o link é temporário e é pedido na hora de abrir.
  const listar = async (db, where, params) => {
    const r = await db.query(
      `SELECT c.id, c.nome, c.organizacao,
              to_char(c.data_emissao, 'YYYY-MM') AS mes,
              c.created_at, c.updated_at,
              COALESCE(json_agg(json_build_object(
                'id', f.id, 'nome', f.nome_original, 'contentType', f.content_type,
                'tamanho', f.tamanho, 'storage', f.storage, 'url', f.url
              ) ORDER BY f.ordem, f.id) FILTER (WHERE f.id IS NOT NULL), '[]') AS arquivos
         FROM user_certificates c
         LEFT JOIN user_certificate_files f ON f.certificate_id = c.id
        WHERE ${where}
        GROUP BY c.id
        ORDER BY c.data_emissao DESC, c.id DESC`,
      params,
    );
    return r.rows.map((c) => ({
      ...c,
      arquivos: c.arquivos.map((a) => {
        const tipo = tipoDoArquivo(a.contentType);
        return {
          id: a.id,
          nome: a.nome,
          tipo,
          tamanho: a.tamanho,
          // Imagem no Cloudinary: URL direta. PDF: via /arquivos/:id/link.
          url: tipo === "imagem" && a.storage === "cloudinary" ? a.url : null,
        };
      }),
    }));
  };

  const buscarDoUsuario = async (db, id, userId) => {
    const lista = await listar(db, "c.id = $1 AND c.user_id = $2", [id, userId]);
    if (!lista.length) throw new HttpError(404, "Certificado não encontrado.");
    return lista[0];
  };

  const log = (req, detalhes) =>
    logActivity(req.user.id, req.user.email, "Certificado Externo", detalhes, req.ipAddress);

  // ── Meus certificados ────────────────────────────────────────────────────
  router.get("/mine", isLoggedIn, async (req, res) => {
    try {
      res.json(await listar(pool, "c.user_id = $1", [req.user.id]));
    } catch (err) {
      responderErro(res, err, "listagem");
    }
  });

  // ── Link temporário de um arquivo (abrir no navegador) ───────────────────
  router.get("/arquivos/:arquivoId/link", isLoggedIn, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT f.*, c.user_id
           FROM user_certificate_files f
           JOIN user_certificates c ON c.id = f.certificate_id
          WHERE f.id = $1`,
        [Number(req.params.arquivoId) || 0],
      );
      const a = r.rows[0];
      // 404 também quando é de outra pessoa: não revela que o arquivo existe.
      if (!a || a.user_id !== req.user.id) throw new HttpError(404, "Arquivo não encontrado.");

      let url;
      if (a.storage === "azure") {
        url = await blobStorage.urlDeAcesso(a.blob_name, a.nome_original, { minutos: 10, inline: true });
      } else if (a.content_type.startsWith("image/")) {
        url = a.url;
      } else {
        // PDF que caiu no Cloudinary (Azure não configurado na época).
        url = await documentos.linkDeDownload({
          storage: "cloudinary",
          filename: a.url,
          public_id: a.public_id,
          originalname: a.nome_original,
        });
      }
      res.json({ url });
    } catch (err) {
      responderErro(res, err, "link do arquivo");
    }
  });

  // ── Cadastrar ────────────────────────────────────────────────────────────
  router.post("/", isLoggedIn, async (req, res) => {
    let salvos = [];
    try {
      await runUpload(req, res);
      const nome = lerTexto(req.body.nome, "o nome do certificado", 200);
      const organizacao = lerTexto(req.body.organizacao, "a organização emissora", 200);
      const dataEmissao = lerMes(req.body.mes);
      const arquivos = req.files || [];
      if (!arquivos.length) throw new HttpError(400, "Envie ao menos uma imagem ou PDF do certificado.");
      validarTipos(arquivos);

      salvos = await salvarArquivos(arquivos);

      const client = await pool.connect();
      let cert;
      try {
        await client.query("BEGIN");
        const r = await client.query(
          `INSERT INTO user_certificates (user_id, nome, organizacao, data_emissao)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [req.user.id, nome, organizacao, dataEmissao],
        );
        await inserirArquivos(client, r.rows[0].id, salvos, 0);
        cert = await buscarDoUsuario(client, r.rows[0].id, req.user.id);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
      } finally {
        client.release();
      }
      salvos = [];
      log(req, `Adicionou o certificado "${nome}" (${organizacao}).`);
      res.status(201).json(cert);
    } catch (err) {
      // Banco falhou depois do upload: remove os arquivos enviados.
      await Promise.allSettled(salvos.map((s) => excluirFisico(s)));
      responderErro(res, err, "cadastro");
    }
  });

  // ── Editar: dados, remover arquivos e/ou adicionar novos ─────────────────
  router.put("/:id", isLoggedIn, async (req, res) => {
    let salvos = [];
    try {
      await runUpload(req, res);
      const id = Number(req.params.id) || 0;
      const nome = lerTexto(req.body.nome, "o nome do certificado", 200);
      const organizacao = lerTexto(req.body.organizacao, "a organização emissora", 200);
      const dataEmissao = lerMes(req.body.mes);
      const remover = lerIds(req.body.remover);
      const novos = req.files || [];
      validarTipos(novos);

      const atual = await buscarDoUsuario(pool, id, req.user.id);
      const idsAtuais = atual.arquivos.map((a) => a.id);
      const removidos = remover.filter((r) => idsAtuais.includes(r));
      const restantes = idsAtuais.length - removidos.length + novos.length;
      if (restantes < 1) throw new HttpError(400, "O certificado precisa ter ao menos uma imagem ou PDF.");
      if (restantes > MAX_ARQUIVOS) throw new HttpError(400, `Um certificado pode ter no máximo ${MAX_ARQUIVOS} arquivos.`);

      salvos = await salvarArquivos(novos);

      const client = await pool.connect();
      let cert;
      let apagar = [];
      try {
        await client.query("BEGIN");
        await client.query(
          `UPDATE user_certificates
              SET nome = $1, organizacao = $2, data_emissao = $3, updated_at = NOW()
            WHERE id = $4 AND user_id = $5`,
          [nome, organizacao, dataEmissao, id, req.user.id],
        );
        if (removidos.length) {
          const r = await client.query(
            `DELETE FROM user_certificate_files
              WHERE certificate_id = $1 AND id = ANY($2::int[])
              RETURNING storage, url, public_id, blob_name`,
            [id, removidos],
          );
          apagar = r.rows;
        }
        const ordem = await client.query(
          "SELECT COALESCE(MAX(ordem) + 1, 0)::int AS prox FROM user_certificate_files WHERE certificate_id = $1",
          [id],
        );
        await inserirArquivos(client, id, salvos, ordem.rows[0].prox);
        cert = await buscarDoUsuario(client, id, req.user.id);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
      } finally {
        client.release();
      }
      salvos = [];
      // Arquivos removidos só são apagados depois do COMMIT.
      await Promise.allSettled(apagar.map((a) => excluirFisico(a)));
      log(req, `Editou o certificado "${nome}".`);
      res.json(cert);
    } catch (err) {
      await Promise.allSettled(salvos.map((s) => excluirFisico(s)));
      responderErro(res, err, "edição");
    }
  });

  // ── Excluir ──────────────────────────────────────────────────────────────
  router.delete("/:id", isLoggedIn, async (req, res) => {
    try {
      const id = Number(req.params.id) || 0;
      const arquivos = await pool.query(
        `SELECT f.storage, f.url, f.public_id, f.blob_name
           FROM user_certificate_files f
           JOIN user_certificates c ON c.id = f.certificate_id
          WHERE c.id = $1 AND c.user_id = $2`,
        [id, req.user.id],
      );
      const r = await pool.query(
        "DELETE FROM user_certificates WHERE id = $1 AND user_id = $2 RETURNING nome",
        [id, req.user.id],
      );
      if (!r.rowCount) throw new HttpError(404, "Certificado não encontrado.");
      await Promise.allSettled(arquivos.rows.map((a) => excluirFisico(a)));
      log(req, `Excluiu o certificado "${r.rows[0].nome}".`);
      res.json({ success: true });
    } catch (err) {
      responderErro(res, err, "exclusão");
    }
  });

  return router;
};
