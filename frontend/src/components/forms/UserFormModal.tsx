import React from "react";
import UserForm from "../../pages/admin/UserForm.tsx"; // Importa o formulário que acabámos de criar

const UserFormModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userToEdit: any | null; // Usamos 'any' para simplificar a passagem de props
  formType: "licenciado" | "interno";
  managers: { id: number; nome: string }[];
}> = ({ isOpen, onClose, onSuccess, userToEdit, formType, managers }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <UserForm
          userToEdit={userToEdit}
          formType={formType}
          onSuccess={onSuccess}
          onCancel={onClose}
          managers={managers}
        />
      </div>
    </div>
  );
};

export default UserFormModal;
