import React, { useState, useEffect, useRef } from "react";
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
  const [viewState, setViewState] = useState<"loading" | "loaded" | "error">(
    "loading"
  );

  // Usamos uma referência para a data atual para estabilizar o useEffect
  const calendarRef = useRef<FullCalendar>(null);

  // Este useEffect agora é o único responsável por buscar os dados
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/");
      return;
    }

    if (user) {
      setViewState("loading");

      // Obtém a data atual do calendário se ele já estiver renderizado, senão usa a data atual
      const calendarApi = calendarRef.current?.getApi();
      const currentDate = calendarApi ? calendarApi.getDate() : new Date();

      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();
      const authHeaders = { headers: { "x-user-id": user.id } };

      api
        .get("/api/events", { params: { month, year }, ...authHeaders })
        .then((res) => {
          setEvents(formatEventsForCalendar(res.data));
          setViewState("loaded");
        })
        .catch(() => {
          toast.error("Não foi possível carregar os eventos.");
          setEvents([]);
          setViewState("error");
        });
    }
  }, [user, authLoading, navigate, calendarRef.current]); // A dependência chave agora é a referência ao calendário

  const handleSuccess = () => {
    setIsModalOpen(false);
    // Para recarregar, podemos simplesmente chamar a função fetch de novo
    const calendarApi = calendarRef.current?.getApi();
    const currentDate = calendarApi ? calendarApi.getDate() : new Date();
    // Reutilizamos a lógica de busca aqui
    if (user) {
      setViewState("loading");
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();
      const authHeaders = { headers: { "x-user-id": user.id } };
      api
        .get("/api/events", { params: { month, year }, ...authHeaders })
        .then((res) => {
          setEvents(formatEventsForCalendar(res.data));
          setViewState("loaded");
        })
        .catch(() => {
          toast.error("Não foi possível recarregar os eventos.");
          setViewState("error");
        });
    }
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
            locale={ptBrLocale}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "",
            }}
            events={events}
            height="auto"
            // O 'loading' do FullCalendar pode ser usado para feedback visual
            loading={viewState === "loading"}
            // O 'datesSet' agora só precisa de acionar um re-fetch
            datesSet={() => handleSuccess()}
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
