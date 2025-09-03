// frontend/src/AdminCalendar.tsx

import React, { useState, useEffect, useCallback } from "react";
import api from "./api.ts";
import Menu from "./Menu.tsx";
import Footer from "./Footer.tsx";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid"; // PLUGIN ADICIONADO
import interactionPlugin from "@fullcalendar/interaction";
import toast from "react-hot-toast";
import EventModal from "./EventModal.tsx";
import { useAuth } from "./context/AuthContext.tsx";
import { useNavigate } from "react-router-dom";

const AdminCalendar: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      toast.error("Acesso restrito a administradores.");
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await api.get("/api/admin/events");
      const formattedEvents = res.data.map((event: any) => ({
        id: event.id,
        title: event.title,
        start: event.start_date,
        end: event.end_date,
        extendedProps: {
          description: event.description,
          category: event.category,
        },
        backgroundColor:
          event.category === "Aniversário"
            ? "#04A146"
            : event.category === "Feriado"
            ? "#C82333"
            : "#daa520",
        borderColor:
          event.category === "Aniversário"
            ? "#04A146"
            : event.category === "Feriado"
            ? "#C82333"
            : "#daa520",
      }));
      setEvents(formattedEvents);
    } catch (err) {
      toast.error("Não foi possível carregar os eventos.");
    }
  }, []);

  useEffect(() => {
    if (user && user.role === "admin") {
      fetchEvents();
    }
  }, [user, fetchEvents]);

  const handleDateClick = (arg: any) => {
    setSelectedDate(arg.dateStr);
    setSelectedEvent(null);
    setIsModalOpen(true);
  };

  const handleEventClick = (arg: any) => {
    const eventData = {
      id: arg.event.id,
      title: arg.event.title,
      start_date: arg.event.start, // Usar arg.event.start que já é um objeto Date
      end_date: arg.event.end, // Usar arg.event.end que já é um objeto Date
      description: arg.event.extendedProps.description,
      category: arg.event.extendedProps.category,
    };
    setSelectedEvent(eventData);
    setSelectedDate(null);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedEvent(null);
    setSelectedDate(null);
  };

  const handleModalSuccess = () => {
    handleModalClose();
    fetchEvents();
  };

  if (loading || !user || user.role !== "admin") {
    return <div className="tela-loading">Carregando...</div>;
  }

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="document-header">
          <h2>Agenda de Eventos</h2>
        </div>
        <div className="calendar-container" style={{ marginTop: "20px" }}>
          <FullCalendar
            // PLUGINS ATUALIZADOS
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            weekends={true}
            events={events}
            locale="pt-br"
            // HEADER ATUALIZADO para incluir as novas visualizações
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            // TEXTOS DOS BOTÕES ATUALIZADOS
            buttonText={{
              today: "Hoje",
              month: "Mês",
              week: "Semana",
              day: "Dia",
            }}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            editable={false}
            nowIndicator={true} // Mostra um indicador da hora atual
            eventTimeFormat={{
              // Formata a hora do evento
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }}
          />
        </div>
      </div>
      {isModalOpen && (
        <EventModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
          eventToEdit={selectedEvent}
          selectedDate={selectedDate}
        />
      )}
      <Footer />
    </div>
  );
};

export default AdminCalendar;
