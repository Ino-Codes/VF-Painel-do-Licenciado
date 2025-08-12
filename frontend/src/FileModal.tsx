import React, { useState, useEffect } from "react";
import api from "./api.ts";
import toast from "react-hot-toast";

interface FileData {
  id: number;
  originalname: string;
  category: string;
  visibility: "public" | "internal";
}

interface FileModalProps {
  fileToEdit: FileData | null;
  onClose: () => void;
  onSuccess: () => void;
  categories: string[]; // Recebe as categorias existentes como sugestão
}

const FileModal: React.FC<FileModalProps> = ({
  fileToEdit,
  onClose,
  onSuccess,
  categories,
}) => {
  const [originalname, setOriginalname] = useState("");
  const [category, setCategory] = useState("");
  const [visibility, setVisibility] = useState<"public" | "internal">("public");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (fileToEdit) {
      setOriginalname(fileToEdit.originalname);
      setCategory(fileToEdit.category);
      setVisibility(fileToEdit.visibility || "public");
    }
  }, [fileToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!category.trim() || !originalname.trim()) {
      toast.error("Nome do arquivo e categoria são obrigatórios.");
      return;
    }

    try {
      if (fileToEdit) {
        await api.put(`/api/files/${fileToEdit.id}`, {
          originalname,
          category,
          visibility,
        });
        toast.success("Arquivo atualizado com sucesso!");
      } else {
        if (!file) {
          toast.error("Por favor, selecione um arquivo.");
          return;
        }
        const formData = new FormData();
        formData.append("file", file);
        formData.append("originalname", originalname);
        formData.append("category", category);
        formData.append("visibility", visibility);
        await api.post("/api/files", formData);
        toast.success("Arquivo incluído com sucesso!");
      }
      onSuccess();
    } catch (err) {
      toast.error("Ocorreu um erro ao salvar o arquivo.");
      console.error(err);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{fileToEdit ? "Editar Arquivo" : "Adicionar Novo Arquivo"}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <input
              type="text"
              placeholder="Nome do Arquivo"
              value={originalname}
              onChange={(e) => setOriginalname(e.target.value)}
              className="form-input"
              required
            />
          </div>

          <div className="form-row">
            <input
              type="text"
              list="category-suggestions"
              placeholder="Digite o nome da Categoria"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="form-input"
              required
            />
            <datalist id="category-suggestions">
              {categories.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>

          <div className="form-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={visibility === "internal"}
                onChange={(e) =>
                  setVisibility(e.target.checked ? "internal" : "public")
                }
              />
              Visível apenas para Gestores e Admins
            </label>
          </div>

          {!fileToEdit && (
            <div className="form-row">
              <input
                type="file"
                onChange={(e) => e.target.files && setFile(e.target.files[0])}
                required
              />
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="form-button-cancel"
            >
              Cancelar
            </button>
            <button type="submit" className="form-button">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FileModal;
