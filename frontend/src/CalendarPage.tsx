import React, { useState, useEffect, useCallback } from "react";
import { Calendar, momentLocalizer, Views } from "react-big-calendar";
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

  // Usamos um estado mais explícito para a visualização
  const [viewState, setViewState] = useState<"loading" | "loaded" | "error">(
    "loading"
  );

  // Este useEffect agora centraliza toda a lógica de busca de dados
  useEffect(() => {
    // 1. Lida com o caso de utilizador não logado
    if (!authLoading && !user) {
      navigate("/");
      return; // Sai do efeito para evitar mais execuções
    }

    // 2. Apenas continua se o utilizador estiver definido e autenticado
    if (user) {
      setViewState("loading");

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
          setViewState("loaded"); // Marca como carregado com sucesso
        })
        .catch(() => {
          toast.error("Não foi possível carregar os eventos.");
          setEvents([]); // Garante que a lista fique vazia em caso de erro
          setViewState("error"); // Marca que ocorreu um erro
        });
    }
  }, [user, authLoading, navigate, currentDate]); // O array de dependências está simples e estável

  const handleNavigate = (newDate: Date) => {
    setCurrentDate(newDate);
  };

  const handleSuccess = () => {
    setIsModalOpen(false);
    // Força o recarregamento dos eventos para o mês atual
    setCurrentDate(new Date(currentDate));
  };

  // Renderiza o spinner de carregamento inicial enquanto a autenticação está a ser verificada
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
              events={events} // Passa os eventos (mesmo que seja um array vazio)
              startAccessor="start"
              endAccessor="end"
              style={{ height: "70vh" }}
              onNavigate={handleNavigate}
              date={currentDate}
              views={[Views.MONTH]} // Força a visualização apenas por Mês
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
