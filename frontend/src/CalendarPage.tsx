import React, { useState, useEffect, useCallback } from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import "moment/locale/pt-br";
import "react-big-calendar/lib/css/react-big-calendar.css";

import api from "./api.ts";
import { useAuth } from "./context/AuthContext.tsx";
import Menu from "./Menu.tsx";
import Footer from "./Footer.tsx";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import EventModal from "./EventModal.tsx";
import LoadingSpinner from "./LoadingSpinner.tsx";

moment.locale("pt-br");
const localizer = momentLocalizer(moment);

interface EventData {
  id: number;
  title: string;
  details: string;
  event_date: string;
}

const formatEventsForCalendar = (events: EventData[]) => {
  return events.map((event) => ({
    id: event.id,
    title: event.title,
    start: new Date(event.event_date),
    end: new Date(event.event_date),
    resource: event.details,
  }));
};

const CalendarPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);

  // Unimos toda a lógica de busca e autenticação num único e robusto useEffect
  useEffect(() => {
    // 1. Lida com o caso de utilizador não logado
    if (!authLoading && !user) {
      navigate("/");
      return; // Sai do efeito para evitar mais execuções
    }

    // 2. Apenas continua se o utilizador estiver definido
    if (user) {
      setIsLoadingEvents(true);

      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();

      const authHeaders = { headers: { "x-user-id": user.id } };

      api
        .get("/api/events", {
          params: { month, year },
          ...authHeaders,
        })
        .then((res) => {
          setEvents(formatEventsForCalendar(res.data));
        })
        .catch(() => {
          toast.error("Não foi possível carregar os eventos.");
        })
        .finally(() => {
          setIsLoadingEvents(false);
        });
    }
  }, [user, authLoading, navigate, currentDate]); // O array de dependências é simples e estável

  const handleNavigate = (newDate: Date) => {
    setCurrentDate(newDate);
  };

  const handleSuccess = () => {
    setIsModalOpen(false);
    // Força o recarregamento dos eventos para o mês atual após adicionar um novo
    // Criamos uma nova instância da data para garantir que o useEffect seja acionado
    setCurrentDate(new Date(currentDate));
  };

  if (authLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="document-header">
          <h2>Calendário de Eventos</h2>
          {user?.role === "admin" && (
            <button
              className="form-button"
              onClick={() => setIsModalOpen(true)}
            >
              + Adicionar Evento
            </button>
          )}
        </div>

        <div className="calendar-container">
          {isLoadingEvents ? (
            <LoadingSpinner />
          ) : (
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              style={{ height: "70vh" }}
              onNavigate={handleNavigate}
              date={currentDate}
              messages={{
                next: "Próximo",
                previous: "Anterior",
                today: "Hoje",
                month: "Mês",
                week: "Semana",
                day: "Dia",
                agenda: "Agenda",
                date: "Data",
                time: "Hora",
                event: "Evento",
              }}
            />
          )}
        </div>
      </div>
      {isModalOpen && (
        <EventModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
      <Footer />
    </div>
  );
};

export default CalendarPage;
