import React, { useEffect, useMemo, useState } from "react";
import Select, { SingleValue } from "react-select";
import toast from "react-hot-toast";
import api from "../../api.ts";
import Modal from "../ui/Modal.tsx";
import DatePicker from "../forms/DatePicker.tsx";
import {
  Acao,
  ACAO_CONFIG,
  Asset,
  Opcao,
  hojeISO,
  nomeDoAtivo,
  useSelectStyles,
} from "./assetConfig.ts";

interface AssetActionModalProps {
  asset: Asset;
  acao: Acao;
  onClose: () => void;
  onDone: (asset: Asset) => void;
}

const MOTIVOS_BAIXA = [
  { value: "descarte", label: "Descarte" },
  { value: "venda", label: "Venda" },
  { value: "perda", label: "Perda" },
  { value: "roubo", label: "Roubo/furto" },
  { value: "doacao", label: "Doação" },
  { value: "outro", label: "Outro" },
];

// Um modal para todas as movimentações: os campos mudam conforme a ação.
const AssetActionModal: React.FC<AssetActionModalProps> = ({
  asset,
  acao,
  onClose,
  onDone,
}) => {
  const selectStyles = useSelectStyles();
  const precisaResponsavel = acao === "entregar" || acao === "transferir";

  const [alvo, setAlvo] = useState<"pessoa" | "setor">("pessoa");
  const [pessoas, setPessoas] = useState<Opcao[]>([]);
  const [setores, setSetores] = useState<Opcao[]>([]);
  const [pessoa, setPessoa] = useState<Opcao | null>(null);
  const [setor, setSetor] = useState<Opcao | null>(null);
  const [data, setData] = useState(hojeISO());
  const [observacao, setObservacao] = useState("");
  const [condicao, setCondicao] = useState<"ok" | "defeito">("ok");
  const [motivo, setMotivo] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!precisaResponsavel) return;
    api
      .get("/api/users/internal")
      .then((res) =>
        setPessoas(
          (res.data as { id: number; nome: string }[])
            .map((u) => ({ value: u.id, label: u.nome }))
            .sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
        ),
      )
      .catch(() => toast.error("Não foi possível carregar os colaboradores."));
    api
      .get("/api/setores")
      .then((res) =>
        setSetores(
          (res.data as { id: number; nome: string }[]).map((s) => ({
            value: s.id,
            label: s.nome,
          })),
        ),
      )
      .catch(() => toast.error("Não foi possível carregar os setores."));
  }, [precisaResponsavel]);

  // Na transferência, o responsável atual não aparece como opção.
  const opcoesPessoa = useMemo(
    () =>
      acao === "transferir" ? pessoas.filter((p) => p.value !== asset.user_id) : pessoas,
    [acao, pessoas, asset.user_id],
  );
  const opcoesSetor = useMemo(
    () =>
      acao === "transferir" ? setores.filter((s) => s.value !== asset.setor_id) : setores,
    [acao, setores, asset.setor_id],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const corpo: Record<string, unknown> = { data };

    if (precisaResponsavel) {
      if (alvo === "pessoa" && !pessoa) return void toast.error("Escolha o colaborador.");
      if (alvo === "setor" && !setor) return void toast.error("Escolha o setor.");
      if (alvo === "pessoa") corpo.user_id = pessoa!.value;
      else corpo.setor_id = setor!.value;
      corpo.observacao = observacao;
    } else if (acao === "devolver") {
      corpo.condicao = condicao;
      corpo.observacao = observacao;
    } else if (acao === "manutencao") {
      if (!motivo.trim()) return void toast.error("Informe o motivo da manutenção.");
      corpo.motivo = motivo;
      corpo.fornecedor = fornecedor;
    } else if (acao === "retorno") {
      corpo.detalhes = observacao;
    } else if (acao === "baixa") {
      if (!motivo) return void toast.error("Escolha o motivo da baixa.");
      corpo.motivo = motivo;
      corpo.observacao = observacao;
    }

    setEnviando(true);
    try {
      const res = await api.post(`/api/it-assets/${asset.id}/${acao}`, corpo);
      toast.success(`${ACAO_CONFIG[acao].titulo}: registrado.`);
      onDone(res.data as Asset);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Não foi possível registrar.");
    } finally {
      setEnviando(false);
    }
  };

  const portal = typeof document !== "undefined" ? document.body : undefined;
  const responsavelAtual = asset.responsavel_nome || (asset.compartilhado ? asset.setor_nome : null);

  return (
    <Modal onClose={onClose} title={ACAO_CONFIG[acao].titulo}>
      <form onSubmit={handleSubmit} className="modal-body">
        <p className="inv-action-subject">
          <strong>{nomeDoAtivo(asset)}</strong>
          <span>{asset.patrimonio ? `Patrimônio ${asset.patrimonio}` : "Sem patrimônio"}</span>
          {responsavelAtual && <span>Com: {responsavelAtual}</span>}
        </p>

        {precisaResponsavel && (
          <>
            <div className="inv-toggle" role="group" aria-label="Entregar para">
              <button
                type="button"
                className={`inv-toggle-btn${alvo === "pessoa" ? " inv-toggle-btn--active" : ""}`}
                aria-pressed={alvo === "pessoa"}
                onClick={() => setAlvo("pessoa")}
              >
                Um colaborador
              </button>
              <button
                type="button"
                className={`inv-toggle-btn${alvo === "setor" ? " inv-toggle-btn--active" : ""}`}
                aria-pressed={alvo === "setor"}
                onClick={() => setAlvo("setor")}
              >
                Um setor (compartilhado)
              </button>
            </div>

            <div className="inv-field">
              <label htmlFor="inv-alvo">
                {alvo === "pessoa" ? "Colaborador" : "Setor"}
              </label>
              {alvo === "pessoa" ? (
                <Select<Opcao>
                  inputId="inv-alvo"
                  options={opcoesPessoa}
                  value={pessoa}
                  onChange={(o: SingleValue<Opcao>) => setPessoa(o)}
                  styles={selectStyles}
                  placeholder="Digite para buscar…"
                  noOptionsMessage={() => "Ninguém encontrado"}
                  isClearable
                  menuPortalTarget={portal}
                  menuPosition="fixed"
                />
              ) : (
                <Select<Opcao>
                  inputId="inv-alvo"
                  options={opcoesSetor}
                  value={setor}
                  onChange={(o: SingleValue<Opcao>) => setSetor(o)}
                  styles={selectStyles}
                  placeholder="Escolha o setor…"
                  noOptionsMessage={() => "Nenhum setor encontrado"}
                  isClearable
                  menuPortalTarget={portal}
                  menuPosition="fixed"
                />
              )}
            </div>
          </>
        )}

        {acao === "devolver" && (
          <fieldset className="inv-fieldset">
            <legend>Condição do equipamento</legend>
            <label className="inv-radio">
              <input
                type="radio"
                name="condicao"
                checked={condicao === "ok"}
                onChange={() => setCondicao("ok")}
              />
              Em bom estado — volta como disponível
            </label>
            <label className="inv-radio">
              <input
                type="radio"
                name="condicao"
                checked={condicao === "defeito"}
                onChange={() => setCondicao("defeito")}
              />
              Com defeito — segue para manutenção
            </label>
          </fieldset>
        )}

        {acao === "manutencao" && (
          <>
            <div className="inv-field">
              <label htmlFor="inv-motivo">Motivo</label>
              <textarea
                id="inv-motivo"
                className="form-input"
                rows={3}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: tela trincada, bateria não carrega"
                maxLength={500}
                required
              />
            </div>
            <div className="inv-field">
              <label htmlFor="inv-assistencia">Assistência / fornecedor</label>
              <input
                id="inv-assistencia"
                className="form-input"
                value={fornecedor}
                onChange={(e) => setFornecedor(e.target.value)}
                maxLength={120}
              />
            </div>
            {asset.status === "em_uso" && (
              <p className="inv-hint">
                O responsável continua registrado: no retorno, o equipamento volta
                para ele.
              </p>
            )}
          </>
        )}

        {acao === "baixa" && (
          <div className="inv-field">
            <label htmlFor="inv-motivo-baixa">Motivo da baixa</label>
            <select
              id="inv-motivo-baixa"
              className="form-select"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              required
            >
              <option value="">Escolha…</option>
              {MOTIVOS_BAIXA.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="inv-field">
          <label>Data</label>
          <DatePicker value={data} onChange={setData} includeWeekends />
        </div>

        {acao !== "manutencao" && (
          <div className="inv-field">
            <label htmlFor="inv-obs-acao">
              {acao === "retorno" ? "O que foi feito" : "Observação"}
            </label>
            <textarea
              id="inv-obs-acao"
              className="form-input"
              rows={3}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder={
                acao === "entregar" || acao === "transferir"
                  ? "Ex.: entregue com carregador e mochila"
                  : ""
              }
              maxLength={500}
            />
          </div>
        )}

        {acao === "baixa" && (
          <p className="inv-hint inv-hint--danger">
            A baixa é definitiva: o equipamento sai do inventário ativo e fica só
            no histórico.
          </p>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onClose} className="form-button-cancel">
            Cancelar
          </button>
          <button
            type="submit"
            className={acao === "baixa" ? "form-button-delete" : "form-button"}
            disabled={enviando}
          >
            {enviando ? "Registrando..." : ACAO_CONFIG[acao].label}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AssetActionModal;
