import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext.tsx";
import api from "../../api.ts";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import ArchiveModal from "../../components/forms/ArchiveModal.tsx";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import ConfirmationModal from "../../components/ui/ConfirmationModal.tsx";
import EmptyState from "../../components/ui/EmptyState.tsx";
import CompanyFilter from "../../components/ui/CompanyFilter.tsx";
import { FiEdit, FiTrash2, FiDownload } from "react-icons/fi";

interface ArchiveData {
  id: number;
  originalname: string;
  filename: string;
  category: string;
  folder?: string;
  uploaded_at: string;
}

type GroupedArchives = {
  [folderName: string]: ArchiveData[];
};

const Arquivos: React.FC = () => {
  const { user, loading, hasPermission } = useAuth();
  const navigate = useNavigate();

  const [company, setCompany] = useState<string>("all");

  const [groupedArchives, setGroupedArchives] = useState<GroupedArchives>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState<string>("");
  const [activeFolder, setActiveFolder] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingArchive, setEditingArchive] = useState<ArchiveData | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [archiveToDelete, setArchiveToDelete] = useState<number | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  const fetchCategories = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get("/api/archives/categories", {
        params: { company },
      });
      setCategories(res.data);

      if (!category && res.data.length > 0) {
        setCategory(res.data[0]);
      } else if (category && !res.data.includes(category)) {
        setCategory(res.data[0] || "");
      } else if (res.data.length === 0) {
        setCategory("");
      }
    } catch (err) {
      toast.error("Erro ao buscar categorias.");
    }
  }, [user, category, company]);

  const fetchArchives = useCallback(async () => {
    if (!user || (!category && !searchQuery)) {
      setGroupedArchives({});
      return;
    }

    try {
      const params: any = {
        category,
        company,
        _t: new Date().getTime(),
      };

      if (searchQuery) {
        params.search = searchQuery;
      }

      const res = await api.get("/api/archives", {
        params,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });
      setGroupedArchives(res.data);
    } catch (err) {
      toast.error("Erro ao buscar arquivos.");
    }
  }, [user, category, searchQuery, company]);

  useEffect(() => {
    if (user) {
      fetchCategories();
    }
  }, [user, fetchCategories, company]);

  useEffect(() => {
    fetchArchives();
  }, [fetchArchives]);

  const handleDownload = async (archiveId: number, originalname: string) => {
    toast.loading("Iniciando download...");
    try {
      const response = await api.get(`/api/archives/download/${archiveId}`);
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

  const handleDeleteClick = (archiveId: number) => {
    setArchiveToDelete(archiveId);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (archiveToDelete === null) return;
    try {
      await api.delete(`/api/archives/${archiveToDelete}`);
      toast.success("Arquivo excluído com sucesso!");
      await fetchArchives();
      await fetchCategories();
    } catch (err) {
      toast.error("Erro ao excluir o arquivo.");
    } finally {
      setIsConfirmModalOpen(false);
      setArchiveToDelete(null);
    }
  };

  const openModalForEdit = (archive: ArchiveData) => {
    setEditingArchive(archive);
    setIsModalOpen(true);
  };

  const openModalForCreate = () => {
    setEditingArchive(null);
    setIsModalOpen(true);
  };

  const handleSuccess = async () => {
    setIsModalOpen(false);
    await fetchCategories();
    await fetchArchives();
  };

  const folderNames = Object.keys(groupedArchives).sort((a, b) => {
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
            <h2 className="content-title">Arquivos</h2>
          </div>
          {hasPermission("archives.manage") && (
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
                    {groupedArchives[folderName].map((archive) => (
                      <div key={archive.id} className="file-item">
                        <span className="file-name">{archive.originalname}</span>

                        <div className="user-actions">
                          <button
                            className="form-icon-save"
                            onClick={() =>
                              handleDownload(archive.id, archive.originalname)
                            }
                          >
                            <FiDownload />
                          </button>

                          {hasPermission("archives.manage") && (
                            <>
                              <button
                                className="form-icon-edit"
                                onClick={() => openModalForEdit(archive)}
                              >
                                <FiEdit />
                              </button>
                              <button
                                className="form-icon-delete"
                                onClick={() => handleDeleteClick(archive.id)}
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
              imageKey="arquivos"
              title="Nenhum Arquivo Encontrado"
              message="Nenhum arquivo foi cadastrado nesta seção ainda."
            />
          )}
        </div>
      </div>

      {isModalOpen && (
        <ArchiveModal
          archiveToEdit={editingArchive}
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

export default Arquivos;
