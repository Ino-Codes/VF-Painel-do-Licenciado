import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext.tsx";
import api from "../../api.ts";
import toast from "react-hot-toast";
import ConfirmationModal from "../ui/ConfirmationModal.tsx";
import { FiImage, FiX, FiTrash2 } from "react-icons/fi";
import EditorDeImagem, { Recorte } from "./EditorDeImagem.tsx";
import { cortarImagem, TAMANHO_CAPA } from "./cortarImagem.ts";
import { lerImagemEscolhida } from "./lerImagemEscolhida.ts";

// Capa do perfil: a faixa do topo da tela de Perfil, no padrão do LinkedIn
// (1584 × 396 px, proporção 4:1). Duas etapas, como no LinkedIn:
//  1. escolher a imagem (ou remover a capa atual);
//  2. "Editar imagem": arrastar para enquadrar, zoom e giro.
// O recorte sai pronto do navegador, já em 1584 × 396.

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const CapaModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { user, login } = useAuth() as any;
  // Imagem escolhida (object URL) — presente = etapa de edição.
  const [origem, setOrigem] = useState<string | null>(null);
  const [recorte, setRecorte] = useState<Recorte | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);

  if (!isOpen || !user) return null;

  const descartarImagem = () => {
    setOrigem((o) => {
      if (o) URL.revokeObjectURL(o);
      return null;
    });
    setRecorte(null);
  };

  const fecharELimpar = () => {
    if (enviando) return;
    descartarImagem();
    onClose();
  };

  const escolher = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = await lerImagemEscolhida(e, { larguraIdeal: TAMANHO_CAPA.largura, alturaIdeal: TAMANHO_CAPA.altura });
    if (!url) return;
    descartarImagem();
    setOrigem(url);
  };

  const salvar = async () => {
    if (!origem || !recorte) return;
    setEnviando(true);
    try {
      const arquivo = await cortarImagem(origem, recorte.area, recorte.rotacao, TAMANHO_CAPA);
      const form = new FormData();
      form.append("cover", arquivo, "capa.jpg");
      const res = await api.post(`/api/users/${user.id}/cover`, form);
      login(res.data.user, res.data.token);
      toast.success("Capa atualizada!");
      setEnviando(false);
      descartarImagem();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || "Erro ao atualizar a capa.");
      setEnviando(false);
    }
  };

  const remover = async () => {
    setConfirmarRemocao(false);
    setEnviando(true);
    try {
      const res = await api.delete(`/api/users/${user.id}/cover`);
      login(res.data.user, res.data.token);
      toast.success("Capa removida. Voltou a faixa padrão.");
      setEnviando(false);
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Erro ao remover a capa.");
      setEnviando(false);
    }
  };

  const seletorDeArquivo = (
    <input
      id="capa-file-input"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      className="file-upload-input"
      onChange={escolher}
    />
  );

  return (
    <>
      <div className="modal-overlay modal-overlay--blur" onClick={fecharELimpar}>
        <div
          className={`avatar-modal-card capa-modal-card${origem ? " avatar-modal-card--editor" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="capa-modal-titulo"
          onClick={(e) => e.stopPropagation()}
        >
          <button className="avatar-modal-close" onClick={fecharELimpar} aria-label="Fechar">
            <FiX />
          </button>

          {!origem ? (
            /* ── Etapa 1: escolher ── */
            <>
              <div className="avatar-modal-head">
                <h2 id="capa-modal-titulo">Capa do perfil</h2>
                <p>
                  Tamanho ideal: {TAMANHO_CAPA.largura} × {TAMANHO_CAPA.altura} px (o mesmo do LinkedIn). JPG, PNG ou
                  WEBP. Depois de escolher, você ajusta o enquadramento.
                </p>
              </div>

              <label htmlFor="capa-file-input" className="capa-dropzone">
                <span className="capa-preview">
                  {user.cover_url ? (
                    <img src={user.cover_url} alt="Capa atual" />
                  ) : (
                    <span className="capa-preview-vazia">
                      <FiImage aria-hidden="true" />
                      Faixa padrão
                    </span>
                  )}
                  <span className="capa-preview-overlay" aria-hidden="true">
                    <FiImage />
                  </span>
                </span>
                <span className="avatar-dropzone-hint capa-dropzone-hint">Clique para escolher uma imagem</span>
                {seletorDeArquivo}
              </label>

              <div className="avatar-modal-actions">
                {user.cover_url && (
                  <button
                    type="button"
                    className="avatar-btn avatar-btn--danger"
                    onClick={() => setConfirmarRemocao(true)}
                    disabled={enviando}
                  >
                    <FiTrash2 /> Remover capa
                  </button>
                )}
                <div className="avatar-modal-actions-right">
                  <button type="button" className="avatar-btn avatar-btn--ghost" onClick={fecharELimpar} disabled={enviando}>
                    Fechar
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* ── Etapa 2: editar imagem ── */
            <>
              <h2 id="capa-modal-titulo" className="img-editor-titulo">
                Editar imagem
              </h2>
              <EditorDeImagem
                key={origem}
                imagem={origem}
                proporcao={4}
                onChange={setRecorte}
                extras={
                  <label htmlFor="capa-file-input" className="img-editor-trocar">
                    <FiImage aria-hidden="true" /> Trocar imagem
                    {seletorDeArquivo}
                  </label>
                }
              />
              <div className="avatar-modal-actions">
                <div className="avatar-modal-actions-right">
                  <button type="button" className="avatar-btn avatar-btn--ghost" onClick={descartarImagem} disabled={enviando}>
                    Voltar
                  </button>
                  <button
                    type="button"
                    className="avatar-btn avatar-btn--primary"
                    onClick={salvar}
                    disabled={!recorte || enviando}
                  >
                    {enviando ? "Salvando..." : "Salvar alterações"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmarRemocao}
        onClose={() => setConfirmarRemocao(false)}
        onConfirm={remover}
        title="Remover capa"
        message="A capa volta a ser a faixa padrão. Deseja continuar?"
      />
    </>
  );
};

export default CapaModal;
