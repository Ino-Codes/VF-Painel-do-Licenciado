import React, { useState, useEffect, useCallback } from "react";
import api from "../../api.ts";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext.tsx";
import { useNavigate } from "react-router-dom";
import FeriasModal from "../../components/forms/FeriasModal.tsx"; // Importe o novo modal

const statusColors = {
  Pendente: "#daa52070", // Dourado
  Aprovado: "#28a74570", // Verde
  Recusado: "#dc354570", // Vermelho
};

const GestaoFerias: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  useEffect(() => {
    if (!loading && (!user || (user.role !== "admin" && user.role !== "rh"))) {
      toast.error("Acesso restrito.");
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  const fetchVacations = useCallback(async () => {
    try {
      const res = await api.get("/api/vacations");
      const formattedEvents = res.data.map((req: any) => ({
        id: req.id,
        title: req.user_name,
        start: req.start_date,
        // Adiciona 1 dia ao end_date para que o FullCalendar inclua o último dia
        end: new Date(
          new Date(req.end_date).setDate(new Date(req.end_date).getDate() + 1)
        )
          .toISOString()
          .split("T")[0],
        backgroundColor:
          statusColors[req.status as keyof typeof statusColors] || "#6c757d",
        borderColor:
          statusColors[req.status as keyof typeof statusColors] || "#6c757d",
        extendedProps: { ...req },
      }));
      setEvents(formattedEvents);
    } catch (err) {
      toast.error("Não foi possível carregar as solicitações de férias.");
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchVacations();
    }
  }, [user, fetchVacations]);

  const handleEventClick = (arg: any) => {
    setSelectedEvent(arg.event);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedEvent(null);
  };

  const handleModalSuccess = () => {
    handleModalClose();
    fetchVacations();
  };

  if (loading || !user)
    return <div className="tela-loading">Carregando...</div>;

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="document-header">
          <h2>Agenda de Férias e Ausências</h2>
        </div>
        <div className="calendar-container" style={{ marginTop: "20px" }}>
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            weekends={true}
            events={events}
            locale="pt-br"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,dayGridWeek",
            }}
            buttonText={{ today: "Hoje", month: "Mês", week: "Semana" }}
            eventClick={handleEventClick}
            editable={false} // Desativamos o arrastar e soltar
            height="auto"
          />
        </div>
      </div>
      <FeriasModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        eventToView={selectedEvent}
      />
      <Footer />
    </div>
  );
};

export default GestaoFerias;
