import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiEdit, FiPlus, FiUsers, FiTool } from "react-icons/fi";
import { MdRefresh, MdOutlineInventory2 } from "react-icons/md";
import { HiOutlineCheckCircle, HiOutlineUserCircle } from "react-icons/hi";
import api from "../../api.ts";
import { safeStorage } from "../../utils/safeStorage.ts";
import { useAuth } from "../../context/AuthContext.tsx";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import LoadingSpinner from "../../components/ui/LoadingSpinner.tsx";
import AssetFormModal from "../../components/itAssets/AssetFormModal.tsx";
import AssetActionModal from "../../components/itAssets/AssetActionModal.tsx";
import AssetDetailModal from "../../components/itAssets/AssetDetailModal.tsx";
import {
  Acao,
  ACAO_CONFIG,
  Asset,
  AssetStatus,
  AssetType,
  STATUS_CONFIG,
  iconeDoTipo,
  iniciais,
  nomeDoAtivo,
} from "../../components/itAssets/assetConfig.ts";

interface Kpis {
  total: number;
  em_uso: number;
  disponiveis: number;
  manutencao: number;
}

interface Lookup {
  id: number;
  nome: string;
}

type SortKey = "patrimonio" | "modelo" | "responsavel" | "setor" | "status";

// Ação rápida da linha, conforme o status. As demais ficam no detalhe.
const ACAO_RAPIDA: Partial<Record<AssetStatus, Acao>> = {
  disponivel: "entregar",
  em_uso: "devolver",
  manutencao: "retorno",
};

// Opções de itens por página. A escolha fica salva no navegador de quem usa.
const LIMITES = [10, 25, 50, 100];
const LIMITE_PADRAO = 25;
const CHAVE_LIMITE = "inventario-ti:por-pagina";

const limiteSalvo = () => {
  const n = Number(safeStorage.get(CHAVE_LIMITE));
  return LIMITES.includes(n) ? n : LIMITE_PADRAO;
};

const ORDEM_STATUS: Record<AssetStatus, number> = {
  em_uso: 0,
  disponivel: 1,
  manutencao: 2,
  baixado: 3,
};

const ITInventory: React.FC = () => {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("it_assets.manage");

  const [tipos, setTipos] = useState<AssetType[]>([]);
  const [setores, setSetores] = useState<Lookup[]>([]);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Filtros. A busca tem um estado digitado e um aplicado (com atraso), para
  // não chamar a API a cada tecla.
  const [tipo, setTipo] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [setor, setSetor] = useState("");
  const [buscaInput, setBuscaInput] = useState("");
  const [busca, setBusca] = useState("");
  const [baixados, setBaixados] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({
    key: "patrimonio",
    asc: true,
  });
  const [porPagina, setPorPagina] = useState(limiteSalvo);
  const [pagina, setPagina] = useState(1);

  // Modais
  const [formAsset, setFormAsset] = useState<Asset | null | undefined>(undefined);
  const [acao, setAcao] = useState<{ asset: Asset; acao: Acao } | null>(null);
  const [detalheId, setDetalheId] = useState<number | null>(null);
  const [versaoDetalhe, setVersaoDetalhe] = useState(0);

  useEffect(() => {
    api.get("/api/it-assets/types").then((r) => setTipos(r.data)).catch(() => {});
    api.get("/api/setores").then((r) => setSetores(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setBusca(buscaInput.trim()), 300);
    return () => clearTimeout(t);
  }, [buscaInput]);

  const carregar = useCallback(async () => {
    try {
      const res = await api.get("/api/it-assets", {
        params: {
          tipo: tipo || undefined,
          status: status || undefined,
          setor: setor || undefined,
          busca: busca || undefined,
          baixados: baixados ? "1" : undefined,
        },
      });
      setAssets(res.data.assets);
      setKpis(res.data.kpis);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [tipo, status, setor, busca, baixados]);

  useEffect(() => {
    carregar().finally(() => setLoading(false));
  }, [carregar]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await carregar();
    setRefreshing(false);
  };

  // Depois de salvar/movimentar: atualiza a lista e o detalhe aberto.
  const aposMudanca = () => {
    carregar();
    setVersaoDetalhe((v) => v + 1);
  };

  const ordenados = useMemo(() => {
    const valor = (a: Asset): string | number => {
      switch (sort.key) {
        case "patrimonio":
          return a.patrimonio ?? "￿"; // sem patrimônio vai para o fim
        case "modelo":
          return nomeDoAtivo(a).toLowerCase();
        case "responsavel":
          return (a.responsavel_nome || (a.compartilhado ? a.setor_nome : "") || "￿").toLowerCase();
        case "setor":
          return (a.setor_nome || "￿").toLowerCase();
        case "status":
          return ORDEM_STATUS[a.status];
      }
    };
    return [...assets].sort((a, b) => {
      const va = valor(a);
      const vb = valor(b);
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "pt-BR", { numeric: true });
      return sort.asc ? cmp : -cmp;
    });
  }, [assets, sort]);

  // Paginação no cliente: a API já devolve a lista filtrada inteira (o
  // inventário tem dezenas de itens, não milhares).
  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * porPagina;
  const visiveis = ordenados.slice(inicio, inicio + porPagina);

  // Filtro, aba, ordenação ou limite novos: volta para a primeira página.
  useEffect(() => {
    setPagina(1);
  }, [tipo, status, setor, busca, baixados, sort, porPagina]);

  const mudarLimite = (n: number) => {
    setPorPagina(n);
    safeStorage.set(CHAVE_LIMITE, String(n));
  };

  const sugestoes = useMemo(() => {
    const unicos = (lista: (string | null)[]) =>
      Array.from(new Set(lista.filter(Boolean) as string[])).sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      );
    return {
      marcas: unicos(assets.map((a) => a.marca)),
      modelos: unicos(assets.map((a) => a.modelo)),
    };
  }, [assets]);

  const ordenarPor = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, asc: !s.asc } : { key, asc: true }));

  const cabecalho = (key: SortKey, rotulo: string) => (
    <th
      className="sortable-header"
      onClick={() => ordenarPor(key)}
      aria-sort={sort.key === key ? (sort.asc ? "ascending" : "descending") : "none"}
    >
      {rotulo}
      {sort.key === key && (sort.asc ? " ↑" : " ↓")}
    </th>
  );

  const temFiltro = status || setor || busca || baixados;

  if (loading) return <LoadingSpinner />;

  const cards = kpis
    ? [
        { rotulo: "Total de ativos", valor: kpis.total, Icon: MdOutlineInventory2 },
        { rotulo: "Em uso", valor: kpis.em_uso, Icon: HiOutlineUserCircle },
        { rotulo: "Disponíveis", valor: kpis.disponiveis, Icon: HiOutlineCheckCircle },
        { rotulo: "Em manutenção", valor: kpis.manutencao, Icon: FiTool },
      ]
    : [];

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="page-container">
          <div className="page-header">
            <h1 className="page-title">Inventário de TI</h1>
            <div className="page-actions">
              <button
                className="form-icon-edit"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <MdRefresh />
                {refreshing ? "Atualizando..." : "Atualizar"}
              </button>
              {canManage && (
                <button
                  className="form-button form-button--add btn-icon-text"
                  onClick={() => setFormAsset(null)}
                >
                  <FiPlus />
                  Novo ativo
                </button>
              )}
            </div>
          </div>

          <div className="inv-kpis">
            {cards.map((c) => (
              <div key={c.rotulo} className="stat-card">
                <div className="stat-icon">
                  <c.Icon />
                </div>
                <div className="stat-info">
                  <h3>{c.valor}</h3>
                  <p>{c.rotulo}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="tabs inv-tabs" role="tablist">
            {[{ id: null as number | null, nome: "Todos" }, ...tipos].map((t) => (
              <button
                key={t.nome}
                role="tab"
                aria-selected={tipo === t.id}
                className={`tab-item ${tipo === t.id ? "active" : ""}`}
                onClick={() => setTipo(t.id)}
              >
                {t.nome}
              </button>
            ))}
          </div>

          <div className="page-filters inv-filters">
            <div className="filter-group">
              <label className="filter-label" htmlFor="inv-busca">
                Busca
              </label>
              <input
                id="inv-busca"
                type="text"
                className="form-input"
                placeholder="Patrimônio, modelo, série ou nome"
                value={buscaInput}
                onChange={(e) => setBuscaInput(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label className="filter-label" htmlFor="inv-f-status">
                Status
              </label>
              <select
                id="inv-f-status"
                className="form-select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">Todos os status</option>
                {(Object.keys(STATUS_CONFIG) as AssetStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_CONFIG[s].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label className="filter-label" htmlFor="inv-f-setor">
                Setor
              </label>
              <select
                id="inv-f-setor"
                className="form-select"
                value={setor}
                onChange={(e) => setSetor(e.target.value)}
              >
                <option value="">Todos os setores</option>
                {setores.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>
            <label className="inv-check">
              <input
                type="checkbox"
                checked={baixados}
                onChange={(e) => setBaixados(e.target.checked)}
                disabled={status !== ""}
              />
              Mostrar baixados
            </label>
          </div>

          {loadError ? (
            <p className="inv-empty">
              Não foi possível carregar o inventário. Tente novamente.
            </p>
          ) : (
            <div className="table-container inv-table">
              <table className="admin-table">
                <thead>
                  <tr>
                    {cabecalho("patrimonio", "Patrimônio")}
                    {cabecalho("modelo", "Equipamento")}
                    {cabecalho("responsavel", "Responsável")}
                    {cabecalho("setor", "Setor")}
                    {cabecalho("status", "Status")}
                    {canManage && <th className="inv-th-actions">Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {ordenados.length === 0 ? (
                    <tr>
                      <td colSpan={canManage ? 6 : 5} className="stats-empty-cell">
                        {temFiltro
                          ? "Nenhum ativo com esses filtros."
                          : "Nenhum ativo cadastrado ainda."}
                      </td>
                    </tr>
                  ) : (
                    visiveis.map((a) => {
                      const TipoIcon = iconeDoTipo(a.categoria);
                      const st = STATUS_CONFIG[a.status];
                      const rapida = ACAO_RAPIDA[a.status];
                      return (
                        <tr
                          key={a.id}
                          className="inv-row"
                          onClick={() => setDetalheId(a.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") setDetalheId(a.id);
                          }}
                          tabIndex={0}
                        >
                          <td data-label="Patrimônio">
                            {a.patrimonio ? (
                              <span className="inv-patrimonio">{a.patrimonio}</span>
                            ) : (
                              <span className="inv-muted">Sem patrimônio</span>
                            )}
                          </td>
                          <td data-label="Equipamento">
                            <span className="inv-equip">
                              <TipoIcon className="inv-equip-icon" title={a.tipo_nome} />
                              {nomeDoAtivo(a)}
                            </span>
                          </td>
                          <td data-label="Responsável">
                            {a.responsavel_nome ? (
                              <span className="inv-person">
                                {a.responsavel_foto ? (
                                  <img src={a.responsavel_foto} alt="" className="inv-avatar" />
                                ) : (
                                  <span className="inv-avatar inv-avatar--initials" aria-hidden="true">
                                    {iniciais(a.responsavel_nome)}
                                  </span>
                                )}
                                {a.responsavel_nome}
                              </span>
                            ) : a.compartilhado ? (
                              <span className="inv-person inv-muted">
                                <FiUsers aria-hidden="true" /> Compartilhado
                              </span>
                            ) : (
                              <span className="inv-muted">—</span>
                            )}
                          </td>
                          <td data-label="Setor">{a.setor_nome || <span className="inv-muted">—</span>}</td>
                          <td data-label="Status">
                            <span
                              className="inv-status"
                              style={{ "--status-color": st.color } as React.CSSProperties}
                            >
                              {st.label}
                            </span>
                          </td>
                          {canManage && (
                            <td data-label="Ações" onClick={(e) => e.stopPropagation()}>
                              <div className="inv-row-actions">
                                {rapida && (
                                  <button
                                    type="button"
                                    className="inv-quick-btn"
                                    onClick={() => setAcao({ asset: a, acao: rapida })}
                                    title={ACAO_CONFIG[rapida].titulo}
                                  >
                                    {React.createElement(ACAO_CONFIG[rapida].Icon, {
                                      "aria-hidden": true,
                                    })}
                                    {ACAO_CONFIG[rapida].label}
                                  </button>
                                )}
                                {a.status !== "baixado" && (
                                  <button
                                    type="button"
                                    className="form-icon-edit"
                                    onClick={() => setFormAsset(a)}
                                    aria-label={`Editar ${nomeDoAtivo(a)}`}
                                    title="Editar dados"
                                  >
                                    <FiEdit />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {!loadError && ordenados.length > 0 && (
            <div className="pagination-controls inv-pagination">
              <div className="inv-pagination-info">
                <span>
                  {inicio + 1}–{inicio + visiveis.length} de {ordenados.length}{" "}
                  {ordenados.length === 1 ? "ativo" : "ativos"}
                </span>
                <label className="limit-selector">
                  Itens por página
                  <select
                    className="form-select"
                    value={porPagina}
                    onChange={(e) => mudarLimite(Number(e.target.value))}
                  >
                    {LIMITES.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="inv-pagination-nav">
                <span>
                  Página {paginaAtual} de {totalPaginas}
                </span>
                <button
                  type="button"
                  onClick={() => setPagina(paginaAtual - 1)}
                  disabled={paginaAtual === 1}
                  className="list-button"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setPagina(paginaAtual + 1)}
                  disabled={paginaAtual === totalPaginas}
                  className="list-button"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />

      {detalheId !== null && (
        <AssetDetailModal
          assetId={detalheId}
          canManage={canManage}
          versao={versaoDetalhe}
          onClose={() => setDetalheId(null)}
          onAction={(asset, a) => setAcao({ asset, acao: a })}
          onEdit={(asset) => setFormAsset(asset)}
          onDeleted={() => {
            setDetalheId(null);
            carregar();
          }}
        />
      )}

      {formAsset !== undefined && (
        <AssetFormModal
          asset={formAsset}
          tipos={tipos}
          tipoInicial={tipo}
          sugestoes={sugestoes}
          onClose={() => setFormAsset(undefined)}
          onSaved={(salvo) => {
            const novo = formAsset === null;
            setFormAsset(undefined);
            aposMudanca();
            // Cadastro novo: abre o detalhe, de onde se faz a entrega.
            if (novo) setDetalheId(salvo.id);
          }}
        />
      )}

      {acao && (
        <AssetActionModal
          asset={acao.asset}
          acao={acao.acao}
          onClose={() => setAcao(null)}
          onDone={() => {
            setAcao(null);
            aposMudanca();
          }}
        />
      )}
    </div>
  );
};

export default ITInventory;
