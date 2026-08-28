import React, { useState, useEffect } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";
import { useSearchParams } from "react-router-dom";
import Modal from "../ui/Modal.tsx";

export interface ContentFileData {
  id: number;
  originalname: string;
  category: string;
  folder?: string;
}

interface ContentFileModalProps {
  // Recurso de conteúdo: define os endpoints (/api/files ou /api/archives).
  resource: "files" | "archives";
  itemToEdit: ContentFileData | null;
  onClose: () => void;
  onSuccess: () => void;
  categories: string[];
  folders: string[];
}

// Empresas disponíveis para publicação (alvo do conteúdo). Diferente do
// COMPANY_OPTIONS de CompanyFilter, que inclui "all" (conceito de filtro).
const COMPANIES_OPTIONS = [
  { slug: "v-tax", name: "V-TAX" },
  { slug: "v-banking", name: "V-BANKING" },
  { slug: "v-business", name: "V-BUSINESS" },
  { slug: "v-corp", name: "V-CORP" },
  { slug: "v-tech", name: "V-TECH" },
  { slug: "v-partner", name: "V-PARTNER" },
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

// Modal unificado de arquivo/documento (antes FileModal + ArchiveModal, ~95%
// idênticos). Só o `resource` muda os endpoints.
const ContentFileModal: React.FC<ContentFileModalProps> = ({
  resource,
  itemToEdit,
  onClose,
  onSuccess,
  categories,
  folders,
}) => {
  const [searchParams] = useSearchParams();
  const currentCompanySlug = searchParams.get("company") || "v-tax";

  const [originalname, setOriginalname] = useState("");
  const [category, setCategory] = useState("");
  const [folder, setFolder] = useState("");
  const [company, setCompany] = useState(currentCompanySlug);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (itemToEdit) {
      setOriginalname(itemToEdit.originalname);
      setCategory(itemToEdit.category);
      setFolder(itemToEdit.folder || "");
      setCompany(currentCompanySlug);
    } else {
      setOriginalname("");
      setCategory("");
      setFolder("");
      setFile(null);
      setCompany(currentCompanySlug);
    }
  }, [itemToEdit, currentCompanySlug]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
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
      if (itemToEdit) {
        await api.put(`/api/${resource}/${itemToEdit.id}`, {
          originalname,
          category,
          folder,
          company,
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
        formData.append("company", company);

        await api.post(`/api/${resource}`, formData);
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
    <Modal onClose={onClose} title={itemToEdit ? "Editar Arquivo" : "Novo Arquivo"}>
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
          <label className="content-modal-label">Dados do arquivo:</label>
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

        {!itemToEdit && (
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
          <button type="button" onClick={onClose} className="form-button-cancel">
            Cancelar
          </button>
          <button type="submit" className="form-button">
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ContentFileModal;
