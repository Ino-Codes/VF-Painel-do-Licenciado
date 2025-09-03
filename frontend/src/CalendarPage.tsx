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

// --- Interfaces e Funções Helper (sem alterações) ---
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
// --- Fim das Helpers ---

const CalendarPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  const getAuthHeaders = useCallback(() => {
    if (!user) return {};
    return { headers: { "x-user-id": user.id } };
  }, [user]);

  // --- ESTRUTURA APLICADA A PARTIR DO AdminUsers.tsx ---
  const fetchEvents = useCallback(async () => {
    if (!user) return;
    setIsLoadingEvents(true);

    const month = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();

    try {
      const res = await api.get("/api/events", {
        params: { month, year },
        ...getAuthHeaders(),
      });
      setEvents(formatEventsForCalendar(res.data));
    } catch (err) {
      toast.error("Não foi possível carregar os eventos.");
      setEvents([]); // Garante que a lista fique vazia em caso de erro
    } finally {
      setIsLoadingEvents(false);
    }
  }, [user, currentDate, getAuthHeaders]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/");
      return;
    }
    // A busca de dados é acionada aqui, usando a função memoizada
    if (user) {
      fetchEvents();
    }
  }, [user, authLoading, navigate, fetchEvents]);
  // --- FIM DA ESTRUTURA APLICADA ---

  const handleNavigate = (newDate: Date) => {
    setCurrentDate(newDate);
  };

  const handleSuccess = () => {
    setIsModalOpen(false);
    fetchEvents(); // Simplesmente chama a função de busca novamente
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
            <FullCalendar
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
              datesSet={(dateInfo) => handleNavigate(dateInfo.start)}
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
