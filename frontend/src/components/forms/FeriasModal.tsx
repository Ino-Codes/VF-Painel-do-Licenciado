import React from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";

const FeriasModal: React.FC<any> = ({
  isOpen,
  onClose,
  onSuccess,
  eventToView,
}) => {
  if (!isOpen || !eventToView) return null;

  const handleUpdateStatus = async (status: "Aprovado" | "Recusado") => {
    let observacao = "";
    if (status === "Recusado") {
      observacao = prompt("Por favor, insira o motivo da recusa:") || "";
      if (!observacao) {
        toast.error("É necessário fornecer um motivo para a recusa.");
        return;
      }
    }
    try {
      await api.put(`/api/vacations/${eventToView.id}/status`, {
        status,
        observacao,
      });
      toast.success(`Pedido ${status.toLowerCase()}!`);
      onSuccess();
    } catch (err) {
      toast.error("Erro ao atualizar o pedido.");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="modal-close-button" onClick={onClose}>
          &times;
        </button>

        <h2>Detalhes da Solicitação</h2>
        <div className="form-row">
          <strong>Colaborador:</strong> {eventToView.extendedProps.user_name}
        </div>
        <div className="form-row">
          <strong>Período:</strong>{" "}
          {eventToView.start.toLocaleDateString("pt-BR")} a{" "}
          {eventToView.end.toLocaleDateString("pt-BR")}
        </div>
        <div className="form-row">
          <strong>Total de dias:</strong>{" "}
          {eventToView.extendedProps.dias_solicitados}
        </div>
        <div className="form-row">
          <strong>Status Atual:</strong> {eventToView.extendedProps.status}
        </div>
        {eventToView.extendedProps.observacao && (
          <div className="form-row">
            <strong>Observação:</strong> {eventToView.extendedProps.observacao}
          </div>
        )}

        {eventToView.extendedProps.status === "Pendente" && (
          <div className="modal-actions">
            <button
              type="button"
              onClick={() => handleUpdateStatus("Recusado")}
              className="form-button-delete"
            >
              Recusar
            </button>
            <button
              type="button"
              onClick={() => handleUpdateStatus("Aprovado")}
              className="form-button"
            >
              Aprovar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeriasModal;
