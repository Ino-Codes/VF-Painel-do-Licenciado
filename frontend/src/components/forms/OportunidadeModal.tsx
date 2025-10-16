import React, { useState } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";
import { IMaskInput } from "react-imask";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const OportunidadeModal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    client_name: "",
    client_cnpj: "",
    client_contact_name: "",
    client_contact_phone: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleChange = (value: string, name: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Limpa as máscaras antes de enviar
    const payload = {
      ...formData,
      client_cnpj: formData.client_cnpj.replace(/\D/g, ""),
      client_contact_phone: formData.client_contact_phone.replace(/\D/g, ""),
    };

    try {
      await api.post("/api/opportunities", payload);
      toast.success("Oportunidade cadastrada com sucesso!");
      onSuccess();
      onClose();
    } catch (err: any) {
      if (err.response?.status === 409) {
        // Erro de CNPJ duplicado
        toast.error(err.response.data.error);
      } else {
        toast.error("Ocorreu um erro ao cadastrar a oportunidade.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Cadastrar Nova Indicação</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <input
              type="text"
              name="client_name"
              placeholder="Nome da Empresa"
              onChange={(e) => handleChange(e.target.value, "client_name")}
              required
              className="form-input"
            />
          </div>
          <div className="form-row">
            <IMaskInput
              mask="00.000.000/0000-00"
              name="client_cnpj"
              placeholder="CNPJ da Empresa"
              onAccept={(value: any) => handleChange(value, "client_cnpj")}
              required
              className="form-input"
            />
          </div>
          <div className="form-row">
            <input
              type="text"
              name="client_contact_name"
              placeholder="Nome do Contato"
              onChange={(e) =>
                handleChange(e.target.value, "client_contact_name")
              }
              required
              className="form-input"
            />
          </div>
          <div className="form-row">
            <IMaskInput
              mask="(00) 00000-0000"
              name="client_contact_phone"
              placeholder="Telefone do Contato"
              onAccept={(value: any) =>
                handleChange(value, "client_contact_phone")
              }
              required
              className="form-input"
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="form-button-cancel"
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="form-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Cadastrando..." : "Cadastrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OportunidadeModal;
