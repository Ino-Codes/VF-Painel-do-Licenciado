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
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);

  // Removido o useCallback de getAuthHeaders pois ele será usado dentro de outro useCallback
  const getAuthHeaders = () => {
    if (!user) return {};
    return { headers: { "x-user-id": user.id } };
  };

  const fetchEvents = useCallback(
    async (date: Date) => {
      // A verificação do 'user' agora está dentro do useEffect que chama esta função
      setIsLoadingEvents(true);
      try {
        const month = date.getMonth() + 1;
        const year = date.getFullYear();

        const res = await api.get("/api/events", {
          params: { month, year },
          ...getAuthHeaders(),
        });
        setEvents(formatEventsForCalendar(res.data));
      } catch (err) {
        toast.error("Não foi possível carregar os eventos.");
      } finally {
        setIsLoadingEvents(false);
      }
    },
    [user]
  ); // A dependência agora é apenas 'user'

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchEvents(currentDate);
    }
  }, [user, currentDate, fetchEvents]);

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
            fetchEvents(currentDate);
          }}
        />
      )}
      <Footer />
    </div>
  );
};

export default CalendarPage;
