import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext.tsx";
import api from "../../api.ts";
import toast from "react-hot-toast";
import ConfirmationModal from "../ui/ConfirmationModal.tsx";
import { FiCamera, FiX, FiTrash2 } from "react-icons/fi";
import { HiOutlineUserCircle } from "react-icons/hi";

interface AvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AvatarModal: React.FC<AvatarModalProps> = ({ isOpen, onClose }) => {
  const { user, login } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  if (!isOpen || !user) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE_MB = 2;
    const MAX_WIDTH = 1500;
    const MAX_HEIGHT = 1500;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

    if (file.size > MAX_SIZE_BYTES) {
      toast.error(
        `O arquivo é muito grande. O tamanho máximo é de ${MAX_SIZE_MB}MB.`,
      );
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        if (img.width > MAX_WIDTH || img.height > MAX_HEIGHT) {
          toast.error(
            `A imagem é muito grande em dimensões. O máximo permitido é ${MAX_WIDTH}x${MAX_HEIGHT} pixels.`,
          );
          e.target.value = "";
        } else {
          setSelectedFile(file);
          setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev); // libera o preview anterior
            return URL.createObjectURL(file);
          });
          toast.success("Imagem selecionada com sucesso!");
        }
      };
      img.onerror = () => {
        toast.error("Não foi possível ler o arquivo de imagem.");
        e.target.value = "";
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const closeAndReset = () => {
    setSelectedFile(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    onClose();
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append("avatar", selectedFile);
    try {
      const res = await api.post(`/api/users/${user.id}/avatar`, formData);
      // O backend responde { success, user, token }
      login(res.data.user, res.data.token);
      toast.success("Foto de perfil atualizada!");
      closeAndReset();
    } catch (err) {
      toast.error("Erro ao atualizar a foto.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    setIsConfirmOpen(false);
    setIsUploading(true);
    try {
      const res = await api.delete(`/api/users/${user.id}/avatar`);
      login(res.data.user, res.data.token);
      toast.success("Foto de perfil removida!");
      closeAndReset();
    } catch (err) {
      toast.error("Erro ao remover a foto.");
    } finally {
      setIsUploading(false);
    }
  };

  const currentImage = previewUrl || user.avatar_url;

  return (
    <>
      <div className="modal-overlay modal-overlay--blur" onClick={closeAndReset}>
        <div
          className="avatar-modal-card"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="avatar-modal-close"
            onClick={closeAndReset}
            aria-label="Fechar"
          >
            <FiX />
          </button>

          <div className="avatar-modal-head">
            <h2>Foto de perfil</h2>
            <p>Envie uma imagem quadrada de até 2&nbsp;MB (JPG, PNG ou WEBP).</p>
          </div>

          <label htmlFor="avatar-file-input" className="avatar-dropzone">
            <span className="avatar-dropzone-ring">
              {currentImage ? (
                <img src={currentImage} alt="Pré-visualização do avatar" />
              ) : (
                <HiOutlineUserCircle className="avatar-dropzone-placeholder" />
              )}
              <span className="avatar-dropzone-overlay">
                <FiCamera />
              </span>
            </span>
            <span className="avatar-dropzone-hint">
              {selectedFile
                ? selectedFile.name
                : "Clique para escolher uma imagem"}
            </span>
            <input
              id="avatar-file-input"
              type="file"
              accept="image/*"
              className="file-upload-input"
              onChange={handleFileChange}
            />
          </label>

          <div className="avatar-modal-actions">
            {user.avatar_url && (
              <button
                type="button"
                className="avatar-btn avatar-btn--danger"
                onClick={() => setIsConfirmOpen(true)}
                disabled={isUploading}
              >
                <FiTrash2 /> Remover foto
              </button>
            )}

            <div className="avatar-modal-actions-right">
              <button
                type="button"
                className="avatar-btn avatar-btn--ghost"
                onClick={closeAndReset}
                disabled={isUploading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="avatar-btn avatar-btn--primary"
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
              >
                {isUploading ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleRemove}
        title="Remover Foto"
        message="Tem a certeza de que deseja remover a sua foto de perfil atual?"
      />
    </>
  );
};

export default AvatarModal;
