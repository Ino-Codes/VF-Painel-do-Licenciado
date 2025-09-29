// frontend/src/pages/Empresa/UserCard.tsx
import React from "react";

interface User {
  corporate_photo_url?: string; // Usaremos esta foto
  nome: string;
  cargo?: string;
  setor?: string;
}

const UserCard: React.FC<{ user: User }> = ({ user }) => {
  const defaultPhoto =
    "https://res.cloudinary.com/dsgbgrll5/image/upload/v1758284145/user-dark_oxwuux.png";
  const title = [user.setor, user.cargo].filter(Boolean).join(" · ");

  return (
    <div className="corp-user-card">
      <div className="corp-user-card-accent">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Ícone de chevron ou logo da empresa pode ir aqui */}
          <path
            d="M9 18L15 12L9 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="corp-user-card-photo">
        <img
          src={user.corporate_photo_url || defaultPhoto}
          alt={`Foto de ${user.nome}`}
        />
      </div>
      <div className="corp-user-card-info">
        <h3 className="corp-user-card-name">{user.nome}</h3>
        <p className="corp-user-card-title">{title}</p>
        <div className="corp-user-card-logo">
          <img
            src="https://res.cloudinary.com/dsgbgrll5/image/upload/v1759170273/mini-logo_nocnod.svg"
            alt="Valor Fiscal"
          />
          <span>Valor Fiscal</span>
        </div>
      </div>
    </div>
  );
};

export default UserCard;
