import React, { useState, useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.tsx";
import ThemeToggleButton from "../ui/ThemeToggleButton.tsx";
import LoadingSpinner from "../ui/LoadingSpinner.tsx";
import Logo from "../../img/logo-clara.png";

const LockIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>
);

const Menu: React.FC = () => {
  const { user } = useAuth();
  const defaultAvatar =
    "https://res.cloudinary.com/dsgbgrll5/image/upload/v1758284145/user-light_d0dd5l.png";

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAdminDropdownOpen, setAdminDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const firstName = user?.nome?.split(" ")[0] || "";

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

  if (!user) {
    return <LoadingSpinner />;
  }

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
          <img src={Logo} alt="Valor Fiscal Logo" className="menu-logo" />
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
          className="faq-icon-link"
          title="Perguntas Frequentes (FAQ)"
        >
          FAQ
        </NavLink>

        {user && user.role === "admin" && (
          <div className="dropdown-menu" ref={dropdownRef}>
            <button
              className="menu-item dropdown-trigger"
              onClick={() => setAdminDropdownOpen(!isAdminDropdownOpen)}
            >
              <LockIcon />
              Administração
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
                  to="/admin/calendar"
                  className="menu-item"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setAdminDropdownOpen(false);
                  }}
                >
                  Agenda
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
              </div>
            )}
          </div>
        )}
      </div>

      <div className="menu-right">
        <ThemeToggleButton />

        {user && (
          <NavLink to="/perfil" className="profile-info-container">
            <div className="profile-text">
              <span className="profile-role">
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </span>
              <span className="profile-name">{firstName}</span>
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
