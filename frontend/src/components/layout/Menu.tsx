import api from "../../api.ts";
import React, { useState, useEffect, useRef } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.tsx";
import { useTheme } from "../../context/ThemeContext.tsx";
import ThemeToggleButton from "../ui/ThemeToggleButton.tsx";
// Logos
import LogoValorCorpClara from "../../img/logo-clara.png";
import LogoValorCorpEscura from "../../img/logo-escura.png";
// import LogoValorFiscal from "../../img/valor-fiscal.png";
// import LogoValorBanking from "../../img/valor-banking.png";

import NotificationModal from "../ui/NotificationModal.tsx";
import { CompanySlug } from "../../types.ts";

import { HiOutlineUserCircle, HiOutlineBell } from "react-icons/hi";
import { FaPeopleGroup, FaLock } from "react-icons/fa6";
import { FaUsers } from "react-icons/fa";

// Configuração das Empresas
const COMPANIES_CONFIG = [
  {
    name: "Valor Banking",
    slug: "valor-banking" as CompanySlug,
    color: "var(--valor-banking)", // Azul
    logo: "LogoValorBanking",
  },
  // {
  //   name: "Valor Business",
  //   slug: "valor-business" as CompanySlug,
  //   color: "var(--valor-business)", // Verde
  //   logo: "LogoValorBusiness",
  // },
  {
    name: "Valor Fiscal",
    slug: "valor-fiscal" as CompanySlug,
    color: "var(--valor-fiscal)", // Dourado
    logo: "LogoValorFiscal",
  },
];

interface Notification {
  id: number;
  message: string;
  is_read: boolean;
  link_to?: string;
  created_at: string;
}

const Menu: React.FC = () => {
  const { user, switchCompany } = useAuth();
  const { theme } = useTheme();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const currentCompanySlug = searchParams.get("company");

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const notificationRef = useRef<HTMLDivElement>(null);
  const firstName = user?.nome?.split(" ")[0] || "";

  const currentLogoValorCorp =
    theme === "light" ? LogoValorCorpEscura : LogoValorCorpClara;

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

  const handleCompanyClick = (slug: CompanySlug) => {
    switchCompany(slug);
    setIsMenuOpen(false);
  };

  const isCompanyActive = (slug: string) => {
    return currentCompanySlug === slug;
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
        {/* <img
          src={currentLogoValorCorp}
          alt="Valor Corp Logo"
          className="menu-logo"
        /> */}

        <h2 className="menu-valor-corp">
          <strong>Valor</strong>Corp
        </h2>

        <NavLink
          to="/home"
          className="menu-item"
          onClick={() => setIsMenuOpen(false)}
        >
          Home
        </NavLink>

        {COMPANIES_CONFIG.map((company) => {
          const active = isCompanyActive(company.slug);

          return (
            <Link
              key={company.slug}
              to={`/content/content-gestao?company=${company.slug}`}
              className="menu-item dropdown-trigger"
              onClick={() => {
                switchCompany(company.slug);
                setIsMenuOpen(false);
              }}
            >
              {company.name}
              {/* --- LOGO DAS EMPRESAS REMOVIDA TEMPORARIAMENTE ---
              <img
                src={
                  company.logo === "LogoValorFiscal"
                    ? LogoValorFiscal
                    : LogoValorBanking
                }
                alt={`${company.name} Logo`}
                className="menu-logo"
              />
              */}
            </Link>
          );
        })}

        {/* SEÇÃO ADMINISTRATIVA (RH e Admin Global) */}
        {(user.role === "admin" || user.role === "rh") && (
          <>
            <NavLink
              to="/admin/rh-gestao"
              className="menu-item dropdown-trigger"
              onClick={() => setIsMenuOpen(false)}
            >
              <FaPeopleGroup />
              RH
            </NavLink>

            {user.role === "admin" && (
              <NavLink
                to="/admin/admin-gestao"
                className="menu-item dropdown-trigger"
                onClick={() => setIsMenuOpen(false)}
              >
                <FaLock />
                Admin
              </NavLink>
            )}
          </>
        )}
        {user.role !== "licenciado" && (
          <>
            <NavLink
              to="/internal/internal-gestao"
              className="menu-item dropdown-trigger"
              onClick={() => setIsMenuOpen(false)}
            >
              <FaUsers />
              Área Interna
            </NavLink>
          </>
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
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
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
