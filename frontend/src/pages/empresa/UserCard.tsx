import React from "react";

interface User {
  id: number;
  nome: string;
  email: string;
  role: "admin" | "licenciado" | "colaborador";
  avatar_url?: string;
  cargo?: string;
  setor?: string;
  unidade?: string;
  telefone?: string;
}

interface UserCardProps {
  user: User;
}

const UserCard: React.FC<UserCardProps> = ({ user }) => {
  const defaultAvatar =
    "https://res.cloudinary.com/dsgbgrll5/image/upload/v1758284145/user-dark_oxwuux.png";

  const title = [user.setor, user.cargo].filter(Boolean).join(" · ");

  return (
    <div className="user-card">
      <div className="user-card-avatar">
        <img
          src={user.avatar_url || defaultAvatar}
          alt={`Foto de ${user.nome}`}
        />
      </div>
      <h3 className="user-card-name">{user.nome}</h3>
      <p className="user-card-title">{title}</p>
      <p className="user-card-contact">{user.email}</p>
      <p className="user-card-contact">
        {user.telefone || "Telefone não informado"}
      </p>
      <div className="user-card-footer">
        <span className="user-card-unit">{user.unidade}</span>
      </div>
    </div>
  );
};

export default UserCard;
