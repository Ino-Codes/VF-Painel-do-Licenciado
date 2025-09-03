import React, { useState, useEffect, useCallback, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptBrLocale from "@fullcalendar/core/locales/pt-br";

import api from "./api.ts";
import { useAuth } from "./context/AuthContext.tsx";
import Menu from "./Menu.tsx";
import Footer from "./Footer.tsx";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import EventModal from "./EventModal.tsx";
import LoadingSpinner from "./LoadingSpinner.tsx";

// Interfaces e função de formatação (sem alterações)
interface ApiEvent {
  id: number;
  title: string;
  details: string;
  event_date: string;
}
interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  allDay: true;
  extendedProps: { details: string };
}
const formatEventsForCalendar = (events: ApiEvent[]): CalendarEvent[] => {
  return events.map((event) => ({
    id: event.id.toString(),
    title: event.title,
    start: event.event_date,
    allDay: true,
    extendedProps: { details: event.details },
  }));
};

const CalendarPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const calendarRef = useRef<FullCalendar>(null);

  // Função para buscar eventos, agora mais genérica
  const fetchEvents = useCallback(
    async (date: Date) => {
      if (!user) return;
      setIsLoading(true);
      try {
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        const authHeaders = { headers: { "x-user-id": user.id } };

        const res = await api.get("/api/events", {
          params: { month, year },
          ...authHeaders,
        });
        setEvents(formatEventsForCalendar(res.data));
      } catch (err) {
        toast.error("Não foi possível carregar os eventos.");
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  // useEffect para a busca inicial de dados
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/");
      return;
    }
    if (user) {
      fetchEvents(new Date()); // Busca os eventos para o mês atual na primeira carga
    }
  }, [user, authLoading, navigate, fetchEvents]);

  // Handler para quando o utilizador navega no calendário
  const handleDatesSet = (dateInfo: { start: Date }) => {
    // A API do FullCalendar nos dá a nova data, usamos ela para buscar os eventos
    fetchEvents(dateInfo.start);
  };

  const handleSuccess = () => {
    setIsModalOpen(false);
    // Para recarregar, podemos chamar fetchEvents com a data atual do calendário
    const calendarApi = calendarRef.current?.getApi();
    const currentDate = calendarApi ? calendarApi.getDate() : new Date();
    fetchEvents(currentDate);
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
          {/* Usamos o estado isLoading para mostrar o spinner */}
          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              locale={ptBrLocale}
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "",
              }}
              events={events}
              height="auto"
              datesSet={handleDatesSet}
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
