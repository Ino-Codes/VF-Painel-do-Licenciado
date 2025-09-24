import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext.tsx";
import api from "../../api.ts";
import toast from "react-hot-toast";
import ConfirmationModal from "../ui/ConfirmationModal.tsx";

interface AvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AvatarModal: React.FC<AvatarModalProps> = ({ isOpen, onClose }) => {
  const { user, login } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const defaultAvatar =
    "https://res.cloudinary.com/dsgbgrll5/image/upload/v1758284145/user-dark_oxwuux.png";

  if (!isOpen || !user) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    const MAX_SIZE_MB = 2;
    const MAX_WIDTH = 1500;
    const MAX_HEIGHT = 1500;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

    if (file.size > MAX_SIZE_BYTES) {
      toast.error(
        `O arquivo é muito grande. O tamanho máximo é de ${MAX_SIZE_MB}MB.`
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
            `A imagem é muito grande em dimensões. O máximo permitido é ${MAX_WIDTH}x${MAX_HEIGHT} pixels.`
          );
          e.target.value = "";
        } else {
          setSelectedFile(file);
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

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append("avatar", selectedFile);
    try {
      const res = await api.post(`/api/users/${user.id}/avatar`, formData);
      const updatedUser = { ...user, avatar_url: res.data.avatarUrl };
      login(updatedUser);
      toast.success("Foto de perfil atualizada!");
      onClose();
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
      login(res.data.user);
      toast.success("Foto de perfil removida!");
      onClose();
    } catch (err) {
      toast.error("Erro ao remover a foto.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <div className="modal-overlay">
        <div className="modal-content avatar-modal">
          <h2>Alterar Foto de Perfil</h2>
          <div className="avatar-preview">
            <img
              src={
                selectedFile
                  ? URL.createObjectURL(selectedFile)
                  : user.avatar_url || defaultAvatar
              }
              alt="Pré-visualização do Avatar"
            />
          </div>
          <div className="avatar-actions">
            <label className="form-button">
              Escolher Arquivo
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
            </label>
            <button
              onClick={handleUpload}
              className="form-button"
              disabled={!selectedFile || isUploading}
            >
              {isUploading ? "A Enviar..." : "Salvar Nova Foto"}
            </button>
          </div>
          {user.avatar_url && (
            <button
              onClick={() => setIsConfirmOpen(true)}
              className="delete-button"
              disabled={isUploading}
            >
              Remover Foto Atual
            </button>
          )}
          <div className="modal-actions">
            <button onClick={onClose} className="form-button-cancel">
              Fechar
            </button>
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
