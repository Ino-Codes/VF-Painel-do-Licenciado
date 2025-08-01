import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext.tsx';
import api from './api.ts';
import Menu from './Menu.tsx';
import FileModal from './FileModal.tsx';
import { useNavigate } from 'react-router-dom';

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

  const categories = ['Manuais', 'Marketing', 'Financeiro'];

  useEffect (() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  const fetchFiles = async () => {
    try {
      const res = await api.get('/api/files', { params: { category } });
      setFiles(res.data);
    } catch (err) {
      console.error('Erro ao buscar arquivos:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchFiles();
    }
  }, [category, user]);

  const handleDelete = async (fileId: number) => {
    if (window.confirm('Tem certeza que deseja excluir este arquivo?')) {
      try {
        await api.delete(`/api/files/${fileId}`);
        fetchFiles();
      } catch (err) {
        alert('Erro ao excluir o arquivo.');
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
    return <div>Carregando...</div>;
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
      </div>

      {isModalOpen && (
        <FileModal
          fileToEdit={editingFile}
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
};

export default Documentos;