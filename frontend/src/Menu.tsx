import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from './context/AuthContext.tsx';

const Menu: React.FC = () => {
  const { user } = useAuth();
  const defaultAvatar = 'https://res.cloudinary.com/dsgbgrll5/image/upload/v1753972686/imagem-do-usuario-com-fundo-preto_1_y0ulj0.png';
  const logo = 'https://res.cloudinary.com/dsgbgrll5/image/upload/v1754399924/logo-clara_guvics.png';
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="main-menu">
      <button className="hamburger-menu" onClick={() => setIsMenuOpen(!isMenuOpen)}>
        &#9776;
      </button>

      <div className={`menu-left ${isMenuOpen ? 'open' : ''}`}>
        <NavLink to="/dashboard" className="menu-logo-link">
          <img src={logo} alt="Valor Fiscal Logo" className="menu-logo" />
        </NavLink>

        <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'menu-item active' : 'menu-item'} onClick={() => setIsMenuOpen(false)}>
          Dashboard
        </NavLink>

        <NavLink to="/documentos" className={({ isActive }) => (isActive ? 'menu-item active' : 'menu-item')} onClick={() => setIsMenuOpen(false)}>
          Documentos
        </NavLink>

        <NavLink to="/videos" className={({ isActive }) => (isActive ? 'menu-item active' : 'menu-item')}>
          Videos
        </NavLink>

        <NavLink to="/faq" className={({ isActive }) => (isActive ? 'menu-item active' : 'menu-item')}>
          FAQ
        </NavLink>

        {user && user.role === 'admin' && (
          <NavLink to="/admin/users" className={({ isActive }) => isActive ? 'menu-item active' : 'menu-item'} onClick={() => setIsMenuOpen(false)}>
            Gerenciar Usuários
          </NavLink>
        )}
        {user && user.role === 'admin' && (
          <NavLink to="/admin/logs" className={({ isActive }) => (isActive ? 'menu-item active' : 'menu-item')}>
            Logs de Atividade
          </NavLink>
        )}
      </div>

      <div className="menu-right">
        {user && (
          <NavLink to="/perfil" className="profile-info-container">
            <div className="profile-text">
              <span className="profile-role">{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</span>
              <span className="profile-name">{user.nome}</span>
            </div>
            <div className="profile-image-container">
              <img
                src={user.avatar_url || defaultAvatar}
                alt="Foto do perfil"
                className="profile-avatar-img"
              />
            </div>
          </NavLink>
        )}
      </div>
    </nav>
  );
};

export default Menu;