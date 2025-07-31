import React, { useState, useEffect } from 'react';
import api from './api.ts';

interface FileData {
  id: number;
  originalname: string;
  category: string;
}

interface FileModalProps {
  fileToEdit: FileData | null;
  onClose: () => void;
  onSuccess: () => void;
}

const FileModal: React.FC<FileModalProps> = ({ fileToEdit, onClose, onSuccess }) => {
  const [originalname, setOriginalname] = useState('');
  const [category, setCategory] = useState('Manuais');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (fileToEdit) {
      setOriginalname(fileToEdit.originalname);
      setCategory(fileToEdit.category);
    }
  }, [fileToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (fileToEdit) { // Modo Edição
        await api.put(`/api/files/${fileToEdit.id}`, { originalname, category });
      } else { // Modo Criação
        if (!file) {
          setError('Por favor, selecione um arquivo.');
          return;
        }
        const formData = new FormData();
        formData.append('file', file);
        formData.append('originalname', originalname);
        formData.append('category', category);
        await api.post('/api/files', formData);
      }
      onSuccess(); // Avisa o componente pai que a operação foi um sucesso
    } catch (err) {
      setError('Ocorreu um erro ao salvar o arquivo.');
      console.error(err);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{fileToEdit ? 'Editar Arquivo' : 'Adicionar Novo Arquivo'}</h2>
        <form onSubmit={handleSubmit}>
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
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="form-select"
            >
              <option value="Manuais">Manuais</option>
              <option value="Marketing">Marketing</option>
              <option value="Financeiro">Financeiro</option>
            </select>
          </div>
          {!fileToEdit && (
            <div className="form-row">
              <input
                type="file"
                onChange={(e) => e.target.files && setFile(e.target.files[0])}
                required
              />
            </div>
          )}
          {error && <p className="error-message">{error}</p>}
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="form-button-cancel">Cancelar</button>
            <button type="submit" className="form-button">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FileModal;