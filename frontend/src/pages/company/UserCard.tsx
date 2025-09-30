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
            src="https://painel.valorfiscal.com/static/media/logo-clara.0b00333403580519486a.png"
            alt="Valor Fiscal"
          />
        </div>
      </div>
    </div>
  );
};

export default UserCard;
