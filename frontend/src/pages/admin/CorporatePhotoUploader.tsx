import React, { useState } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";
import ConfirmationModal from "../../components/ui/ConfirmationModal.tsx";

interface User {
  id: number;
  corporate_photo_url?: string;
}

interface Props {
  user: User;
  onUploadSuccess: () => void;
}

const CorporatePhotoUploader: React.FC<Props> = ({ user, onUploadSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
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
      setFile(null);
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
      <div className="corporate-photo-uploader">
        <h4>Foto Corporativa</h4>
        <div className="form-row">
          <input
            type="file"
            accept="image/*"
            id="corporate-photo-upload"
            className="file-upload-input"
            onChange={handleFileChange}
          />
          <label htmlFor="corporate-photo-upload" className="file-upload-label">
            Escolher Foto
          </label>
          <span className="file-upload-filename">
            {file ? file.name : "Nenhuma imagem selecionada"}
          </span>
        </div>
        <div className="form-row" style={{ gap: "10px" }}>
          <button
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="form-button"
          >
            {isUploading ? "Enviando..." : "Enviar Foto"}
          </button>

          {user.corporate_photo_url && (
            <button
              type="button"
              onClick={() => setIsConfirmOpen(true)}
              className="delete-button"
              disabled={isUploading}
            >
              Remover Foto Atual
            </button>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleRemove}
        title="Remover Foto Corporativa"
        message="Tem a certeza de que deseja remover a foto corporativa deste utilizador?"
      />
    </>
  );
};

export default CorporatePhotoUploader;
