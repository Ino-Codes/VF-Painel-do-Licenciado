import api from "../../api.ts";
import React, { useState, useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.tsx";
import ThemeToggleButton from "../ui/ThemeToggleButton.tsx";
import Logo from "../../img/logo-clara.png";
import NotificationModal from "../ui/NotificationModal.tsx";
import {
  HiOutlineFolder,
  HiOutlineUserGroup,
  HiOutlineCalendar,
  HiOutlineLockClosed,
  HiOutlineUserCircle,
  HiOutlineBell,
} from "react-icons/hi";

interface Notification {
  id: number;
  message: string;
  is_read: boolean;
  link_to?: string;
  created_at: string;
}

const Menu: React.FC = () => {
  const { user } = useAuth();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRhDropdownOpen, setRhDropdownOpen] = useState(false);
  const [isAdminDropdownOpen, setAdminDropdownOpen] = useState(false);
  const [isFileDropdownOpen, setFileDropdownOpen] = useState(false);
  const [isInternoDropdownOpen, setIsInternoDropdownOpen] = useState(false);

  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const rhDropdownRef = useRef<HTMLDivElement>(null);
  const adminDropdownRef = useRef<HTMLDivElement>(null);
  const fileDropdownRef = useRef<HTMLDivElement>(null);
  const internoDropdownRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

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
        internoDropdownRef.current &&
        !internoDropdownRef.current.contains(event.target as Node)
      ) {
        setIsInternoDropdownOpen(false);
      }

      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        setIsNotificationOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    api
      .get("/api/notifications")
      .then((res) => {
        setNotifications(res.data);
        setUnreadCount(res.data.filter((n: Notification) => !n.is_read).length);
      })
      .catch((err) => console.error("Erro ao buscar notificações."));
  }, [user]);

  const handleOpenNotifications = () => {
    setIsNotificationOpen(true);
    if (unreadCount > 0) {
      api
        .post("/api/notifications/mark-read")
        .then(() => {
          setUnreadCount(0);
          setNotifications((prev) =>
            prev.map((n) => ({ ...n, is_read: true }))
          );
        })
        .catch((err) => console.error("Erro ao marcar como lido.", err));
    }
  };

  if (!user) {
    return null;
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
        <NavLink to="/home" className="menu-logo-link">
          <img src={Logo} alt="Valor Fiscal Logo" className="menu-logo" />
        </NavLink>

        <NavLink
          to="/home"
          className="menu-item"
          onClick={() => setIsMenuOpen(false)}
        >
          Home
        </NavLink>

        <div className="dropdown-menu" ref={fileDropdownRef}>
          <button
            className="menu-item dropdown-trigger"
            onClick={() => setFileDropdownOpen(!isFileDropdownOpen)}
          >
            <HiOutlineFolder />
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

        {user && user.role !== "licenciado" && (
          <div className="dropdown-menu" ref={internoDropdownRef}>
            <button
              className="menu-item dropdown-trigger"
              onClick={() => setIsInternoDropdownOpen(!isInternoDropdownOpen)}
            >
              <HiOutlineUserGroup />
              Área Interna
            </button>
            {isInternoDropdownOpen && (
              <div className="dropdown-content">
                {/* <NavLink
                  to="/ferias"
                  className="menu-item"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsInternoDropdownOpen(false);
                  }}
                >
                  Marcar Férias
                </NavLink> */}

                <NavLink to="/empresa" className="menu-item">
                  Empresa
                </NavLink>
              </div>
            )}
          </div>
        )}

        {(user.role === "admin" || user.role === "rh") && (
          <div className="dropdown-menu" ref={rhDropdownRef}>
            <button
              className="menu-item dropdown-trigger"
              onClick={() => setRhDropdownOpen(!isRhDropdownOpen)}
            >
              <HiOutlineCalendar />
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
                  to="/admin/dashboards"
                  className="menu-item"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setRhDropdownOpen(false);
                  }}
                >
                  Dashboards
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
              <HiOutlineLockClosed />
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

        <div className="notification-bell" ref={notificationRef}>
          <button className="icon-button" onClick={handleOpenNotifications}>
            <HiOutlineBell />
            {unreadCount > 0 && (
              <span className="notification-badge">{unreadCount}</span>
            )}
          </button>
          <NotificationModal
            isOpen={isNotificationOpen}
            notifications={notifications}
          />
        </div>

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
                <HiOutlineUserCircle className="menu-user-icon" />
              )}
            </div>
          </NavLink>
        )}
      </div>
    </nav>
  );
};

export default Menu;
