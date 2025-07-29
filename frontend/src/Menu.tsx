import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from './context/AuthContext.tsx';

const Menu: React.FC = () => {
  const { user } = useAuth();

  return (
    <nav className="main-menu">
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

    </nav>
  );
};

export default Menu;