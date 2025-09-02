import React, { useState, useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "./context/AuthContext.tsx";

const Menu: React.FC = () => {
  const { user } = useAuth();
  const defaultAvatar =
    "https://res.cloudinary.com/dsgbgrll5/image/upload/v1753972686/imagem-do-usuario-com-fundo-preto_1_y0ulj0.png";
  const logo =
    "https://res.cloudinary.com/dsgbgrll5/image/upload/v1754399924/logo-clara_guvics.png";

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [isAdminDropdownOpen, setAdminDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setAdminDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  return (
    <nav className="main-menu">
      <button
        className="hamburger-menu"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
      >
        &#9776;
      </button>

      <div className={`menu-left ${isMenuOpen ? "open" : ""}`}>
        <NavLink to="/dashboard" className="menu-logo-link">
          <img src={logo} alt="Valor Fiscal Logo" className="menu-logo" />
        </NavLink>

        <NavLink
          to="/dashboard"
          className="menu-item"
          onClick={() => setIsMenuOpen(false)}
        >
          Dashboard
        </NavLink>
        <NavLink
          to="/documentos"
          className="menu-item"
          onClick={() => setIsMenuOpen(false)}
        >
          Documentos
        </NavLink>
        <NavLink
          to="/videos"
          className="menu-item"
          onClick={() => setIsMenuOpen(false)}
        >
          Vídeos
        </NavLink>
        <NavLink
          to="/courses"
          className="menu-item"
          onClick={() => setIsMenuOpen(false)}
        >
          Cursos
        </NavLink>
        <NavLink
          to="/faq"
          className="menu-item"
          onClick={() => setIsMenuOpen(false)}
        >
          FAQ
        </NavLink>

        {user && user.role === "admin" && (
          <div className="dropdown-menu" ref={dropdownRef}>
            <button
              className="menu-item dropdown-trigger"
              onClick={() => setAdminDropdownOpen(!isAdminDropdownOpen)}
            >
              🔒 Administração
            </button>
            {isAdminDropdownOpen && (
              <div className="dropdown-content">
                <NavLink
                  to="/admin/users"
                  className="menu-item"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setAdminDropdownOpen(false);
                  }}
                >
                  Usuários
                </NavLink>
                <NavLink
                  to="/admin/courses"
                  className="menu-item"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setAdminDropdownOpen(false);
                  }}
                >
                  Cursos
                </NavLink>
                <NavLink
                  to="/admin/logs"
                  className="menu-item"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setAdminDropdownOpen(false);
                  }}
                >
                  Logs
                </NavLink>
                <NavLink
                  to="/calendario"
                  className="menu-item"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setAdminDropdownOpen(false);
                  }}
                >
                  Calendário
                </NavLink>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="menu-right">
        {user && (
          <NavLink to="/perfil" className="profile-info-container">
            <div className="profile-text">
              <span className="profile-role">
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </span>
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
