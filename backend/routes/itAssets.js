const express = require("express");

// ═══════════════════════════════════════════════════════════════════════════
// Inventário de TI
// ═══════════════════════════════════════════════════════════════════════════
// O status de um ativo NÃO é editável: ele muda só pelas ações (entregar,
// devolver, transferir, manutenção, retorno, baixa), e cada ação grava um
// evento em it_asset_events dentro da mesma transação. Assim o histórico é
// sempre a explicação completa da situação atual.
//
// Responsável: uma pessoa (user_id) ou um setor (setor_id, aparelho
// compartilhado). Com pessoa, o setor exibido vem do cadastro dela.

const escapeLike = (texto) => String(texto).replace(/[\\%_]/g, "\\$&");

// Ações permitidas a partir de cada status.
const TRANSICOES = {
  entregar: ["disponivel"],
  devolver: ["em_uso"],
  transferir: ["em_uso"],
  manutencao: ["disponivel", "em_uso"],
  retorno: ["manutencao"],
  baixa: ["disponivel", "em_uso", "manutencao"],
};

const STATUS_ROTULO = {
  disponivel: "Disponível",
  em_uso: "Em uso",
  manutencao: "Em manutenção",
  baixado: "Baixado",
};

const MOTIVOS_BAIXA = ["descarte", "venda", "perda", "roubo", "doacao", "outro"];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.httpStatus = status;
  }
}

// Data de hoje no fuso de São Paulo, como AAAA-MM-DD.
const hojeSP = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

// Data opcional: vazio → null; formato inválido → erro 400.
const lerData = (valor, rotulo) => {
  if (valor === undefined || valor === null || valor === "") return null;
  const s = String(valor);
  if (!DATA_RE.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00Z`))) {
    throw new HttpError(400, `${rotulo}: data inválida.`);
  }
  return s;
};

const dataBR = (iso) => iso.split("-").reverse().join("/");

// Data da ação: a informada ou hoje. Não aceita data futura nem anterior à
// última movimentação — senão o histórico diria, por exemplo, que o ativo
// foi devolvido antes de ser entregue.
const lerDataEvento = (valor, minima) => {
  const data = lerData(valor, "Data") || hojeSP();
  if (data > hojeSP()) throw new HttpError(400, "A data não pode ser futura.");
  if (minima && data < minima) {
    throw new HttpError(
      400,
      `A data não pode ser anterior à última movimentação (${dataBR(minima)}).`,
    );
  }
  return data;
};

// Texto opcional: aparado, vazio → null, com limite de tamanho.
const lerTexto = (valor, max = 500) => {
  if (valor === undefined || valor === null) return null;
  const s = String(valor).trim();
  if (!s) return null;
  return s.slice(0, max);
};

const lerId = (valor) => {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// Descrição curta do ativo, usada em logs e notificações.
const descrever = (a) => {
  const nome = [a.marca, a.modelo].filter(Boolean).join(" ") || a.tipo_nome;
  return a.patrimonio ? `${nome} (patrimônio ${a.patrimonio})` : `${nome} (sem patrimônio)`;
};

// SELECT base da listagem e do detalhe. Setor exibido: o do ativo quando
// for compartilhado, senão o do colaborador responsável.
const SELECT_ATIVO = `
  SELECT a.id, a.type_id, t.nome AS tipo_nome, t.categoria,
         a.patrimonio, a.marca, a.modelo, a.numero_serie, a.admin_local,
         a.status, a.user_id, a.setor_id,
         to_char(a.responsavel_desde, 'YYYY-MM-DD') AS responsavel_desde,
         u.nome AS responsavel_nome,
         COALESCE(u.corporate_photo_url, u.avatar_url) AS responsavel_foto,
         u.email AS responsavel_email,
         COALESCE(sa.nome, su.nome) AS setor_nome,
         (a.setor_id IS NOT NULL) AS compartilhado,
         to_char(a.data_aquisicao, 'YYYY-MM-DD') AS data_aquisicao,
         a.valor_aquisicao, a.fornecedor, a.nota_fiscal,
         to_char(a.garantia_ate, 'YYYY-MM-DD') AS garantia_ate,
         a.observacao, a.origem, a.created_at, a.updated_at
    FROM it_assets a
    JOIN it_asset_types t ON t.id = a.type_id
    LEFT JOIN users u ON u.id = a.user_id
    LEFT JOIN setores sa ON sa.id = a.setor_id
    LEFT JOIN setores su ON su.id = u.setor_id`;

// Campos cadastrais editáveis e seus rótulos (para o evento de edição).
const CAMPOS = {
  type_id: "tipo",
  patrimonio: "patrimônio",
  marca: "marca",
  modelo: "modelo",
  numero_serie: "nº de série/IMEI",
  admin_local: "admin local",
  data_aquisicao: "data de aquisição",
  valor_aquisicao: "valor",
  fornecedor: "fornecedor",
  nota_fiscal: "nota fiscal",
  garantia_ate: "garantia",
  observacao: "observação",
};

module.exports = function (pool, logActivity, createNotification) {
  const router = express.Router();
  const { isLoggedIn, checkPermission } = require("../middleware/auth.js");
  const podeVer = [isLoggedIn, checkPermission("it_assets.view")];
  const podeGerir = [isLoggedIn, checkPermission("it_assets.manage")];

  const withTransaction = async (fn) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (_) {
        /* ignora falha no rollback */
      }
      throw err;
    } finally {
      client.release();
    }
  };

  const responderErro = (res, err, contexto) => {
    if (err.httpStatus) return res.status(err.httpStatus).json({ error: err.message });
    if (err.code === "23505") {
      return res
        .status(409)
        .json({ error: "Já existe um ativo com este número de patrimônio." });
    }
    console.error(`Inventário de TI — ${contexto}:`, err);
    return res.status(500).json({ error: "Erro no servidor." });
  };

  const buscarAtivo = async (db, id) => {
    const r = await db.query(`${SELECT_ATIVO} WHERE a.id = $1`, [id]);
    return r.rows[0] || null;
  };

  const registrarEvento = (client, assetId, ev, req) =>
    client.query(
      `INSERT INTO it_asset_events
         (asset_id, tipo, user_id, colaborador_nome, setor_id, setor_nome,
          detalhes, data_evento, feito_por, feito_por_nome)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        assetId,
        ev.tipo,
        ev.userId || null,
        ev.colaboradorNome || null,
        ev.setorId || null,
        ev.setorNome || null,
        ev.detalhes || null,
        ev.data || hojeSP(),
        req.user.id,
        req.user.nome || req.user.email,
      ],
    );

  // Trava o ativo e confere se a ação é permitida no status atual. Devolve
  // também a data da última movimentação (cadastro e edição não contam: um
  // equipamento cadastrado hoje pode ter sido entregue meses atrás).
  const travarParaAcao = async (client, id, acao) => {
    const r = await client.query(
      `SELECT a.id, a.status, a.user_id, a.setor_id,
              (SELECT to_char(MAX(e.data_evento), 'YYYY-MM-DD')
                 FROM it_asset_events e
                WHERE e.asset_id = a.id
                  AND e.tipo NOT IN ('cadastro', 'edicao')) AS ultima_data
         FROM it_assets a
        WHERE a.id = $1
          FOR UPDATE OF a`,
      [id],
    );
    if (r.rows.length === 0) throw new HttpError(404, "Ativo não encontrado.");
    const atual = r.rows[0];
    if (!TRANSICOES[acao].includes(atual.status)) {
      throw new HttpError(
        409,
        `Ação não permitida: o ativo está "${STATUS_ROTULO[atual.status]}".`,
      );
    }
    return atual;
  };

  // Resolve o novo responsável: exatamente um entre colaborador e setor.
  const lerResponsavel = async (client, body) => {
    const userId = lerId(body.user_id);
    const setorId = lerId(body.setor_id);
    if (!userId === !setorId) {
      throw new HttpError(400, "Informe um colaborador ou um setor.");
    }
    if (userId) {
      const u = await client.query("SELECT id, nome FROM users WHERE id = $1", [userId]);
      if (!u.rows.length) throw new HttpError(400, "Colaborador não encontrado.");
      return { userId, setorId: null, nome: u.rows[0].nome };
    }
    const s = await client.query("SELECT id, nome FROM setores WHERE id = $1", [setorId]);
    if (!s.rows.length) throw new HttpError(400, "Setor não encontrado.");
    return { userId: null, setorId, nome: s.rows[0].nome };
  };

  // Nome do responsável atual (pessoa ou setor), para gravar no evento.
  const nomeResponsavelAtual = async (client, atual) => {
    if (atual.user_id) {
      const u = await client.query("SELECT nome FROM users WHERE id = $1", [atual.user_id]);
      return { userId: atual.user_id, colaboradorNome: u.rows[0]?.nome || null };
    }
    if (atual.setor_id) {
      const s = await client.query("SELECT nome FROM setores WHERE id = $1", [atual.setor_id]);
      return { setorId: atual.setor_id, setorNome: s.rows[0]?.nome || null };
    }
    return {};
  };

  // Valida e normaliza o corpo do cadastro/edição.
  const lerCadastro = async (db, body) => {
    const typeId = lerId(body.type_id);
    if (!typeId) throw new HttpError(400, "Informe o tipo do ativo.");
    const tipo = await db.query("SELECT categoria FROM it_asset_types WHERE id = $1", [typeId]);
    if (!tipo.rows.length) throw new HttpError(400, "Tipo inválido.");

    let valor = null;
    if (body.valor_aquisicao !== undefined && body.valor_aquisicao !== null && body.valor_aquisicao !== "") {
      valor = Number(String(body.valor_aquisicao).replace(",", "."));
      if (!Number.isFinite(valor) || valor < 0) throw new HttpError(400, "Valor inválido.");
    }

    const dados = {
      type_id: typeId,
      patrimonio: lerTexto(body.patrimonio, 40),
      marca: lerTexto(body.marca, 80),
      modelo: lerTexto(body.modelo, 120),
      numero_serie: lerTexto(body.numero_serie, 80),
      // Admin local só faz sentido para computador.
      admin_local:
        tipo.rows[0].categoria === "computador" && typeof body.admin_local === "boolean"
          ? body.admin_local
          : null,
      data_aquisicao: lerData(body.data_aquisicao, "Data de aquisição"),
      valor_aquisicao: valor,
      fornecedor: lerTexto(body.fornecedor, 120),
      nota_fiscal: lerTexto(body.nota_fiscal, 60),
      garantia_ate: lerData(body.garantia_ate, "Garantia"),
      observacao: lerTexto(body.observacao, 2000),
    };
    if (!dados.marca && !dados.modelo) {
      throw new HttpError(400, "Informe a marca ou o modelo.");
    }
    return dados;
  };

  const log = (req, detalhes) =>
    logActivity(req.user.id, req.user.email, "Inventário de TI", detalhes, req.ipAddress);

  // ── Tipos ────────────────────────────────────────────────────────────────
  router.get("/types", ...podeVer, async (req, res) => {
    try {
      const r = await pool.query(
        "SELECT id, nome, categoria FROM it_asset_types ORDER BY id",
      );
      res.json(r.rows);
    } catch (err) {
      responderErro(res, err, "tipos");
    }
  });

  // ── Meus equipamentos (qualquer usuário logado) ──────────────────────────
  router.get("/mine", isLoggedIn, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT a.id, t.nome AS tipo_nome, t.categoria, a.patrimonio, a.marca,
                a.modelo, a.numero_serie, a.status,
                to_char(a.responsavel_desde, 'YYYY-MM-DD') AS responsavel_desde
           FROM it_assets a
           JOIN it_asset_types t ON t.id = a.type_id
          WHERE a.user_id = $1
          ORDER BY a.responsavel_desde DESC NULLS LAST, a.id`,
        [req.user.id],
      );
      res.json(r.rows);
    } catch (err) {
      responderErro(res, err, "meus equipamentos");
    }
  });

  // ── Listagem + indicadores ───────────────────────────────────────────────
  router.get("/", ...podeVer, async (req, res) => {
    try {
      const { tipo, status, setor, busca, baixados } = req.query;
      const where = [];
      const params = [];
      const add = (cond, valor) => {
        params.push(valor);
        where.push(cond.replace("?", `$${params.length}`));
      };

      if (lerId(tipo)) add("a.type_id = ?", lerId(tipo));
      if (status && STATUS_ROTULO[status]) add("a.status = ?", status);
      else if (baixados !== "1") where.push("a.status <> 'baixado'");
      if (lerId(setor)) add("COALESCE(a.setor_id, u.setor_id) = ?", lerId(setor));
      if (busca && String(busca).trim()) {
        params.push(`%${escapeLike(String(busca).trim())}%`);
        const i = params.length;
        where.push(`(a.patrimonio ILIKE $${i} OR a.marca ILIKE $${i}
                     OR a.modelo ILIKE $${i} OR a.numero_serie ILIKE $${i}
                     OR u.nome ILIKE $${i} OR sa.nome ILIKE $${i})`);
      }

      const lista = await pool.query(
        `${SELECT_ATIVO}
         ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
         ORDER BY a.patrimonio NULLS LAST, a.id`,
        params,
      );

      // Indicadores: respeitam só o tipo (a aba), não os demais filtros —
      // assim os números do topo não mudam enquanto se busca na tabela.
      const kpiParams = [];
      let kpiWhere = "status <> 'baixado'";
      if (lerId(tipo)) {
        kpiParams.push(lerId(tipo));
        kpiWhere += " AND type_id = $1";
      }
      const kpis = await pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'em_uso')::int AS em_uso,
                COUNT(*) FILTER (WHERE status = 'disponivel')::int AS disponiveis,
                COUNT(*) FILTER (WHERE status = 'manutencao')::int AS manutencao
           FROM it_assets
          WHERE ${kpiWhere}`,
        kpiParams,
      );

      res.json({ assets: lista.rows, kpis: kpis.rows[0] });
    } catch (err) {
      responderErro(res, err, "listagem");
    }
  });

  // ── Detalhe + histórico ──────────────────────────────────────────────────
  router.get("/:id", ...podeVer, async (req, res) => {
    try {
      const id = lerId(req.params.id);
      if (!id) throw new HttpError(404, "Ativo não encontrado.");
      const ativo = await buscarAtivo(pool, id);
      if (!ativo) throw new HttpError(404, "Ativo não encontrado.");
      const eventos = await pool.query(
        `SELECT id, tipo, user_id, colaborador_nome, setor_nome, detalhes,
                to_char(data_evento, 'YYYY-MM-DD') AS data_evento,
                feito_por_nome, created_at
           FROM it_asset_events
          WHERE asset_id = $1
          ORDER BY id DESC`,
        [id],
      );
      res.json({ ...ativo, eventos: eventos.rows });
    } catch (err) {
      responderErro(res, err, "detalhe");
    }
  });

  // ── Cadastro ─────────────────────────────────────────────────────────────
  router.post("/", ...podeGerir, async (req, res) => {
    try {
      const ativo = await withTransaction(async (client) => {
        const d = await lerCadastro(client, req.body || {});
        const cols = Object.keys(d);
        const r = await client.query(
          `INSERT INTO it_assets (${cols.join(", ")}, status)
           VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")}, 'disponivel')
           RETURNING id`,
          cols.map((c) => d[c]),
        );
        const id = r.rows[0].id;
        await registrarEvento(client, id, { tipo: "cadastro" }, req);
        return buscarAtivo(client, id);
      });
      log(req, `Cadastrou ${descrever(ativo)}.`);
      res.status(201).json(ativo);
    } catch (err) {
      responderErro(res, err, "cadastro");
    }
  });

  // ── Edição dos dados cadastrais (não mexe em status nem responsável) ─────
  router.put("/:id", ...podeGerir, async (req, res) => {
    try {
      const id = lerId(req.params.id);
      if (!id) throw new HttpError(404, "Ativo não encontrado.");
      const ativo = await withTransaction(async (client) => {
        // Lê os valores atuais como texto (datas em AAAA-MM-DD): o pg devolve
        // DATE como Date e NUMERIC como string, e a comparação fica frágil.
        const antes = await client.query(
          `SELECT ${Object.keys(CAMPOS)
            .map((c) =>
              c === "data_aquisicao" || c === "garantia_ate"
                ? `to_char(${c}, 'YYYY-MM-DD') AS ${c}`
                : `${c}::text AS ${c}`,
            )
            .join(", ")}
             FROM it_assets WHERE id = $1 FOR UPDATE`,
          [id],
        );
        if (!antes.rows.length) throw new HttpError(404, "Ativo não encontrado.");
        const d = await lerCadastro(client, req.body || {});

        const igual = (c, a, b) => {
          if (a === null || b === null) return a === null && b === null;
          return c === "valor_aquisicao" ? Number(a) === Number(b) : String(a) === String(b);
        };
        const mudou = Object.keys(CAMPOS).filter(
          (c) => !igual(c, antes.rows[0][c], d[c]),
        );
        if (mudou.length) {
          const cols = Object.keys(d);
          await client.query(
            `UPDATE it_assets
                SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(", ")},
                    updated_at = NOW()
              WHERE id = $${cols.length + 1}`,
            [...cols.map((c) => d[c]), id],
          );
          await registrarEvento(
            client,
            id,
            { tipo: "edicao", detalhes: `Alterou: ${mudou.map((c) => CAMPOS[c]).join(", ")}.` },
            req,
          );
        }
        return buscarAtivo(client, id);
      });
      log(req, `Editou ${descrever(ativo)}.`);
      res.json(ativo);
    } catch (err) {
      responderErro(res, err, "edição");
    }
  });

  // ── Exclusão: só de ativo sem movimentação (cadastrado por engano) ───────
  router.delete("/:id", ...podeGerir, async (req, res) => {
    try {
      const id = lerId(req.params.id);
      if (!id) throw new HttpError(404, "Ativo não encontrado.");
      const ativo = await withTransaction(async (client) => {
        const a = await buscarAtivo(client, id);
        if (!a) throw new HttpError(404, "Ativo não encontrado.");
        const mov = await client.query(
          `SELECT 1 FROM it_asset_events
            WHERE asset_id = $1 AND tipo NOT IN ('cadastro', 'edicao') LIMIT 1`,
          [id],
        );
        if (mov.rows.length || a.status !== "disponivel") {
          throw new HttpError(
            409,
            "Este ativo já tem movimentações. Para tirá-lo do inventário, use a baixa.",
          );
        }
        await client.query("DELETE FROM it_assets WHERE id = $1", [id]);
        return a;
      });
      log(req, `Excluiu ${descrever(ativo)}.`);
      res.json({ success: true });
    } catch (err) {
      responderErro(res, err, "exclusão");
    }
  });

  // ── Movimentações ────────────────────────────────────────────────────────
  // Cada uma: trava o ativo, valida a transição, atualiza e grava o evento
  // na mesma transação. Notificações e log só depois do COMMIT.

  router.post("/:id/entregar", ...podeGerir, async (req, res) => {
    try {
      const id = lerId(req.params.id);
      if (!id) throw new HttpError(404, "Ativo não encontrado.");
      const body = req.body || {};
      const { ativo, resp } = await withTransaction(async (client) => {
        const atual = await travarParaAcao(client, id, "entregar");
        const resp = await lerResponsavel(client, body);
        const data = lerDataEvento(body.data, atual.ultima_data);
        await client.query(
          `UPDATE it_assets
              SET status = 'em_uso', user_id = $1, setor_id = $2,
                  responsavel_desde = $3, updated_at = NOW()
            WHERE id = $4`,
          [resp.userId, resp.setorId, data, id],
        );
        await registrarEvento(
          client,
          id,
          {
            tipo: "entrega",
            userId: resp.userId,
            colaboradorNome: resp.userId ? resp.nome : null,
            setorId: resp.setorId,
            setorNome: resp.setorId ? resp.nome : null,
            detalhes: lerTexto(body.observacao),
            data,
          },
          req,
        );
        return { ativo: await buscarAtivo(client, id), resp };
      });
      if (resp.userId) {
        createNotification(
          resp.userId,
          `O equipamento ${descrever(ativo)} foi entregue a você.`,
          "/perfil",
        );
      }
      log(req, `Entregou ${descrever(ativo)} a ${resp.nome}${resp.setorId ? " (setor)" : ""}.`);
      res.json(ativo);
    } catch (err) {
      responderErro(res, err, "entrega");
    }
  });

  router.post("/:id/devolver", ...podeGerir, async (req, res) => {
    try {
      const id = lerId(req.params.id);
      if (!id) throw new HttpError(404, "Ativo não encontrado.");
      const body = req.body || {};
      const comDefeito = body.condicao === "defeito";
      const { ativo, anterior } = await withTransaction(async (client) => {
        const atual = await travarParaAcao(client, id, "devolver");
        const anterior = await nomeResponsavelAtual(client, atual);
        const data = lerDataEvento(body.data, atual.ultima_data);
        const obs = lerTexto(body.observacao);
        await client.query(
          `UPDATE it_assets
              SET status = $1, user_id = NULL, setor_id = NULL,
                  responsavel_desde = NULL, updated_at = NOW()
            WHERE id = $2`,
          [comDefeito ? "manutencao" : "disponivel", id],
        );
        await registrarEvento(
          client,
          id,
          {
            tipo: "devolucao",
            ...anterior,
            detalhes: [comDefeito ? "Devolvido com defeito." : null, obs]
              .filter(Boolean)
              .join(" ") || null,
            data,
          },
          req,
        );
        // Com defeito, já segue para manutenção — dois eventos, porque são
        // dois fatos: a devolução pela pessoa e a entrada na manutenção.
        if (comDefeito) {
          await registrarEvento(
            client,
            id,
            { tipo: "manutencao", detalhes: "Enviado após devolução com defeito.", data },
            req,
          );
        }
        return { ativo: await buscarAtivo(client, id), anterior };
      });
      if (anterior.userId) {
        createNotification(
          anterior.userId,
          `A devolução do equipamento ${descrever(ativo)} foi registrada.`,
          "/perfil",
        );
      }
      log(req, `Registrou a devolução de ${descrever(ativo)}.`);
      res.json(ativo);
    } catch (err) {
      responderErro(res, err, "devolução");
    }
  });

  router.post("/:id/transferir", ...podeGerir, async (req, res) => {
    try {
      const id = lerId(req.params.id);
      if (!id) throw new HttpError(404, "Ativo não encontrado.");
      const body = req.body || {};
      const { ativo, anterior, resp } = await withTransaction(async (client) => {
        const atual = await travarParaAcao(client, id, "transferir");
        const resp = await lerResponsavel(client, body);
        if (
          (resp.userId && resp.userId === atual.user_id) ||
          (resp.setorId && resp.setorId === atual.setor_id)
        ) {
          throw new HttpError(400, "O ativo já está com este responsável.");
        }
        const anterior = await nomeResponsavelAtual(client, atual);
        const data = lerDataEvento(body.data, atual.ultima_data);
        await client.query(
          `UPDATE it_assets
              SET user_id = $1, setor_id = $2, responsavel_desde = $3,
                  updated_at = NOW()
            WHERE id = $4`,
          [resp.userId, resp.setorId, data, id],
        );
        const de = anterior.colaboradorNome || anterior.setorNome || "—";
        await registrarEvento(
          client,
          id,
          {
            tipo: "transferencia",
            userId: resp.userId,
            colaboradorNome: resp.userId ? resp.nome : null,
            setorId: resp.setorId,
            setorNome: resp.setorId ? resp.nome : null,
            detalhes: [`Transferido de ${de}.`, lerTexto(body.observacao)]
              .filter(Boolean)
              .join(" "),
            data,
          },
          req,
        );
        return { ativo: await buscarAtivo(client, id), anterior, resp };
      });
      if (anterior.userId) {
        createNotification(
          anterior.userId,
          `O equipamento ${descrever(ativo)} foi transferido e não está mais com você.`,
          "/perfil",
        );
      }
      if (resp.userId) {
        createNotification(
          resp.userId,
          `O equipamento ${descrever(ativo)} foi entregue a você.`,
          "/perfil",
        );
      }
      log(req, `Transferiu ${descrever(ativo)} para ${resp.nome}.`);
      res.json(ativo);
    } catch (err) {
      responderErro(res, err, "transferência");
    }
  });

  router.post("/:id/manutencao", ...podeGerir, async (req, res) => {
    try {
      const id = lerId(req.params.id);
      if (!id) throw new HttpError(404, "Ativo não encontrado.");
      const body = req.body || {};
      const motivo = lerTexto(body.motivo);
      if (!motivo) throw new HttpError(400, "Informe o motivo da manutenção.");
      const ativo = await withTransaction(async (client) => {
        const atual = await travarParaAcao(client, id, "manutencao");
        const data = lerDataEvento(body.data, atual.ultima_data);
        // O responsável continua registrado: no retorno, o ativo volta
        // para ele.
        await client.query(
          "UPDATE it_assets SET status = 'manutencao', updated_at = NOW() WHERE id = $1",
          [id],
        );
        const assistencia = lerTexto(body.fornecedor, 120);
        await registrarEvento(
          client,
          id,
          {
            tipo: "manutencao",
            detalhes: [motivo, assistencia ? `Assistência: ${assistencia}.` : null]
              .filter(Boolean)
              .join(" "),
            data,
          },
          req,
        );
        return buscarAtivo(client, id);
      });
      log(req, `Enviou ${descrever(ativo)} para manutenção.`);
      res.json(ativo);
    } catch (err) {
      responderErro(res, err, "manutenção");
    }
  });

  router.post("/:id/retorno", ...podeGerir, async (req, res) => {
    try {
      const id = lerId(req.params.id);
      if (!id) throw new HttpError(404, "Ativo não encontrado.");
      const body = req.body || {};
      const ativo = await withTransaction(async (client) => {
        const atual = await travarParaAcao(client, id, "retorno");
        const data = lerDataEvento(body.data, atual.ultima_data);
        const comResponsavel = atual.user_id || atual.setor_id;
        await client.query(
          "UPDATE it_assets SET status = $1, updated_at = NOW() WHERE id = $2",
          [comResponsavel ? "em_uso" : "disponivel", id],
        );
        await registrarEvento(
          client,
          id,
          {
            tipo: "retorno",
            ...(comResponsavel ? await nomeResponsavelAtual(client, atual) : {}),
            detalhes: lerTexto(body.detalhes),
            data,
          },
          req,
        );
        return buscarAtivo(client, id);
      });
      log(req, `Registrou o retorno da manutenção de ${descrever(ativo)}.`);
      res.json(ativo);
    } catch (err) {
      responderErro(res, err, "retorno");
    }
  });

  router.post("/:id/baixa", ...podeGerir, async (req, res) => {
    try {
      const id = lerId(req.params.id);
      if (!id) throw new HttpError(404, "Ativo não encontrado.");
      const body = req.body || {};
      if (!MOTIVOS_BAIXA.includes(body.motivo)) {
        throw new HttpError(400, "Informe o motivo da baixa.");
      }
      const MOTIVO_ROTULO = {
        descarte: "Descarte",
        venda: "Venda",
        perda: "Perda",
        roubo: "Roubo/furto",
        doacao: "Doação",
        outro: "Outro",
      };
      const { ativo, anterior } = await withTransaction(async (client) => {
        const atual = await travarParaAcao(client, id, "baixa");
        const anterior = await nomeResponsavelAtual(client, atual);
        const data = lerDataEvento(body.data, atual.ultima_data);
        await client.query(
          `UPDATE it_assets
              SET status = 'baixado', user_id = NULL, setor_id = NULL,
                  responsavel_desde = NULL, updated_at = NOW()
            WHERE id = $1`,
          [id],
        );
        await registrarEvento(
          client,
          id,
          {
            tipo: "baixa",
            ...anterior,
            detalhes: [`Motivo: ${MOTIVO_ROTULO[body.motivo]}.`, lerTexto(body.observacao)]
              .filter(Boolean)
              .join(" "),
            data,
          },
          req,
        );
        return { ativo: await buscarAtivo(client, id), anterior };
      });
      if (anterior.userId) {
        createNotification(
          anterior.userId,
          `O equipamento ${descrever(ativo)} foi baixado do inventário e não está mais com você.`,
          "/perfil",
        );
      }
      log(req, `Deu baixa em ${descrever(ativo)} (${MOTIVO_ROTULO[body.motivo]}).`);
      res.json(ativo);
    } catch (err) {
      responderErro(res, err, "baixa");
    }
  });

  return router;
};
