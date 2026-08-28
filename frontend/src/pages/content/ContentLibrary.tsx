import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext.tsx";
import api from "../../api.ts";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import ContentFileModal, {
  ContentFileData,
} from "../../components/forms/ContentFileModal.tsx";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import ConfirmationModal from "../../components/ui/ConfirmationModal.tsx";
import EmptyState from "../../components/ui/EmptyState.tsx";
import CompanyFilter from "../../components/ui/CompanyFilter.tsx";
import { IconKey } from "../../utils/assets.ts";
import { FiEdit, FiTrash2, FiDownload } from "react-icons/fi";

interface FileData {
  id: number;
  originalname: string;
  filename: string;
  category: string;
  folder?: string;
  uploaded_at: string;
}

type GroupedFiles = {
  [folderName: string]: FileData[];
};

interface ContentLibraryProps {
  // Recurso de conteúdo: define os endpoints (/api/files ou /api/archives).
  resource: "files" | "archives";
  title: string;
  manageKey: string;
  emptyImageKey: IconKey;
  emptyTitle: string;
  emptyMessage: string;
}

// Página unificada de biblioteca de arquivos (antes Documentos + Arquivos,
// praticamente idênticas). Parametrizada por `resource` e textos.
const ContentLibrary: React.FC<ContentLibraryProps> = ({
  resource,
  title,
  manageKey,
  emptyImageKey,
  emptyTitle,
  emptyMessage,
}) => {
  const { user, loading, hasPermission } = useAuth();
  const navigate = useNavigate();

  const [company, setCompany] = useState<string>("all");

  const [groupedFiles, setGroupedFiles] = useState<GroupedFiles>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState<string>("");
  const [activeFolder, setActiveFolder] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<ContentFileData | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<number | null>(null);

  const canManage = hasPermission(manageKey);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  const fetchCategories = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get(`/api/${resource}/categories`, {
        params: { company },
      });
      setCategories(res.data);

      // Update funcional para não depender de `category` (senão trocar de aba
      // refaz a busca de categorias no servidor sem necessidade).
      setCategory((prev) => {
        if (res.data.length === 0) return "";
        return prev && res.data.includes(prev) ? prev : res.data[0];
      });
    } catch (err) {
      toast.error("Erro ao buscar categorias.");
    }
  }, [user, company, resource]);

  const fetchFiles = useCallback(async () => {
    if (!user || (!category && !searchQuery)) {
      setGroupedFiles({});
      return;
    }

    try {
      const params: {
        category: string;
        company: string;
        _t: number;
        search?: string;
      } = {
        category,
        company,
        _t: new Date().getTime(), // Evita cache
      };

      if (searchQuery) {
        params.search = searchQuery;
      }

      const res = await api.get(`/api/${resource}`, {
        params,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });
      setGroupedFiles(res.data);
    } catch (err) {
      toast.error("Erro ao buscar arquivos.");
    }
  }, [user, category, searchQuery, company, resource]);

  useEffect(() => {
    if (user) {
      fetchCategories();
    }
  }, [user, fetchCategories]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleDownload = async (fileId: number, originalname: string) => {
    toast.loading("Iniciando download...");
    try {
      const response = await api.get(`/api/${resource}/download/${fileId}`);
      const { downloadUrl } = response.data;

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (isMobile) {
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.setAttribute("download", originalname);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.dismiss();
        toast.success("Download iniciado!");
      } else {
        toast.dismiss();
        window.open(downloadUrl, "_blank");
      }
    } catch (err) {
      toast.dismiss();
      toast.error("Erro ao baixar o arquivo. Verifique suas permissões.");
      console.error(err);
    }
  };

  const toggleFolder = (folderName: string) => {
    setActiveFolder(activeFolder === folderName ? null : folderName);
  };

  const handleSearch = () => setSearchQuery(searchTerm);

  const handleDeleteClick = (fileId: number) => {
    setFileToDelete(fileId);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (fileToDelete === null) return;
    try {
      await api.delete(`/api/${resource}/${fileToDelete}`);
      toast.success("Arquivo excluído com sucesso!");
      await fetchFiles();
      await fetchCategories();
    } catch (err) {
      toast.error("Erro ao excluir o arquivo.");
    } finally {
      setIsConfirmModalOpen(false);
      setFileToDelete(null);
    }
  };

  const openModalForEdit = (file: FileData) => {
    setEditingFile(file);
    setIsModalOpen(true);
  };

  const openModalForCreate = () => {
    setEditingFile(null);
    setIsModalOpen(true);
  };

  const handleSuccess = async () => {
    setIsModalOpen(false);
    await fetchCategories();
    await fetchFiles();
  };

  const folderNames = Object.keys(groupedFiles).sort((a, b) => {
    if (a === "Geral") return -1;
    if (b === "Geral") return 1;
    return a.localeCompare(b);
  });

  if (loading) {
    return <div className="tela-loading">Carregando...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="p-2">
      <Menu />
      <div className={`content-area document-center company-${company}`}>
        <div className="document-header">
          <div>
            <h2 className="content-title">{title}</h2>
          </div>
          {canManage && (
            <button
              className="form-button form-button--add"
              onClick={openModalForCreate}
            >
              + Adicionar Arquivo
            </button>
          )}
        </div>

        <CompanyFilter value={company} onChange={setCompany} />

        <div className="tabs">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`tab-item ${category === cat ? "active" : ""}`}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="search-bar">
          <input
            type="search"
            placeholder="Pesquisar por nome do arquivo ou pasta..."
            className="form-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button className="form-button" onClick={handleSearch}>
            Pesquisar
          </button>
        </div>

        <div className="folder-list">
          {folderNames.length > 0 ? (
            folderNames.map((folderName) => (
              <div key={folderName} className="folder-item">
                <button
                  className="folder-header"
                  onClick={() => toggleFolder(folderName)}
                >
                  <span>{folderName}</span>
                  <span className="folder-toggle">
                    {activeFolder === folderName ? "−" : "+"}
                  </span>
                </button>
                {activeFolder === folderName && (
                  <div className="folder-content">
                    {groupedFiles[folderName].map((file) => (
                      <div key={file.id} className="file-item">
                        <span className="file-name">{file.originalname}</span>

                        <div className="user-actions">
                          <button
                            className="form-icon-save"
                            onClick={() =>
                              handleDownload(file.id, file.originalname)
                            }
                          >
                            <FiDownload />
                          </button>

                          {canManage && (
                            <>
                              <button
                                className="form-icon-edit"
                                onClick={() => openModalForEdit(file)}
                              >
                                <FiEdit />
                              </button>
                              <button
                                className="form-icon-delete"
                                onClick={() => handleDeleteClick(file.id)}
                              >
                                <FiTrash2 />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <EmptyState
              imageKey={emptyImageKey}
              title={emptyTitle}
              message={emptyMessage}
            />
          )}
        </div>
      </div>

      {isModalOpen && (
        <ContentFileModal
          resource={resource}
          itemToEdit={editingFile}
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleSuccess}
          categories={categories}
          folders={folderNames}
        />
      )}
      <Footer />
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este arquivo?"
      />
    </div>
  );
};

export default ContentLibrary;
