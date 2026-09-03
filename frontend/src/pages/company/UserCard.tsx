import React, { useState } from "react";
import { FaHeart } from "react-icons/fa";

interface User {
  corporate_photo_url?: string; // Usaremos esta foto
  nome: string;
  cargo?: string;
  setor?: string;
  praise_count?: number;
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
  const praiseCount = user.praise_count || 0;

  // Sem URL ou com imagem quebrada (404) → mostra as iniciais num avatar
  // dourado, em vez do texto alternativo sobre um card vazio.
  const showImg = Boolean(user.corporate_photo_url) && !imgFailed;

  return (
    <div className="corp-user-card" onClick={onClick}>
      {praiseCount > 0 && (
        <span
          className="corp-user-praise-badge"
          title={`${praiseCount} elogio(s) recebido(s)`}
          aria-label={`${praiseCount} elogios recebidos`}
        >
          <FaHeart aria-hidden="true" /> {praiseCount}
        </span>
      )}
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
