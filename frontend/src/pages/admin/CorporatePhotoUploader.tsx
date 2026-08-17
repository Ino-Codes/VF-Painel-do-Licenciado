import React, { useState } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";
import ConfirmationModal from "../../components/ui/ConfirmationModal.tsx";
import { HiOutlineUserCircle } from "react-icons/hi";

interface User {
  id: number;
  corporate_photo_url?: string;
}

interface Props {
  user: User;
  onUploadSuccess: () => void;
}

const CorporatePhotoUploader: React.FC<Props> = ({ user, onUploadSuccess }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Envia imediatamente ao escolher o arquivo (fluxo "Alterar foto").
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append("corporate_photo", file);
    try {
      await api.put(`/api/users/admin/${user.id}/corporate-photo`, formData);
      toast.success("Foto corporativa atualizada com sucesso!");
      onUploadSuccess();
    } catch (err) {
      toast.error("Erro ao enviar a foto.");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleRemove = async () => {
    setIsConfirmOpen(false);
    setIsUploading(true);
    try {
      await api.delete(`/api/users/admin/${user.id}/corporate-photo`);
      toast.success("Foto corporativa removida com sucesso!");
      onUploadSuccess();
    } catch (err) {
      toast.error("Erro ao remover a foto.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <div className="corp-photo">
        <span className="corp-photo-avatar">
          {user.corporate_photo_url ? (
            <img src={user.corporate_photo_url} alt="Foto corporativa" />
          ) : (
            <HiOutlineUserCircle className="corp-photo-placeholder" />
          )}
        </span>

        <div className="corp-photo-actions">
          <input
            type="file"
            accept="image/*"
            id="corporate-photo-upload"
            className="file-upload-input"
            onChange={handleFileChange}
            disabled={isUploading}
          />
          <label htmlFor="corporate-photo-upload" className="corp-photo-btn">
            {isUploading ? "Enviando..." : "Alterar foto"}
          </label>

          {user.corporate_photo_url && (
            <button
              type="button"
              onClick={() => setIsConfirmOpen(true)}
              className="corp-photo-remove"
              disabled={isUploading}
            >
              Remover
            </button>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleRemove}
        title="Remover Foto Corporativa"
        message="Tem a certeza de que deseja remover a foto corporativa deste colaborador?"
      />
    </>
  );
};

export default CorporatePhotoUploader;
