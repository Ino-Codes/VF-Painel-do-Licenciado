import React, { useEffect, useState } from 'react';
import api from './api.ts';
import { useAuth } from './context/AuthContext.tsx';
import { useNavigate } from 'react-router-dom';
import Menu from './Menu.tsx';

interface User {
  id: number;
  nome: string;
  email: string;
  role: 'admin' | 'licenciado' | 'gestor';
}

const AdminUsers: React.FC = () => {
  const { user, logout } = useAuth(); 
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({ nome: '', email: '', password: '', role: 'licenciado' });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  useEffect(() => {
    if (!user) {
      navigate('/');
    } else if (user.role !== 'admin') {
      alert('Acesso restrito a administradores.');
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const fetchUsers = async () => {
    const res = await api.get('/api/admin/users');
    setUsers(res.data);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      await api.put(`/api/admin/users/${editingUser.id}`, {
        nome: editingUser.nome,
        role: editingUser.role
      });
      setEditingUser(null);
    } else {
      await api.post('/api/admin/users', form);
      setForm({ nome: '', email: '', password: '', role: 'licenciado' });
    }
    fetchUsers();
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este usuário?')) {
      await api.delete(`/api/admin/users/${id}`);
      fetchUsers();
    }
  };

  const startEdit = (u: User) => {
    setEditingUser(u);
  };

  return (
  <div className="p-2">
    <Menu />
    <div className="content-area">
      <h2>{editingUser ? 'Editar Usuário' : 'Criar Usuário'}</h2>
      <form onSubmit={handleSubmit} className="admin-form">
        <div className="form-row">
          <input
            className="form-input"
            placeholder="Nome"
            value={editingUser ? editingUser.nome : form.nome}
            onChange={e => {
              if (editingUser) setEditingUser({ ...editingUser, nome: e.target.value });
              else setForm({ ...form, nome: e.target.value });
            }}
            required
          />
          {!editingUser && (
            <>            
              <input
                className="form-input"
                placeholder="Email"
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                required
              />
              <input
                className="form-input"
                placeholder="Senha"
                type="password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                required
              />
            </>
          )}
        </div>

        <div className="form-row">
          <select
            className="form-select"
            value={editingUser ? editingUser.role : form.role}
            onChange={e => {
              const newRole = e.target.value as 'admin' | 'licenciado' | 'gestor';
              if (editingUser) setEditingUser({ ...editingUser, role: newRole });
              else setForm({ ...form, role: newRole });
            }}
          >
            <option value="licenciado">Licenciado</option>
            <option value="admin">Admin</option>
            <option value="gestor">Gestor</option>
          </select>
        </div>

        <div className="form-row">
          <button className="form-button" type="submit">{editingUser ? 'Salvar Alterações' : 'Criar Usuário'}</button>
          {editingUser && (
            <button className="form-button-cancel" type="button" onClick={() => setEditingUser(null)}>
              Cancelar Edição
            </button>
          )}
        </div>
      </form>

      <h2>Usuários Cadastrados:</h2>
      <ul className="user-list">
        {users.map(u => (
          <li key={u.id} className="user-list-item">
            <div className="user-info">
              <strong>{u.nome}</strong>
              <span>{u.email} ({u.role})</span>
            </div>
            <div className="user-actions">
              <button className="list-button edit" onClick={() => startEdit(u)}>Editar</button>
              <button className="list-button delete" onClick={() => handleDelete(u.id)}>Excluir</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  </div>
  );

  
};

export default AdminUsers;