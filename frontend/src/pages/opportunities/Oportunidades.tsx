import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext.tsx";
import api from "../../api.ts";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import toast from "react-hot-toast";
import OportunidadeModal from "../../components/forms/OportunidadeModal.tsx";

interface Opportunity {
  id: number;
  client_name: string;
  client_cnpj: string;
  status: "Pendente" | "Validado" | "Declinado";
  created_at: string;
}

const Oportunidades: React.FC = () => {
  const { user } = useAuth();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchOpportunities = useCallback(async () => {
    try {
      const res = await api.get("/api/opportunities");
      setOpportunities(res.data);
    } catch (err) {
      toast.error("Erro ao buscar indicações.");
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchOpportunities();
    }
  }, [user, fetchOpportunities]);

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      await api.put(`/api/opportunities/${id}/status`, { status: newStatus });
      toast.success("Status atualizado!");
      fetchOpportunities(); // Recarrega a lista
    } catch (err) {
      toast.error("Não foi possível atualizar o status.");
    }
  };

  const statusColors = {
    Pendente: "status-pending",
    Validado: "status-validated",
    Declinado: "status-declined",
  };

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="document-header">
          <h2>Indicação de Oportunidades</h2>
          {user?.role === "licenciado" && (
            <button
              className="form-button"
              onClick={() => setIsModalOpen(true)}
            >
              + Nova Indicação
            </button>
          )}
        </div>

        <div className="list-container">
          <div className="list-header">
            <span>Empresa</span>
            <span>Data de Indicação</span>
            <span>Status</span>
          </div>
          {opportunities.map((op) => (
            <div key={op.id} className="list-item">
              <div className="item-main-info">
                <strong>{op.client_name}</strong>
                <small>CNPJ: {op.client_cnpj}</small>
              </div>
              <span>{new Date(op.created_at).toLocaleDateString("pt-BR")}</span>

              {/* Lógica condicional para o campo de status */}
              {user?.role === "licenciado" ? (
                <span className={`status-badge ${statusColors[op.status]}`}>
                  {op.status}
                </span>
              ) : (
                <select
                  className="status-select"
                  value={op.status}
                  onChange={(e) => handleStatusChange(op.id, e.target.value)}
                >
                  <option value="Pendente">Pendente</option>
                  <option value="Validado">Validado</option>
                  <option value="Declinado">Declinado</option>
                </select>
              )}
            </div>
          ))}
          {opportunities.length === 0 && (
            <p style={{ textAlign: "center", padding: "20px" }}>
              Nenhuma indicação encontrada.
            </p>
          )}
        </div>
      </div>
      <Footer />
      <OportunidadeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchOpportunities}
      />
    </div>
  );
};

export default Oportunidades;
