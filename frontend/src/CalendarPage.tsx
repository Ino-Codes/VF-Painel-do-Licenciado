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

// Configurações do calendário
moment.locale("pt-br");
const localizer = momentLocalizer(moment);

interface ApiEvent {
  id: number;
  title: string;
  details: string;
  event_date: string;
}

interface CalendarEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  resource: string;
}

// Função Helper para formatar os dados da API para o Calendário
const formatEventsForCalendar = (events: ApiEvent[]): CalendarEvent[] => {
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

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewState, setViewState] = useState<"loading" | "loaded" | "error">(
    "loading"
  );

  // Este useEffect agora centraliza toda a lógica
  useEffect(() => {
    // 1. Lida com autenticação
    if (!authLoading && !user) {
      navigate("/");
      return;
    }

    // 2. Apenas busca dados se tivermos um utilizador
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
          toast.error("Não foi possível carregar os eventos.");
          setEvents([]);
          setViewState("error");
        });
    }
  }, [user, authLoading, navigate, currentDate]); // Dependências estáveis

  const handleNavigate = (newDate: Date) => {
    setCurrentDate(newDate);
  };

  const handleSuccess = () => {
    setIsModalOpen(false);
    // Aciona a busca de dados novamente para o mês atual
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
          {viewState === "loading" ? (
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
              views={["month"]} // Força a visualização apenas por Mês
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
