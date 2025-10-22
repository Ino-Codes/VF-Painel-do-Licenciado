import React, { useState, useEffect, useCallback } from "react";
import api from "../../api.ts";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import toast from "react-hot-toast";
import EventModal from "../../components/forms/EventModal.tsx";
import { useAuth } from "../../context/AuthContext.tsx";
import { useNavigate } from "react-router-dom";

const AdminCalendar: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    if (!loading && (!user || (user.role !== "admin" && user.role !== "rh"))) {
      toast.error("Acesso restrito aos administradores.");
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  const fetchCategories = useCallback(async () => {
    if (!user || (user.role !== "admin" && user.role !== "rh")) return;
    try {
      const res = await api.get("/api/admin/events/categories");
      setCategories(res.data);
    } catch (err) {
      toast.error("Não foi possível carregar as categorias de eventos.");
    }
  }, [user]);

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
          color: event.color,
        },
        backgroundColor: event.color,
        borderColor: event.color,
      }));
      setEvents(formattedEvents);
    } catch (err) {
      toast.error("Não foi possível carregar os eventos.");
    }
  }, []);

  useEffect(() => {
    if (user && user.role === "admin") {
      fetchEvents();
      fetchCategories();
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
      start_date: arg.event.start,
      end_date: arg.event.end,
      description: arg.event.extendedProps.description,
      category: arg.event.extendedProps.category,
      color: arg.event.extendedProps.color,
    };
    setSelectedEvent(eventData);
    setSelectedDate(null);
    setIsModalOpen(true);
  };

  const handleEventDrop = async (arg: any) => {
    const { event } = arg;
    const eventData = {
      title: event.title,
      description: event.extendedProps.description,
      start_date: event.start.toISOString(),
      end_date: event.end.toISOString(),
      category: event.extendedProps.category,
    };

    try {
      await api.put(`/api/admin/events/${event.id}`, eventData);
      toast.success("Evento atualizado com sucesso!");
    } catch (err) {
      toast.error("Erro ao atualizar o evento.");
      arg.revert();
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedEvent(null);
    setSelectedDate(null);
  };

  const handleModalSuccess = () => {
    handleModalClose();
    fetchEvents();
    fetchCategories();
  };

  if (loading || !user || (user.role !== "admin" && user.role !== "rh")) {
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
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            weekends={true}
            events={events}
            locale="pt-br"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            buttonText={{
              today: "Hoje",
              month: "Mês",
              week: "Semana",
              day: "Dia",
            }}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            editable={true}
            eventDrop={handleEventDrop}
            nowIndicator={true}
            eventTimeFormat={{
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }}
            slotMinTime="06:00:00"
            slotMaxTime="21:00:00"
            businessHours={{
              daysOfWeek: [1, 2, 3, 4, 5],
              startTime: "06:00",
              endTime: "21:00",
            }}
            selectConstraint="businessHours"
            eventConstraint="businessHours"
            height="auto"
            expandRows={false}
            eventClassNames={(arg) => {
              const now = new Date();
              if (arg.event.end < now) {
                return ["fc-event-past"];
              }
              return [];
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
          categories={categories}
        />
      )}
      <Footer />
    </div>
  );
};

export default AdminCalendar;
