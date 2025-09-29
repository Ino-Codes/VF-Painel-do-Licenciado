// frontend/src/pages/admin/CorporatePhotoUploader.tsx
import React, { useState } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";

interface Props {
  userId: number;
  onUploadSuccess: () => void;
}

const CorporatePhotoUploader: React.FC<Props> = ({
  userId,
  onUploadSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

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
      await api.put(`/api/users/admin/${userId}/corporate-photo`, formData);
      toast.success("Foto corporativa atualizada com sucesso!");
      onUploadSuccess();
    } catch (err) {
      toast.error("Erro ao enviar a foto.");
    } finally {
      setIsUploading(false);
      setFile(null);
    }
  };

  return (
    <div className="corporate-photo-uploader">
      <h4>Foto Corporativa</h4>
      <div className="file-upload-wrapper">
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
      <button
        onClick={handleUpload}
        disabled={!file || isUploading}
        className="form-button"
      >
        {isUploading ? "Enviando..." : "Enviar Foto"}
      </button>
    </div>
  );
};

export default CorporatePhotoUploader;
