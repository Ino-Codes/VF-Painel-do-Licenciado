import React, { useState, useEffect } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";
import { useSearchParams } from "react-router-dom"; // Importado para ler a URL

interface FileData {
  id: number;
  originalname: string;
  category: string;
  folder?: string;
  visibility: "todos" | "licenciados" | "colaboradores";
  // O backend pode retornar company_id, mas lidamos com slugs no front
}

interface FileModalProps {
  fileToEdit: FileData | null;
  onClose: () => void;
  onSuccess: () => void;
  categories: string[];
  folders: string[];
}

// Configuração das empresas disponíveis para seleção
const COMPANIES_OPTIONS = [
  { slug: "v-tax", name: "V-TAX" },
  { slug: "v-banking", name: "V-BANKING" },
  { slug: "v-business", name: "V-BUSINESS" },
  { slug: "v-corp", name: "V-CORP" },
  { slug: "v-tech", name: "V-TECH" },
];

const FileModal: React.FC<FileModalProps> = ({
  fileToEdit,
  onClose,
  onSuccess,
  categories,
  folders,
}) => {
  // 1. Captura a empresa atual da URL para usar como padrão
  const [searchParams] = useSearchParams();
  const currentCompanySlug = searchParams.get("company") || "v-tax";

  const [originalname, setOriginalname] = useState("");
  const [category, setCategory] = useState("");
  const [folder, setFolder] = useState("");
  const [visibility, setVisibility] = useState<
    "todos" | "licenciados" | "colaboradores"
  >("todos");

  // 2. Novo estado para a Empresa
  const [company, setCompany] = useState(currentCompanySlug);

  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (fileToEdit) {
      setOriginalname(fileToEdit.originalname);
      setCategory(fileToEdit.category);
      setFolder(fileToEdit.folder || "");
      setVisibility(fileToEdit.visibility || "todos");
      // Na edição, mantemos a empresa atual da navegação ou
      // idealmente viria do objeto fileToEdit se o backend retornasse o slug.
      // Por enquanto, assume a empresa da URL.
      setCompany(currentCompanySlug);
    } else {
      setOriginalname("");
      setCategory("");
      setFolder("");
      setVisibility("todos");
      setFile(null);
      // Ao criar novo, reseta para a empresa da URL
      setCompany(currentCompanySlug);
    }
  }, [fileToEdit, currentCompanySlug]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

      if (selectedFile.size > MAX_FILE_SIZE) {
        toast.error("O arquivo é muito grande. O limite máximo é de 20 MB.");
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
        // Edição
        await api.put(`/api/files/${fileToEdit.id}`, {
          originalname,
          category,
          folder,
          visibility,
          company, // Envia a empresa selecionada (requer suporte no backend PUT)
        });
        toast.success("Arquivo atualizado com sucesso!");
      } else {
        // Criação (Upload)
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

        // 3. Anexa a empresa escolhida ao FormData
        formData.append("company", company);

        await api.post("/api/files", formData);
        toast.success(
          `Arquivo incluído na ${
            COMPANIES_OPTIONS.find((c) => c.slug === company)?.name || "empresa"
          }!`,
        );
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
        <button type="button" className="modal-close-button" aria-label="Fechar" onClick={onClose}>
          &times;
        </button>
        <h2>{fileToEdit ? "Editar Arquivo" : "Novo Arquivo"}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label htmlFor="company-select" className="content-modal-label">
              Empresa:
            </label>
          </div>
          <div className="form-row">
            <select
              id="company-select"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="form-select"
            >
              {COMPANIES_OPTIONS.map((opt) => (
                <option key={opt.slug} value={opt.slug}>
                  {opt.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label htmlFor="visibility" className="content-modal-label">
              Dados do arquivo:
            </label>
          </div>
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
              placeholder="Nome"
              value={originalname}
              onChange={(e) => setOriginalname(e.target.value)}
              className="form-input"
              required
            />
          </div>

          <div className="form-row">
            <label htmlFor="visibility" className="content-modal-label">
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
