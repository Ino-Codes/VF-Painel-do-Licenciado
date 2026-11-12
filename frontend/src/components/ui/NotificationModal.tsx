import React from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";

interface Notification {
  id: number;
  message: string;
  is_read: boolean;
  link_to?: string;
  created_at: string;
}

interface ModalProps {
  isOpen: boolean;
  notifications: Notification[];
}

// Painel do sino: abre descendo do ícone e recolhe ao fechar.
const NotificationModal: React.FC<ModalProps> = ({ isOpen, notifications }) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        className="notification-modal"
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.15 } }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      >
          <div className="notification-header">
            <h3>Notificações</h3>
          </div>
          <div className="notification-list">
            {notifications.length === 0 && (
              <div className="notification-item empty">
                Nenhuma notificação nova.
              </div>
            )}
            {notifications.map((notif) => (
              <Link
                to={notif.link_to || "#"}
                key={notif.id}
                className={`notification-item ${!notif.is_read ? "unread" : ""}`}
              >
                <p>{notif.message}</p>
                <small>
                  {new Date(notif.created_at).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </small>
              </Link>
            ))}
          </div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default NotificationModal;
