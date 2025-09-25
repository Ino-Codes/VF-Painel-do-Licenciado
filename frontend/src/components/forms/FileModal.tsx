import React, { useState, useEffect } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";

interface FileData {
  id: number;
  originalname: string;
  category: string;
  folder?: string;
  visibility: "public" | "internal";
}

interface FileModalProps {
  fileToEdit: FileData | null;
  onClose: () => void;
  onSuccess: () => void;
  categories: string[];
  folders: string[];
}

const FileModal: React.FC<FileModalProps> = ({
  fileToEdit,
  onClose,
  onSuccess,
  categories,
  folders,
}) => {
  const [originalname, setOriginalname] = useState("");
  const [category, setCategory] = useState("");
  const [folder, setFolder] = useState("");
  const [visibility, setVisibility] = useState<"public" | "internal">("public");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (fileToEdit) {
      setOriginalname(fileToEdit.originalname);
      setCategory(fileToEdit.category);
      setFolder(fileToEdit.folder || "");
      setVisibility(fileToEdit.visibility || "public");
    }
  }, [fileToEdit]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!category.trim() || !originalname.trim() || !folder.trim()) {
      toast.error("Categoria, Pasta e Nome são obrigatórios.");
      return;
    }

    try {
      if (fileToEdit) {
        await api.put(`/api/files/${fileToEdit.id}`, {
          originalname,
          category,
          folder,
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
        formData.append("folder", folder);
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
              list="category-suggestions"
              placeholder="Categoria"
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
            <input
              type="text"
              list="folder-suggestions"
              placeholder="Pasta"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              className="form-input"
              required
            />
            <datalist id="folder-suggestions">
              {folders.map((fld) => (
                <option key={fld} value={fld} />
              ))}
            </datalist>
          </div>

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
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={visibility === "internal"}
                onChange={(e) =>
                  setVisibility(e.target.checked ? "internal" : "public")
                }
              />
              Acesso privado (apenas colaboradores internos)
            </label>
          </div>

          {!fileToEdit && (
            <div className="form-row">
              <div className="file-upload-wrapper">
                <input
                  type="file"
                  id="file-upload"
                  className="file-upload-input"
                  onChange={handleFileChange}
                  required
                />
                <label htmlFor="file-upload" className="file-upload-label">
                  Escolher Arquivo
                </label>
                <span className="file-upload-filename">
                  {file ? file.name : "Nenhum arquivo escolhido"}
                </span>
              </div>
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
