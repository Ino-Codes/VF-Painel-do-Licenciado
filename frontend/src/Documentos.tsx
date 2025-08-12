import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "./context/AuthContext.tsx";
import api from "./api.ts";
import Menu from "./Menu.tsx";
import FileModal from "./FileModal.tsx";
import Footer from "./Footer.tsx";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import ConfirmationModal from "./ConfirmationModal.tsx";
import "./styles.css";

interface FileData {
  id: number;
  originalname: string;
  filename: string;
  category: string;
  folder?: string;
  visibility: "public" | "internal";
  uploaded_at: string;
}

type GroupedFiles = {
  [folderName: string]: FileData[];
};

const Documentos: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [files, setFiles] = useState<FileData[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState<string>("");
  const [activeFolder, setActiveFolder] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<FileData | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalFiles, setTotalFiles] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

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
      const res = await api.get("/api/files/categories", {
        params: { role: user.role },
      });
      setCategories(res.data);
      if (!category && res.data.length > 0) {
        setCategory(res.data[0]);
      } else if (res.data.length === 0) {
        setCategory(""); // Limpa a categoria se não houver nenhuma
      }
    } catch (err) {
      toast.error("Erro ao buscar categorias.");
    }
  }, [user, category]);

  useEffect(() => {
    fetchCategories();
  }, [user]); // Roda apenas quando o usuário é carregado

  const fetchFiles = useCallback(async () => {
    if (!user || !category) {
      setFiles([]); // Limpa os arquivos se não houver categoria
      return;
    }
    try {
      const params: any = {
        category,
        page: currentPage,
        limit,
        role: user.role,
      };
      if (searchQuery) {
        params.search = searchQuery;
      }
      const res = await api.get("/api/files", { params });
      setFiles(res.data.files);
      setTotalFiles(res.data.totalCount);
      setTotalPages(res.data.totalPages);
    } catch (err) {
      toast.error("Erro ao buscar arquivos.");
    }
  }, [user, category, currentPage, limit, searchQuery]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    setCurrentPage(1);
  }, [category, limit, searchQuery]);

  const handleSearch = () => {
    setSearchQuery(searchTerm);
  };

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
      await fetchCategories(); // Re-busca as categorias
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
          {user?.role !== "licenciado" && (
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
            placeholder="Pesquisar por nome do arquivo..."
            className="form-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button className="form-button" onClick={handleSearch}>
            Pesquisar
          </button>
        </div>

        <div className="file-list">
          {files.map((file) => (
            <div key={file.id} className="file-item">
              <span className="file-name">{file.originalname}</span>
              <div className="file-actions">
                <a
                  href={file.filename}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                >
                  <button className="list-button download">Baixar</button>
                </a>
                {user?.role !== "licenciado" && (
                  <>
                    <button
                      className="list-button edit"
                      onClick={() => openModalForEdit(file)}
                    >
                      Editar
                    </button>
                    <button
                      className="list-button delete"
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

        {totalFiles > 0 && (
          <div className="pagination-controls">
            <div className="limit-selector">
              <label htmlFor="limit">Itens por página:</label>
              <select
                id="limit"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
            <span>
              Página {currentPage} de {totalPages}
            </span>
            <div className="page-buttons">
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages || totalPages === 0}
              >
                Próxima
              </button>
            </div>
          </div>
        )}

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
                          <a
                            href={file.filename}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                          >
                            <button className="list-button download">
                              Baixar
                            </button>
                          </a>
                          {user?.role !== "licenciado" && (
                            <>
                              <button
                                className="list-button edit"
                                onClick={() => openModalForEdit(file)}
                              >
                                Editar
                              </button>
                              <button
                                className="list-button delete"
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
            <p>Nenhum documento encontrado nesta categoria.</p>
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
