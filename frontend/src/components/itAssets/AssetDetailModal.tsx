import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FiEdit, FiTrash2 } from "react-icons/fi";
import api from "../../api.ts";
import Modal from "../ui/Modal.tsx";
import LoadingSpinner from "../ui/LoadingSpinner.tsx";
import ConfirmationModal from "../ui/ConfirmationModal.tsx";
import {
  Acao,
  ACAO_CONFIG,
  ACOES_POR_STATUS,
  AssetDetail,
  EVENTO_CONFIG,
  STATUS_CONFIG,
  dataBR,
  iconeDoTipo,
  moedaBR,
  nomeDoAtivo,
  rotuloNumeroSerie,
} from "./assetConfig.ts";

interface AssetDetailModalProps {
  assetId: number;
  canManage: boolean;
  /** Muda quando uma ação/edição termina, para recarregar o detalhe. */
  versao: number;
  onClose: () => void;
  onAction: (asset: AssetDetail, acao: Acao) => void;
  onEdit: (asset: AssetDetail) => void;
  onDeleted: () => void;
}

const AssetDetailModal: React.FC<AssetDetailModalProps> = ({
  assetId,
  canManage,
  versao,
  onClose,
  onAction,
  onEdit,
  onDeleted,
}) => {
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [erro, setErro] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);

  const carregar = useCallback(() => {
    setErro(false);
    api
      .get(`/api/it-assets/${assetId}`)
      .then((res) => setAsset(res.data as AssetDetail))
      .catch(() => setErro(true));
  }, [assetId]);

  useEffect(() => {
    carregar();
  }, [carregar, versao]);

  const excluir = async () => {
    try {
      await api.delete(`/api/it-assets/${assetId}`);
      toast.success("Ativo excluído.");
      onDeleted();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Não foi possível excluir.");
    } finally {
      setConfirmarExclusao(false);
    }
  };

  if (erro) {
    return (
      <Modal onClose={onClose} title="Ativo" className="modal-wide">
        <p className="inv-empty">Não foi possível carregar este ativo.</p>
      </Modal>
    );
  }

  if (!asset) {
    return (
      <Modal onClose={onClose} className="modal-wide">
        <LoadingSpinner variant="inline" label="Carregando ativo" />
      </Modal>
    );
  }

  const status = STATUS_CONFIG[asset.status];
  const TipoIcon = iconeDoTipo(asset.categoria);
  const acoes = canManage ? ACOES_POR_STATUS[asset.status] : [];
  // Excluir só um ativo sem movimentação: cadastrado por engano.
  const podeExcluir =
    canManage &&
    asset.status === "disponivel" &&
    asset.eventos.every((e) => e.tipo === "cadastro" || e.tipo === "edicao");

  const responsavel = asset.responsavel_nome
    ? asset.responsavel_nome
    : asset.compartilhado
      ? `${asset.setor_nome} (compartilhado)`
      : "—";

  const campos: [string, React.ReactNode][] = [
    ["Tipo", asset.tipo_nome],
    ["Responsável", responsavel],
    ["Desde", dataBR(asset.responsavel_desde)],
    ["Setor", asset.setor_nome || "—"],
    [rotuloNumeroSerie(asset.categoria), asset.numero_serie || "—"],
    ...(asset.categoria === "computador"
      ? ([
          [
            "Admin local",
            asset.admin_local === null ? "—" : asset.admin_local ? "Mantidos" : "Removidos",
          ],
        ] as [string, React.ReactNode][])
      : []),
    ["Garantia até", dataBR(asset.garantia_ate)],
    ["Compra", dataBR(asset.data_aquisicao)],
    ["Valor", moedaBR(asset.valor_aquisicao)],
    ["Fornecedor", asset.fornecedor || "—"],
    ["Nota fiscal", asset.nota_fiscal || "—"],
  ];

  return (
    <>
      <Modal onClose={onClose} className="modal-wide inv-detail">
        <header className="inv-detail-head">
          <span className="inv-detail-icon" aria-hidden="true">
            <TipoIcon />
          </span>
          <div className="inv-detail-title">
            <h2>{nomeDoAtivo(asset)}</h2>
            <span>{asset.patrimonio ? `Patrimônio ${asset.patrimonio}` : "Sem patrimônio"}</span>
          </div>
          <span
            className="inv-status"
            style={{ "--status-color": status.color } as React.CSSProperties}
          >
            {status.label}
          </span>
        </header>

        {(acoes.length > 0 || canManage) && (
          <div className="inv-detail-actions">
            {acoes.map((a) => {
              const { Icon, label } = ACAO_CONFIG[a];
              return (
                <button
                  key={a}
                  type="button"
                  className={`inv-action-btn${a === "baixa" ? " inv-action-btn--danger" : ""}`}
                  onClick={() => onAction(asset, a)}
                >
                  <Icon aria-hidden="true" />
                  {label}
                </button>
              );
            })}
            {canManage && asset.status !== "baixado" && (
              <button type="button" className="inv-action-btn" onClick={() => onEdit(asset)}>
                <FiEdit aria-hidden="true" />
                Editar dados
              </button>
            )}
            {podeExcluir && (
              <button
                type="button"
                className="inv-action-btn inv-action-btn--danger"
                onClick={() => setConfirmarExclusao(true)}
              >
                <FiTrash2 aria-hidden="true" />
                Excluir
              </button>
            )}
          </div>
        )}

        <dl className="inv-detail-grid">
          {campos.map(([rotulo, valor]) => (
            <div key={rotulo} className="inv-detail-item">
              <dt>{rotulo}</dt>
              <dd>{valor}</dd>
            </div>
          ))}
        </dl>

        {asset.observacao && (
          <div className="inv-detail-obs">
            <h3>Observação</h3>
            <p>{asset.observacao}</p>
          </div>
        )}

        <h3 className="inv-form-section">Histórico</h3>
        <ol className="inv-history">
          {asset.eventos.map((ev) => {
            const cfg = EVENTO_CONFIG[ev.tipo];
            const quem = ev.colaborador_nome || ev.setor_nome;
            return (
              <li key={ev.id} className={`inv-history-item inv-history-item--${ev.tipo}`}>
                <span className="inv-history-icon" aria-hidden="true">
                  <cfg.Icon />
                </span>
                <div className="inv-history-body">
                  <p className="inv-history-title">
                    {cfg.label}
                    {quem && (
                      <>
                        {ev.tipo === "devolucao" ? " por " : ev.tipo === "baixa" ? " — estava com " : " para "}
                        <strong>{quem}</strong>
                      </>
                    )}
                  </p>
                  {ev.detalhes && <p className="inv-history-details">{ev.detalhes}</p>}
                  <p className="inv-history-meta">
                    {dataBR(ev.data_evento)}
                    {ev.feito_por_nome && ` · registrado por ${ev.feito_por_nome}`}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </Modal>

      {confirmarExclusao && (
        <ConfirmationModal
          isOpen
          onClose={() => setConfirmarExclusao(false)}
          onConfirm={excluir}
          title="Excluir ativo"
          message={`Excluir ${nomeDoAtivo(asset)}? Use só para cadastros feitos por engano — ele sai do inventário sem deixar histórico.`}
        />
      )}
    </>
  );
};

export default AssetDetailModal;
