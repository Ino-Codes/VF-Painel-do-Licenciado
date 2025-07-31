import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from './context/AuthContext.tsx';

const Menu: React.FC = () => {
const { user } = useAuth();
const defaultAvatar = 'https://res.cloudinary.com/dsgbgrll5/image/upload/v1753972686/imagem-do-usuario-com-fundo-preto_1_y0ulj0.png';

return (
<nav className="main-menu">
  <div className="menu-left">
    <NavLink
      to="/dashboard"
      className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}
    >
      Dashboard
    </NavLink>

    {/* NOVO LINK ADICIONADO AQUI */}
    <NavLink
      to="/documentos"
      className={({ isActive }) => (isActive ? 'menu-item active' : 'menu-item')}
    >
      Documentos
    </NavLink>

    {user && user.role === 'admin' && (
    <NavLink
      to="/admin/users"
      className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}
    >
      Gerenciar Usuários
    </NavLink>
    )}
  </div>

  <div className="menu-right">
    {user && (
      <NavLink
        to="/perfil"
        className="profile-info-container"
      >
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