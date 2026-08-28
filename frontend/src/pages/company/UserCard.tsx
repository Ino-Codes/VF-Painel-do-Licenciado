import React, { useState } from "react";

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

// Iniciais (até duas) para o avatar de fallback.
const getInitials = (nome: string) =>
  nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

const UserCard: React.FC<Props> = ({ user, onClick }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const title = [user.setor, user.cargo].filter(Boolean).join(" · ");

  // Sem URL ou com imagem quebrada (404) → mostra as iniciais num avatar
  // dourado, em vez do texto alternativo sobre um card vazio.
  const showImg = Boolean(user.corporate_photo_url) && !imgFailed;

  return (
    <div className="corp-user-card" onClick={onClick}>
      <div className="corp-user-card-photo">
        {showImg ? (
          <img
            src={user.corporate_photo_url}
            alt={`Foto de ${user.nome}`}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div
            className="corp-user-card-photo-fallback"
            role="img"
            aria-label={`Foto de ${user.nome}`}
          >
            {getInitials(user.nome)}
          </div>
        )}
      </div>
      <div className="corp-user-card-info">
        <h3 className="corp-user-card-name">{user.nome}</h3>
        <p className="corp-user-card-title">{title}</p>
      </div>
    </div>
  );
};

export default UserCard;
