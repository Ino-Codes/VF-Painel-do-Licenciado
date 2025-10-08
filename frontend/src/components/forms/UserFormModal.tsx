// frontend/src/pages/admin/UserFormModal.tsx
import React from "react";
import UserForm from "../../pages/admin/UserForm.tsx"; // Importa o formulário que acabámos de criar

const UserFormModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userToEdit: any | null; // Usamos 'any' para simplificar a passagem de props
  formType: "licenciado" | "interno";
}> = ({ isOpen, onClose, onSuccess, userToEdit, formType }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <UserForm
          userToEdit={userToEdit}
          formType={formType}
          onSuccess={onSuccess}
          onCancel={onClose}
        />
      </div>
    </div>
  );
};

export default UserFormModal;
