import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext.tsx";
import api from "../../api.ts";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import FileModal from "../../components/forms/FileModal.tsx";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import ConfirmationModal from "../../components/ui/ConfirmationModal.tsx";
import EmptyState from "../../components/ui/EmptyState.tsx";

interface FileData {
  id: number;
  originalname: string;
  filename: string;
  category: string;
  folder?: string;
  visibility: "todos" | "licenciados" | "colaboradores";
  uploaded_at: string;
}

type GroupedFiles = {
  [folderName: string]: FileData[];
};

const Documentos: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [groupedFiles, setGroupedFiles] = useState<GroupedFiles>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState<string>("");
  const [activeFolder, setActiveFolder] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<FileData | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<number | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  const fetchCategories = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get("/api/files/categories");
      setCategories(res.data);
      if (!category && res.data.length > 0) {
        setCategory(res.data[0]);
      } else if (res.data.length === 0) {
        setCategory("");
      }
    } catch (err) {
      toast.error("Erro ao buscar categorias.");
    }
  }, [user, category]);

  useEffect(() => {
    if (user) {
      fetchCategories();
    }
  }, [user, fetchCategories]);

  const fetchFiles = useCallback(async () => {
    if (!user || !category) {
      setGroupedFiles({});
      return;
    }
    try {
      const params: any = { category };
      if (searchQuery) {
        params.search = searchQuery;
      }
      const res = await api.get("/api/files", { params });
      setGroupedFiles(res.data);
    } catch (err) {
      toast.error("Erro ao buscar arquivos.");
    }
  }, [user, category, searchQuery]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleDownload = async (fileId: number, originalname: string) => {
    toast.loading("Iniciando download...");
    try {
      // 1. Pede ao backend para gerar uma URL de download segura
      const response = await api.get(`/api/files/download/${fileId}`);
      const { downloadUrl } = response.data;

      // Detecta se é um dispositivo móvel
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (isMobile) {
        // Solução para Mobile: Cria um link e simula o clique
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.setAttribute("download", originalname); // Força o download com o nome original
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.dismiss();
        toast.success("Download iniciado!");
      } else {
        // Solução para Desktop (comportamento original mantido)
        toast.dismiss();
        // Abre a URL em uma nova aba. O navegador cuidará do download.
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
      await api.delete(`/api/files/${fileToDelete}`);
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
      <div className="content-area document-center">
        <div className="document-header">
          <h2>Central de Documentos</h2>
          {user?.role === "admin" && (
            <button className="form-button" onClick={openModalForCreate}>
              + Adicionar Arquivo
            </button>
          )}
        </div>

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
                        <div className="file-actions">
                          <button
                            className="list-button download"
                            onClick={() =>
                              handleDownload(file.id, file.originalname)
                            }
                          >
                            Baixar
                          </button>

                          {user?.role === "admin" && (
                            <>
                              <button
                                className="list-button"
                                onClick={() => openModalForEdit(file)}
                              >
                                Editar
                              </button>
                              <button
                                className="delete-button"
                                onClick={() => handleDeleteClick(file.id)}
                              >
                                Excluir
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
              imageKey="documentos"
              title="Nenhum Documento Encontrado"
              message="Estamos incluindo documentos neste módulo do painel. Caso não tenha encontrado resultados para sua busca, tente novamente mais tarde."
            />
          )}
        </div>
      </div>

      {isModalOpen && (
        <FileModal
          fileToEdit={editingFile}
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

export default Documentos;
