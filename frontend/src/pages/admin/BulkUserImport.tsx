import React, { useState } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";

interface BulkUserImportProps {
  onImportSuccess: () => void;
}

const BulkUserImport: React.FC<BulkUserImportProps> = ({ onImportSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Por favor, selecione um arquivo CSV.");
      return;
    }
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/api/users/admin/bulk-upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const { successCount, errorCount, errors } = res.data;

      toast.success(`${successCount} usuários importados com sucesso!`);
      if (errorCount > 0) {
        const errorDetails = errors.slice(0, 3).join("\n");
        toast.error(
          `${errorCount} usuários falharam.\nDetalhes:\n${errorDetails}...`,
          { duration: 6000 }
        );
        console.error("Erros de importação:", errors);
      }

      onImportSuccess();
    } catch (err) {
      toast.error("Ocorreu um erro grave durante o upload.");
    } finally {
      setIsUploading(false);
      setFile(null);
    }
  };

  return (
    <div className="on-screen-form">
      <h3>Importar Usuários em Massa</h3>
      <p>
        Selecione um arquivo .csv com as colunas:{" "}
        <strong>nome, email, senha, tipo</strong>
      </p>
      <div className="form-row">
        <div className="file-upload-wrapper">
          <input
            type="file"
            accept=".csv"
            id="csv-upload"
            className="file-upload-input"
            onChange={handleFileChange}
          />
          <label htmlFor="csv-upload" className="file-upload-label">
            Escolher Arquivo
          </label>
          <span className="file-upload-filename">
            {file ? file.name : "Nenhum arquivo escolhido"}
          </span>
        </div>

        <button
          className="form-button"
          type="button"
          onClick={handleUpload}
          disabled={!file || isUploading}
        >
          {isUploading ? "Importando..." : "Importar Usuários"}
        </button>
      </div>
    </div>
  );
};

export default BulkUserImport;
