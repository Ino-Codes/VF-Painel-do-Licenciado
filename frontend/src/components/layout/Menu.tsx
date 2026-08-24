import api from "../../api.ts";
import React, { useState, useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.tsx";
import { useTheme } from "../../context/ThemeContext.tsx";
import ThemeToggleButton from "../ui/ThemeToggleButton.tsx";
// Logos
import LogoVCorpClara from "../../img/textobranco.png";
import LogoVCorpEscura from "../../img/textopreto.png";

import NotificationModal from "../ui/NotificationModal.tsx";

import { HiOutlineUserCircle, HiOutlineBell } from "react-icons/hi";
import { FaPeopleGroup, FaLock } from "react-icons/fa6";
import { FaUsers, FaFolderOpen } from "react-icons/fa";

interface Notification {
  id: number;
  message: string;
  is_read: boolean;
  link_to?: string;
  created_at: string;
}

const RH_SCREENS = [
  "users.view",
  "recruitment.view",
  "feedbacks.view",
  "analytics.view",
  "meeting_records.view",
  "courses.manage",
  "events.manage",
];
const ADMIN_SCREENS = [
  "groups.view",
  "logs.view",
  "widget_tenants.view",
  "analytics.view",
  "projects.view",
  "units.view",
];

const Menu: React.FC = () => {
  const { user, hasPermission, hasAnyPermission } = useAuth();
  const { theme } = useTheme();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const notificationRef = useRef<HTMLDivElement>(null);
  const firstName = user?.nome?.split(" ")[0] || "";

  const currentLogoVCorp = theme === "light" ? LogoVCorpEscura : LogoVCorpClara;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
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
            prev.map((n) => ({ ...n, is_read: true })),
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
        <img src={currentLogoVCorp} alt="V-CORP Logo" className="menu-logo" />

        {/* <h2 className="menu-v-corp">V-CORP</h2> */}

        <NavLink
          to="/home"
          className="menu-item"
          onClick={() => setIsMenuOpen(false)}
        >
          Home
        </NavLink>

        {hasPermission("content_hub.view") && (
          <NavLink
            to="/content/content-gestao"
            className="menu-item dropdown-trigger"
            onClick={() => setIsMenuOpen(false)}
          >
            <FaFolderOpen />
            Conteúdos
          </NavLink>
        )}

        {/* SEÇÃO ADMINISTRATIVA (RH e Admin Global) */}
        {hasAnyPermission(RH_SCREENS) && (
          <NavLink
            to="/admin/rh-gestao"
            className="menu-item dropdown-trigger"
            onClick={() => setIsMenuOpen(false)}
          >
            <FaPeopleGroup />
            RH
          </NavLink>
        )}

        {hasAnyPermission(ADMIN_SCREENS) && (
          <NavLink
            to="/admin/admin-gestao"
            className="menu-item dropdown-trigger"
            onClick={() => setIsMenuOpen(false)}
          >
            <FaLock />
            Admin
          </NavLink>
        )}

        {hasPermission("internal_access") && (
          <NavLink
            to="/internal/internal-gestao"
            className="menu-item dropdown-trigger"
            onClick={() => setIsMenuOpen(false)}
          >
            <FaUsers />
            Área Interna
          </NavLink>
        )}

        {/* <NavLink
          to="/faq"
          className="menu-item"
          onClick={() => setIsMenuOpen(false)}
        >
          FAQ
        </NavLink> */}
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
                {user.group_name ||
                  user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </span>
              <span className="profile-name">{user.nickname || firstName}</span>
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
