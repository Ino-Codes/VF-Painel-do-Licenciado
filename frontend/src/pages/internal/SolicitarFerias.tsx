import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext.tsx";
import { useNavigate } from "react-router-dom";
import api from "../../api.ts";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ptBR } from "date-fns/locale/pt-BR";
import { addDays, isWithinInterval, parseISO } from "date-fns";
import toast from "react-hot-toast";

registerLocale("pt-BR", ptBR);

interface VacationRequest {
  id: number;
  start_date: string;
  end_date: string;
  dias_solicitados: number;
  status: "Pendente" | "Aprovado" | "Recusado";
}

const SolicitarFerias: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [saldoFerias, setSaldoFerias] = useState(0);
  const [requests, setRequests] = useState<VacationRequest[]>([]);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get("/api/vacations/me");
      setSaldoFerias(res.data.saldo_ferias);
      setRequests(res.data.requests);
    } catch (err) {
      toast.error("Erro ao carregar seus dados de férias.");
    }
  }, []);

  useEffect(() => {
    if (!loading && (!user || user.role === "licenciado")) {
      toast.error("Acesso restrito.");
      navigate("/dashboard");
    } else if (user) {
      fetchData();
    }
  }, [user, loading, navigate, fetchData]);

  const handleSubmit = async () => {
    if (!startDate || !endDate) {
      toast.error("Por favor, selecione o período completo.");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post("/api/vacations", {
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
      });
      toast.success("Solicitação enviada!");
      setStartDate(null);
      setEndDate(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Erro ao enviar solicitação.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDayClassName = (date: Date): string | null => {
    for (const req of requests) {
      if (req.status === "Pendente" || req.status === "Aprovado") {
        const start = parseISO(req.start_date);
        const end = parseISO(req.end_date);

        // Ajusta a data atual para meia-noite UTC para comparação correta
        const currentDate = new Date(
          Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
        );

        if (isWithinInterval(currentDate, { start, end })) {
          return req.status === "Pendente"
            ? "react-datepicker__day--highlighted-pending"
            : "react-datepicker__day--highlighted-approved";
        }
      }
    }
  };

  const excludeIntervals = requests
    .filter((req) => req.status === "Aprovado") // Filtra APENAS os aprovados
    .map((req) => ({
      start: parseISO(req.start_date), // Converte a string de data para objeto Date
      end: parseISO(req.end_date), // Converte a string de data para objeto Date
    }));

  const statusColors = {
    Pendente: "status-pending",
    Aprovado: "status-validated",
    Recusado: "status-declined",
  };

  if (loading || !user)
    return <div className="tela-loading">Carregando...</div>;

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="page-header">
          <h2>Solicitar Férias</h2>
          <p>
            Nesta tela você poderá solicitar o agendamento das suas férias.
            Atente-se que para solicitar as férias é necessário ter saldo
            disponível.
          </p>
        </div>

        <div className="admin-section">
          <h3>Seu Saldo</h3>
          <p>
            Você tem <strong>{saldoFerias} dias</strong> de férias disponíveis.
          </p>
        </div>

        <div className="admin-section-main-columns">
          <div className="admin-section">
            <h3>Nova Solicitação</h3>
            <p>
              Selecione o período desejado. Os dias já solicitados (pendentes ou
              aprovados) estão destacados.
            </p>
            <div className="date-picker-container">
              <DatePicker
                selected={startDate}
                onChange={(dates: [Date | null, Date | null]) => {
                  const [start, end] = dates;
                  setStartDate(start);
                  setEndDate(end);
                }}
                startDate={startDate}
                endDate={endDate}
                selectsRange
                inline
                locale="pt-BR"
                dateFormat="dd/MM/yyyy"
                dayClassName={getDayClassName}
                excludeDateIntervals={excludeIntervals}
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !startDate || !endDate}
              className="form-button"
            >
              {isSubmitting ? "Enviando..." : "Enviar Solicitação"}
            </button>
          </div>
          <div className="admin-section">
            <h3>Histórico de Solicitações</h3>
            <div className="vacation-history-list">
              {requests.length > 0 ? (
                requests.map((req) => (
                  <div key={req.id} className="vacation-history-item">
                    <div className="vacation-history-item-info">
                      <strong>
                        {new Date(req.start_date).toLocaleDateString("pt-BR")} a{" "}
                        {new Date(req.end_date).toLocaleDateString("pt-BR")}
                      </strong>
                      <small>{req.dias_solicitados} dias solicitados</small>
                    </div>
                    <span
                      className={`status-badge ${
                        statusColors[req.status as keyof typeof statusColors]
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>
                ))
              ) : (
                <p>Nenhuma solicitação encontrada.</p>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default SolicitarFerias;
