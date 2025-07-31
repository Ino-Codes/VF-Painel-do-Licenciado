import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from './context/AuthContext.tsx';

const Menu: React.FC = () => {
  const { user } = useAuth();

  const defaultAvatar = 'https://res.cloudinary.com/dsgbgrll5/image/upload/v1753972473/imagem-do-usuario-com-fundo-preto_hqam2d.png';

  return (
    <nav className="main-menu">
      <div className="menu-left">
        <NavLink 
          to="/dashboard" 
          className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}
        >
          Dashboard
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
        <NavLink 
          to="/perfil"
          className={({ isActive }) => isActive ? "menu-item profile-icon active" : "menu-item profile-icon"}
        >
          <img 
            src={user?.avatar_url || defaultAvatar} 
            alt="Foto do perfil" 
            className="menu-avatar-img"
          />
        </NavLink>
      </div>
    </nav>
  );
};

export default Menu;