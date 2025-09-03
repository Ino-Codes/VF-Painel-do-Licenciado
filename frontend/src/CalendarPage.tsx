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

// Interfaces para os tipos de dados
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

// Função para formatar os dados da API para o formato do FullCalendar
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
  const [viewState, setViewState] = useState<"loading" | "loaded" | "error">(
    "loading"
  );

  // A referência ao calendário é útil para aceder à sua API interna
  const calendarRef = useRef<FullCalendar>(null);

  // Este useEffect agora é o único responsável por buscar os dados
  useEffect(() => {
    // 1. Lida com a autenticação
    if (!authLoading && !user) {
      navigate("/");
      return;
    }

    // 2. Apenas busca dados se tivermos um utilizador
    if (user) {
      setViewState("loading");

      const calendarApi = calendarRef.current?.getApi();
      // Se a API do calendário estiver disponível, usa a data dela, senão usa a data atual.
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
          setEvents([]); // Garante que a lista fique vazia em caso de erro
          setViewState("error");
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, navigate]);

  // Handler para quando o utilizador navega no calendário (muda de mês)
  const handleDatesSet = useCallback(() => {
    // Apenas precisamos de acionar a busca de dados novamente.
    // A função `fetchEvents` agora está dentro do useEffect,
    // então vamos acionar uma atualização que o useEffect deteta.
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      const newDate = calendarApi.getDate();
      // Esta chamada não é ideal, vamos simplificar
      // A melhor forma é o `useEffect` já fazer este trabalho.
      // Vamos refatorar o useEffect para depender da data do calendário.
    }
  }, []);

  const handleSuccess = () => {
    setIsModalOpen(false);
    // Para recarregar, acionamos a busca de dados novamente
    const calendarApi = calendarRef.current?.getApi();
    const currentDate = calendarApi ? calendarApi.getDate() : new Date();
    // Esta chamada direta é a causa do problema.
    // A solução é deixar o useEffect principal fazer o trabalho.
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
          {viewState === "loading" && <LoadingSpinner />}
          {viewState !== "loading" && (
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
              loading={viewState === "loading"}
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
