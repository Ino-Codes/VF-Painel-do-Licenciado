import React, { useState, useEffect } from "react";
import { FaHeart } from "react-icons/fa";
import api from "../../api.ts";
import PraiseCard, { Praise } from "../../components/praises/PraiseCard.tsx";

interface User {
  id: number;
  nome: string;
  corporate_photo_url?: string;
  unit_id?: number;
  unidade?: string; // legacy support
  setor?: string;
  cargo?: string;
  email?: string;
  telefone?: string;
  birth_date?: string;
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

const formatarTelefone = (telefone?: string): string => {
  if (!telefone) return "Não informado";
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length !== 11) return telefone;
  return `(${digitos.substring(0, 2)}) ${digitos.substring(
    2,
    7
  )}-${digitos.substring(7)}`;
};

const formatarAniversario = (data?: string): string => {
  if (!data) return "Não informado";
  const [ano, mes, dia] = data.substring(0, 10).split("-");
  return `${dia}/${mes}`;
};

const UserDetailModal: React.FC<ModalProps> = ({ isOpen, onClose, user }) => {
  const [praises, setPraises] = useState<Praise[]>([]);
  const [loadingPraises, setLoadingPraises] = useState(false);

  useEffect(() => {
    if (!isOpen || !user) {
      setPraises([]);
      return;
    }
    let active = true;
    setLoadingPraises(true);
    api
      .get(`/api/praises/for-user/${user.id}`)
      .then((res) => {
        if (active) setPraises(res.data as Praise[]);
      })
      .catch(() => {
        if (active) setPraises([]);
      })
      .finally(() => {
        if (active) setLoadingPraises(false);
      });
    return () => {
      active = false;
    };
  }, [isOpen, user]);

  if (!isOpen || !user) {
    return null;
  }

  const defaultPhoto =
    "https://res.cloudinary.com/dsgbgrll5/image/upload/v1759255539/default-corporate-user_eyle7x.png";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content user-detail-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="user-detail-close-btn" onClick={onClose}>
          &times;
        </button>
        <div className="user-detail-layout">
          <div className="user-detail-photo-section">
            <div className="user-detail-photo">
              <img
                src={user.corporate_photo_url || defaultPhoto}
                alt={`Foto de ${user.nome}`}
              />
            </div>
          </div>
          <div className="user-detail-info">
            <h3 className="user-detail-name">{user.nome}</h3>
            
            <p>
              <span>Setor:</span> {user.setor || "Não informado"}
            </p>
            <p>
              <span>Cargo:</span> {user.cargo || "Não informado"}
            </p>
            <p>
              <span>Email:</span> {user.email || "Não informado"}
            </p>
            <p>
              <span>Telefone:</span> {formatarTelefone(user.telefone)}
            </p>
            <p>
              <span>Aniversário:</span> {formatarAniversario(user.birth_date)}
            </p>
          </div>
        </div>

        {!loadingPraises && praises.length > 0 && (
          <div className="user-detail-praises">
            <div className="user-detail-praises-header">
              <FaHeart className="user-detail-praises-icon" aria-hidden="true" />
              <h4 className="user-detail-praises-title">Elogios recebidos</h4>
            </div>
            <div className="praise-grid praise-grid--testimonial">
              {praises.map((p) => (
                <PraiseCard
                  key={p.id}
                  praise={p}
                  showRecipient={false}
                  variant="testimonial"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserDetailModal;
