import React, { useState, useEffect, useCallback } from "react";
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

  // O estado para a data do calendário é a única "fonte da verdade" para a busca de dados
  const [currentDate, setCurrentDate] = useState(new Date());

  const getAuthHeaders = useCallback(() => {
    if (!user) return {};
    return { headers: { "x-user-id": user.id } };
  }, [user]);

  // Este useEffect agora é o único responsável por buscar os dados
  useEffect(() => {
    // 1. Lida com a autenticação
    if (!authLoading && !user) {
      navigate("/");
      return; // Sai do efeito para evitar mais execuções
    }

    // 2. Apenas busca dados se tivermos um utilizador
    if (user) {
      setViewState("loading");

      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();

      api
        .get("/api/events", {
          params: { month, year },
          ...getAuthHeaders(),
        })
        .then((res) => {
          setEvents(formatEventsForCalendar(res.data));
          setViewState("loaded");
        })
        .catch(() => {
          toast.error("Não foi possível carregar os eventos.");
          setEvents([]); // Garante que a lista fique vazia em caso de erro
          setViewState("error");
        });
    }
  }, [user, authLoading, navigate, currentDate, getAuthHeaders]);

  // A função de navegação apenas atualiza a data, o que aciona o useEffect
  const handleNavigate = (newDate: Date) => {
    setCurrentDate(newDate);
  };

  const handleSuccess = () => {
    setIsModalOpen(false);
    // Para recarregar os eventos, simplesmente acionamos o useEffect novamente
    // ao criar um novo objeto de data para o mês atual.
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
          {viewState === "loading" && <LoadingSpinner />}
          {viewState !== "loading" && (
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
              // A propriedade 'datesSet' é a forma correta de lidar com a navegação
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
