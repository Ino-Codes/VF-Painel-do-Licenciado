import React, { useState, useEffect, useCallback } from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import "moment/locale/pt-br"; // Importa a localização para português
import "react-big-calendar/lib/css/react-big-calendar.css";

import api from "./api.ts";
import { useAuth } from "./context/AuthContext.tsx";
import Menu from "./Menu.tsx";
import Footer from "./Footer.tsx";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import EventModal from "./EventModal.tsx";
import LoadingSpinner from "./LoadingSpinner.tsx";

// Configura o moment para usar o idioma português
moment.locale("pt-br");
const localizer = momentLocalizer(moment);

interface EventData {
  id: number;
  title: string;
  details: string;
  event_date: string;
}

// Converte os nossos eventos para o formato que o react-big-calendar espera
const formatEventsForCalendar = (events: EventData[]) => {
  return events.map((event) => ({
    id: event.id,
    title: event.title,
    start: new Date(event.event_date),
    end: new Date(event.event_date), // Para eventos de dia inteiro ou pontuais, start e end são iguais
    resource: event.details, // Usamos o campo 'resource' para guardar os detalhes
  }));
};

const CalendarPage: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);

  const fetchEvents = useCallback(
    async (date: Date) => {
      if (!user) return;
      setIsLoadingEvents(true);
      try {
        const month = date.getMonth() + 1; // getMonth() é 0-11, a API espera 1-12
        const year = date.getFullYear();

        const res = await api.get("/api/events", { params: { month, year } });
        setEvents(formatEventsForCalendar(res.data));
      } catch (err) {
        toast.error("Não foi possível carregar os eventos.");
      } finally {
        setIsLoadingEvents(false);
      }
    },
    [user]
  );

  useEffect(() => {
    if (!loading && !user) navigate("/");
    if (user) {
      fetchEvents(currentDate);
    }
  }, [user, loading, navigate, fetchEvents, currentDate]);

  const handleNavigate = (newDate: Date) => {
    setCurrentDate(newDate);
  };

  if (loading) return <LoadingSpinner />;
  if (!user) return null;

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="document-header">
          <h2>Calendário de Eventos</h2>
          {user.role === "admin" && (
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
          onSuccess={() => {
            setIsModalOpen(false);
            fetchEvents(currentDate); // Recarrega os eventos do mês atual
          }}
        />
      )}
      <Footer />
    </div>
  );
};

export default CalendarPage;
