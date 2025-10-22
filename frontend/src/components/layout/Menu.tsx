import React, { useState, useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.tsx";
import ThemeToggleButton from "../ui/ThemeToggleButton.tsx";
import Logo from "../../img/logo-clara.png";
import { FaUserTie } from "react-icons/fa";

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

const FileIcon = () => (
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
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
  </svg>
);

const CalendarIcon = () => (
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
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
);

const TeamIcon = () => (
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
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);

const Menu: React.FC = () => {
  const { user } = useAuth();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRhDropdownOpen, setRhDropdownOpen] = useState(false);
  const [isAdminDropdownOpen, setAdminDropdownOpen] = useState(false);
  const [isFileDropdownOpen, setFileDropdownOpen] = useState(false);
  const [isComercialDropdownOpen, setIsComercialDropdownOpen] = useState(false);
  const [isInternoDropdownOpen, setIsInternoDropdownOpen] = useState(false);

  const rhDropdownRef = useRef<HTMLDivElement>(null);
  const adminDropdownRef = useRef<HTMLDivElement>(null);
  const fileDropdownRef = useRef<HTMLDivElement>(null);
  const comercialDropdownRef = useRef<HTMLDivElement>(null);
  const internoDropdownRef = useRef<HTMLDivElement>(null);

  const firstName = user?.nome?.split(" ")[0] || "";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        rhDropdownRef.current &&
        !rhDropdownRef.current.contains(event.target as Node)
      ) {
        setRhDropdownOpen(false);
      }

      if (
        adminDropdownRef.current &&
        !adminDropdownRef.current.contains(event.target as Node)
      ) {
        setAdminDropdownOpen(false);
      }

      if (
        fileDropdownRef.current &&
        !fileDropdownRef.current.contains(event.target as Node)
      ) {
        setFileDropdownOpen(false);
      }

      if (
        comercialDropdownRef.current &&
        !comercialDropdownRef.current.contains(event.target as Node)
      ) {
        setIsComercialDropdownOpen(false);
      }

      if (
        internoDropdownRef.current &&
        !internoDropdownRef.current.contains(event.target as Node)
      ) {
        setIsInternoDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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

        <div className="dropdown-menu" ref={fileDropdownRef}>
          <button
            className="menu-item dropdown-trigger"
            onClick={() => setFileDropdownOpen(!isFileDropdownOpen)}
          >
            <FileIcon />
            Conteúdos
          </button>
          {isFileDropdownOpen && (
            <div className="dropdown-content">
              <NavLink
                to="/courses"
                className="menu-item"
                onClick={() => setIsMenuOpen(false)}
              >
                Cursos
              </NavLink>

              <NavLink
                to="/documentos"
                className="menu-item"
                onClick={() => {
                  setIsMenuOpen(false);
                  setFileDropdownOpen(false);
                }}
              >
                Documentos
              </NavLink>

              <NavLink
                to="/videos"
                className="menu-item"
                onClick={() => {
                  setIsMenuOpen(false);
                  setFileDropdownOpen(false);
                }}
              >
                Vídeos
              </NavLink>
            </div>
          )}
        </div>

        {/* {user && user.role !== "licenciado" && (
          <div className="dropdown-menu" ref={internoDropdownRef}>
            <button
              className="menu-item dropdown-trigger"
              onClick={() => setIsInternoDropdownOpen(!isInternoDropdownOpen)}
            >
              <TeamIcon />
              Área Interna
            </button>
            {isInternoDropdownOpen && (
              <div className="dropdown-content">
                <NavLink
                  to="/ferias"
                  className="menu-item"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsInternoDropdownOpen(false);
                  }}
                >
                  Marcar Férias
                </NavLink>

                <NavLink to="/empresa" className="menu-item">
                  Empresa
                </NavLink>
              </div>
            )}
          </div>
        )} */}

        {((user && user.role === "admin") || user.role === "rh") && (
          <div className="dropdown-menu" ref={rhDropdownRef}>
            <button
              className="menu-item dropdown-trigger"
              onClick={() => setRhDropdownOpen(!isRhDropdownOpen)}
            >
              <CalendarIcon />
              RH
            </button>
            {isRhDropdownOpen && (
              <div className="dropdown-content">
                <NavLink
                  to="/admin/courses"
                  className="menu-item"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setRhDropdownOpen(false);
                  }}
                >
                  Cursos
                </NavLink>

                <NavLink
                  to="/admin/calendar"
                  className="menu-item"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setRhDropdownOpen(false);
                  }}
                >
                  Eventos
                </NavLink>

                <NavLink
                  to="/admin/ferias"
                  className="menu-item"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setRhDropdownOpen(false);
                  }}
                >
                  Férias
                </NavLink>
              </div>
            )}
          </div>
        )}

        {user && user.role === "admin" && (
          <div className="dropdown-menu" ref={adminDropdownRef}>
            <button
              className="menu-item dropdown-trigger"
              onClick={() => setAdminDropdownOpen(!isAdminDropdownOpen)}
            >
              <LockIcon />
              Admin
            </button>
            {isAdminDropdownOpen && (
              <div className="dropdown-content">
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
                  to="/admin/users"
                  className="menu-item"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setAdminDropdownOpen(false);
                  }}
                >
                  Usuários
                </NavLink>
              </div>
            )}
          </div>
        )}

        <NavLink
          to="/faq"
          className="menu-item"
          onClick={() => setIsMenuOpen(false)}
        >
          FAQ
        </NavLink>
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
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt="Foto do perfil"
                  className="profile-avatar-img"
                />
              ) : (
                <FaUserTie className="menu-user-icon" />
              )}
            </div>
          </NavLink>
        )}
      </div>
    </nav>
  );
};

export default Menu;
