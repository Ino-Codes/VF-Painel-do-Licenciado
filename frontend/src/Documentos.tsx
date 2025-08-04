import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext.tsx';
import api from './api.ts';
import Menu from './Menu.tsx';
import FileModal from './FileModal.tsx';
import Footer from './Footer.tsx';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

interface FileData {
  id: number;
  originalname: string;
  filename: string;
  category: string;
  uploaded_at: string;
}

const Documentos: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  
  const [files, setFiles] = useState<FileData[]>([]);
  const [category, setCategory] = useState('Manuais');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<FileData | null>(null);

  // --- NOVOS ESTADOS PARA A PESQUISA ---
  const [searchTerm, setSearchTerm] = useState(''); // Controla o valor do input
  const [searchQuery, setSearchQuery] = useState(''); // Controla o termo enviado para a API

  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalFiles, setTotalFiles] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const categories = ['Manuais', 'Marketing', 'Financeiro'];

  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  const fetchFiles = async () => {
    if (!user) return;
    try {
      const params: any = { 
        category,
        page: currentPage,
        limit,
      };
      // Adiciona o termo de busca aos parâmetros apenas se ele não estiver vazio
      if (searchQuery) {
        params.search = searchQuery;
      }
      const res = await api.get('/api/files', { params });
      setFiles(res.data.files);
      setTotalFiles(res.data.totalCount);
      setTotalPages(res.data.totalPages);
    } catch (err) {
      toast.error('Erro ao buscar arquivos.');
    }
  };

  // Efeito para buscar arquivos quando filtros, página ou busca mudam
  useEffect(() => {
    fetchFiles();
  }, [category, user, currentPage, limit, searchQuery]);

  // Reseta para a primeira página quando filtros mudam
  useEffect(() => {
    setCurrentPage(1);
  }, [category, limit, searchQuery]);

  const handleSearch = () => {
    setSearchQuery(searchTerm);
  };

  const handleDelete = async (fileId: number) => {
    if (window.confirm('Tem certeza que deseja excluir este arquivo?')) {
      try {
        await api.delete(`/api/files/${fileId}`);
        toast.success('Arquivo excluído com sucesso!');
        fetchFiles();
      } catch (err) {
        toast.error('Erro ao excluir o arquivo.');
      }
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

  const handleSuccess = () => {
    setIsModalOpen(false);
    fetchFiles();
  };

  if (loading) {
    return <div className="tela-loading">Carregando...</div>
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
          {user?.role === 'admin' && (
            <button className="form-button" onClick={openModalForCreate}>
              + Adicionar Arquivo
            </button>
          )}
        </div>
     
        <div className="tabs">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`tab-item ${category === cat ? 'active' : ''}`}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* --- NOVA BARRA DE PESQUISA --- */}
        <div className="search-bar">
          <input
            type="search"
            placeholder="Pesquisar por nome do arquivo..."
            className="form-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button className="form-button" onClick={handleSearch}>Pesquisar</button>
        </div>

        <div className="file-list">
          {files.map((file) => (
            <div key={file.id} className="file-item">
              <span className="file-name">{file.originalname}</span>
              <div className="file-actions">
                <a href={file.filename} target="_blank" rel="noopener noreferrer" download>
                    <button className="list-button download">Baixar</button>
                </a>
                {user?.role === 'admin' && (
                  <>
                    <button className="list-button edit" onClick={() => openModalForEdit(file)}>Editar</button>
                    <button className="list-button delete" onClick={() => handleDelete(file.id)}>Excluir</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* --- NOVOS CONTROLES DE PAGINAÇÃO --- */}
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
            <span>Página {currentPage} de {totalPages}</span>
            <div className="page-buttons">
              <button 
                onClick={() => setCurrentPage(currentPage - 1)} 
                disabled={currentPage === 1}
              >
                Anterior
              </button>
              <button 
                onClick={() => setCurrentPage(currentPage + 1)} 
                disabled={currentPage === totalPages}
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <FileModal
          fileToEdit={editingFile}
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
      <Footer />
    </div>
  );
};

export default Documentos;