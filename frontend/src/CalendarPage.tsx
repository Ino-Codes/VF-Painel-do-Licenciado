import React, { useState, useEffect, useCallback, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction"; // Para futuras interações
import ptBrLocale from "@fullcalendar/core/locales/pt-br"; // Importa a localização em português

import api from "./api.ts";
import { useAuth } from "./context/AuthContext.tsx";
import Menu from "./Menu.tsx";
import Footer from "./Footer.tsx";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import EventModal from "./EventModal.tsx";
import LoadingSpinner from "./LoadingSpinner.tsx";

// Interface para os dados que vêm da API
interface ApiEvent {
  id: number;
  title: string;
  details: string;
  event_date: string;
}

// O FullCalendar usa um formato de evento ligeiramente diferente
interface CalendarEvent {
  id: string;
  title: string;
  start: string; // FullCalendar lida bem com strings de data ISO
  allDay: true;
  extendedProps: {
    details: string;
  };
}

// Função para formatar os dados da API
const formatEventsForCalendar = (events: ApiEvent[]): CalendarEvent[] => {
  return events.map((event) => ({
    id: event.id.toString(),
    title: event.title,
    start: event.event_date,
    allDay: true,
    extendedProps: {
      details: event.details,
    },
  }));
};

const CalendarPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);

  // Usamos uma referência para evitar problemas de estado em callbacks do calendário
  const calendarRef = useRef<FullCalendar>(null);

  const fetchEvents = useCallback(async () => {
    if (!user) return;

    // Pega a data atual do calendário para buscar os eventos corretos
    const calendarApi = calendarRef.current?.getApi();
    const currentDate = calendarApi ? calendarApi.getDate() : new Date();

    setIsLoadingEvents(true);
    try {
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();
      const authHeaders = { headers: { "x-user-id": user.id } };

      const res = await api.get("/api/events", {
        params: { month, year },
        ...authHeaders,
      });
      setEvents(formatEventsForCalendar(res.data));
    } catch (err) {
      toast.error("Não foi possível carregar os eventos.");
    } finally {
      setIsLoadingEvents(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/");
    }
  }, [user, authLoading, navigate]);

  const handleDatesSet = () => {
    // Esta função é chamada sempre que o mês muda
    fetchEvents();
  };

  const handleSuccess = () => {
    setIsModalOpen(false);
    fetchEvents(); // Recarrega os eventos
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
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale={ptBrLocale} // Aplica o idioma português
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "", // Deixamos a direita vazia para um visual mais limpo
            }}
            events={events}
            height="auto" // Ajusta a altura ao container
            loading={isLoadingEvents} // Mostra um indicador de carregamento
            datesSet={handleDatesSet} // Função chamada ao mudar de mês/vista
          />
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
