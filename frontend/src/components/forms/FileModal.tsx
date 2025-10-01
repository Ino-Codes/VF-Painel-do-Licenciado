import React, { useState, useEffect } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";

interface FileData {
  id: number;
  originalname: string;
  category: string;
  folder?: string;
  visibility: "todos" | "licenciados" | "colaboradores";
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
  const [visibility, setVisibility] = useState<
    "todos" | "licenciados" | "colaboradores"
  >("todos");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (fileToEdit) {
      setOriginalname(fileToEdit.originalname);
      setCategory(fileToEdit.category);
      setFolder(fileToEdit.folder || "");
      setVisibility(fileToEdit.visibility || "todos");
    } else {
      setOriginalname("");
      setCategory("");
      setFolder("");
      setVisibility("todos");
      setFile(null);
    }
  }, [fileToEdit]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const MAX_FILE_SIZE = 20 * 1024 * 1024;

      if (selectedFile.size > MAX_FILE_SIZE) {
        toast.error("O arquivo é muito grande. O limite máximo é de 10 MB.");
        e.target.value = "";
        setFile(null);
      } else {
        setFile(selectedFile);
      }
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
            <label htmlFor="visibility" style={{ marginRight: "10px" }}>
              Visibilidade:
            </label>
          </div>
          <div className="form-row">
            <select
              id="visibility"
              value={visibility}
              onChange={(e) =>
                setVisibility(e.target.value as FileData["visibility"])
              }
              className="form-select"
            >
              <option value="todos">Visível para Todos</option>
              <option value="licenciados">Apenas para Licenciados</option>
              <option value="colaboradores">Apenas para Colaboradores</option>
            </select>
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
