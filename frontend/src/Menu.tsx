import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from './context/AuthContext.tsx';

const UserIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

const Menu: React.FC = () => {
  const { user } = useAuth();

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
          <UserIcon />
        </NavLink>
      </div>
    </nav>
  );
};

export default Menu;