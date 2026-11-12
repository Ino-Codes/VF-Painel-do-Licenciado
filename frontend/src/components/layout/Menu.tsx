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
import toast from "react-hot-toast";
import { AnimatePresence, motion } from "motion/react";
import { MOLA } from "../../utils/animacao.ts";

import { HiOutlineUserCircle, HiOutlineBell } from "react-icons/hi";
import { FaLock } from "react-icons/fa6";
import { FaUsers, FaFolderOpen } from "react-icons/fa";

interface Notification {
  id: number;
  message: string;
  is_read: boolean;
  link_to?: string;
  created_at: string;
}

// Telas do hub Admin (RH foi consolidado aqui). O item de menu aparece para
// quem tem o `.view`/`.manage` de qualquer card exibido em AdminGestao.
const ADMIN_SCREENS = [
  "users.view",
  "groups.view",
  "feedbacks.view",
  "tickets.view",
  "courses.manage",
  "events.manage",
  "analytics.view",
  "logs.view",
  "meeting_records.view",
  "widget_tenants.view",
  "projects.view",
  "units.view",
  "praises.view",
  "it_assets.view",
];

// Quantas não lidas havia na última consulta. Fica fora do componente porque
// cada tela monta o seu próprio <Menu>: assim, ao trocar de tela, dá para
// saber se chegou notificação nova desde a última vez.
let ultimaConsulta: { userId: number; naoLidas: number } | null = null;
// Notificações novas são buscadas de tempos em tempos com a aba visível.
const INTERVALO_NOTIFICACOES_MS = 60_000;

const Menu: React.FC = () => {
  const { user, hasPermission, hasAnyPermission } = useAuth();
  const { theme } = useTheme();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  // Cada incremento faz o sino balançar uma vez.
  const [balancos, setBalancos] = useState(0);

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
    let ativo = true;

    const buscar = () => {
      if (document.hidden) return;
      api
        .get("/api/notifications")
        .then((res) => {
          if (!ativo) return;
          const lista: Notification[] = res.data;
          const naoLidas = lista.filter((n) => !n.is_read);
          setNotifications(lista);
          setUnreadCount(naoLidas.length);

          const antes =
            ultimaConsulta && ultimaConsulta.userId === user.id ? ultimaConsulta.naoLidas : null;
          ultimaConsulta = { userId: user.id, naoLidas: naoLidas.length };

          if (antes === null) {
            // Primeira consulta da sessão: só avisa que há algo por ler.
            if (naoLidas.length > 0) setBalancos((b) => b + 1);
          } else if (naoLidas.length > antes) {
            const chegaram = naoLidas.length - antes;
            setBalancos((b) => b + 1);
            toast(
              chegaram === 1 ? naoLidas[0].message : `Você tem ${chegaram} notificações novas.`,
              { icon: <HiOutlineBell aria-hidden="true" />, id: "notificacao-nova", duration: 5000 },
            );
          }
        })
        .catch(() => console.error("Erro ao buscar notificações."));
    };

    buscar();
    const timer = setInterval(buscar, INTERVALO_NOTIFICACOES_MS);
    const aoVoltar = () => {
      if (!document.hidden) buscar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      ativo = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [user]);

  const handleOpenNotifications = () => {
    setIsNotificationOpen(true);
    if (unreadCount > 0) {
      api
        .post("/api/notifications/mark-read")
        .then(() => {
          setUnreadCount(0);
          if (user) ultimaConsulta = { userId: user.id, naoLidas: 0 };
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
        aria-label={isMenuOpen ? "Fechar menu" : "Abrir menu"}
        aria-expanded={isMenuOpen}
      >
        &#9776;
      </button>

      <div className={`menu-left ${isMenuOpen ? "open" : ""}`}>
        <img src={currentLogoVCorp} alt="V-CORP Logo" className="menu-logo" />

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

        {/* SEÇÃO ADMINISTRATIVA (RH consolidado no Admin) */}
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

      </div>

      <div className="menu-right">
        <ThemeToggleButton />

        <div className="notification-bell" ref={notificationRef}>
          <button
            className="icon-button"
            onClick={handleOpenNotifications}
            aria-label={unreadCount > 0 ? `Notificações (${unreadCount} não lidas)` : "Notificações"}
          >
            {/* A chave muda a cada notificação nova: o sino balança de novo. */}
            <motion.span
              key={balancos}
              className="notification-bell-icone"
              animate={balancos > 0 ? { rotate: [0, -18, 14, -10, 6, -2, 0] } : undefined}
              transition={{ duration: 0.8, ease: "easeInOut", delay: 0.15 }}
            >
              <HiOutlineBell aria-hidden="true" />
            </motion.span>
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.span
                  key="contador"
                  className="notification-badge"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={MOLA}
                >
                  <motion.span
                    key={unreadCount}
                    initial={{ scale: 0.4 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 600, damping: 15 }}
                  >
                    {unreadCount}
                  </motion.span>
                </motion.span>
              )}
            </AnimatePresence>
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
