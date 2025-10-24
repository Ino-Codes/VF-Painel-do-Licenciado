import React from "react";
import { Link } from "react-router-dom";

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

const NotificationModal: React.FC<ModalProps> = ({ isOpen, notifications }) => {
  if (!isOpen) return null;

  return (
    <div className="notification-modal">
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
    </div>
  );
};

export default NotificationModal;
