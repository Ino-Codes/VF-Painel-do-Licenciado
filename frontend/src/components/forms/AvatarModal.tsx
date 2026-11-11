import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext.tsx";
import api from "../../api.ts";
import toast from "react-hot-toast";
import ConfirmationModal from "../ui/ConfirmationModal.tsx";
import { FiCamera, FiImage, FiX, FiTrash2 } from "react-icons/fi";
import { HiOutlineUserCircle } from "react-icons/hi";
import EditorDeImagem, { Recorte } from "./EditorDeImagem.tsx";
import { cortarImagem, TAMANHO_AVATAR } from "./cortarImagem.ts";
import { lerImagemEscolhida } from "./lerImagemEscolhida.ts";

// Foto de perfil, em duas etapas como a capa:
//  1. escolher a imagem (ou remover a foto atual);
//  2. "Editar imagem": moldura redonda, arrastar, zoom e giro.
// O recorte sai pronto do navegador, quadrado (512 × 512).

interface AvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AvatarModal: React.FC<AvatarModalProps> = ({ isOpen, onClose }) => {
  const { user, login } = useAuth();
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
    const url = await lerImagemEscolhida(e, {
      larguraIdeal: TAMANHO_AVATAR.largura,
      alturaIdeal: TAMANHO_AVATAR.altura,
    });
    if (!url) return;
    descartarImagem();
    setOrigem(url);
  };

  const salvar = async () => {
    if (!origem || !recorte) return;
    setEnviando(true);
    try {
      const arquivo = await cortarImagem(origem, recorte.area, recorte.rotacao, TAMANHO_AVATAR);
      const form = new FormData();
      form.append("avatar", arquivo, "avatar.jpg");
      const res = await api.post(`/api/users/${user.id}/avatar`, form);
      // O backend responde { success, user, token }
      login(res.data.user, res.data.token);
      toast.success("Foto de perfil atualizada!");
      setEnviando(false);
      descartarImagem();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || "Erro ao atualizar a foto.");
      setEnviando(false);
    }
  };

  const remover = async () => {
    setConfirmarRemocao(false);
    setEnviando(true);
    try {
      const res = await api.delete(`/api/users/${user.id}/avatar`);
      login(res.data.user, res.data.token);
      toast.success("Foto de perfil removida!");
      setEnviando(false);
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Erro ao remover a foto.");
      setEnviando(false);
    }
  };

  const seletorDeArquivo = (
    <input
      id="avatar-file-input"
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
          className={`avatar-modal-card${origem ? " avatar-modal-card--editor avatar-modal-card--editor-foto" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="avatar-modal-titulo"
          onClick={(e) => e.stopPropagation()}
        >
          <button className="avatar-modal-close" onClick={fecharELimpar} aria-label="Fechar">
            <FiX />
          </button>

          {!origem ? (
            /* ── Etapa 1: escolher ── */
            <>
              <div className="avatar-modal-head">
                <h2 id="avatar-modal-titulo">Foto de perfil</h2>
                <p>JPG, PNG ou WEBP. Depois de escolher, você ajusta o enquadramento.</p>
              </div>

              <label htmlFor="avatar-file-input" className="avatar-dropzone">
                <span className="avatar-dropzone-ring">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="Foto atual" />
                  ) : (
                    <HiOutlineUserCircle className="avatar-dropzone-placeholder" />
                  )}
                  <span className="avatar-dropzone-overlay">
                    <FiCamera />
                  </span>
                </span>
                <span className="avatar-dropzone-hint">Clique para escolher uma imagem</span>
                {seletorDeArquivo}
              </label>

              <div className="avatar-modal-actions">
                {user.avatar_url && (
                  <button
                    type="button"
                    className="avatar-btn avatar-btn--danger"
                    onClick={() => setConfirmarRemocao(true)}
                    disabled={enviando}
                  >
                    <FiTrash2 /> Remover foto
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
              <h2 id="avatar-modal-titulo" className="img-editor-titulo">
                Editar imagem
              </h2>
              <EditorDeImagem
                key={origem}
                imagem={origem}
                proporcao={1}
                formato="round"
                onChange={setRecorte}
                extras={
                  <label htmlFor="avatar-file-input" className="img-editor-trocar">
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
        title="Remover Foto"
        message="Tem a certeza de que deseja remover a sua foto de perfil atual?"
      />
    </>
  );
};

export default AvatarModal;
