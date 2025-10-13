import React from "react";
import LogosTheme from "../../components/ui/LogosTheme.tsx";

interface User {
  corporate_photo_url?: string; // Usaremos esta foto
  nome: string;
  cargo?: string;
  setor?: string;
}

interface Props {
  user: User;
  onClick: () => void;
}

const UserCard: React.FC<Props> = ({ user, onClick }) => {
  const defaultPhoto =
    "https://res.cloudinary.com/dsgbgrll5/image/upload/v1759255539/default-corporate-user_eyle7x.png";
  const title = [user.setor, user.cargo].filter(Boolean).join(" · ");

  return (
    <div className="corp-user-card" onClick={onClick}>
      <div className="corp-user-card-photo">
        <img
          src={user.corporate_photo_url || defaultPhoto}
          alt={`Foto de ${user.nome}`}
        />
      </div>
      <div className="corp-user-card-info">
        <h3 className="corp-user-card-name">{user.nome}</h3>
        <p className="corp-user-card-title">{title}</p>

        <LogosTheme imageKey="minilogo" />
      </div>
    </div>
  );
};

export default UserCard;
