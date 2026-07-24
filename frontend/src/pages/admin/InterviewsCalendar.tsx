import React, { useState, useEffect, useCallback } from "react";
import api from "../../api.ts";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { toast } from "react-hot-toast";
import InterviewModal from "../../components/recruitment/InterviewModal.tsx";
import { useAuth } from "../../context/AuthContext.tsx";
import { useNavigate } from "react-router-dom";

const InterviewsCalendar: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || (user.role !== "admin" && user.role !== "rh"))) {
      toast.error("Acesso restrito aos administradores.");
      navigate("/admin/dashboards");
    }
  }, [user, loading, navigate]);

  const fetchInterviews = useCallback(async () => {
    try {
      const res = await api.get("/api/recruitment/interviews");
      const formatted = (res.data || []).map((iv: any) => ({
        id: iv.id,
        title: iv.title || iv.candidate_name || "Entrevista",
        start: iv.start_at,
        end: iv.end_at || iv.start_at,
        extendedProps: {
          raw: iv,
        },
      }));
      setEvents(formatted);
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível carregar as entrevistas.");
    }
  }, []);

  useEffect(() => {
    if (user && (user.role === "admin" || user.role === "rh")) {
      fetchInterviews();
    }
  }, [user, fetchInterviews]);

  const handleDateClick = (arg: any) => {
    setSelectedDate(arg.dateStr);
    setSelectedInterview(null);
    setIsModalOpen(true);
  };

  const handleEventClick = (arg: any) => {
    const interview = arg.event.extendedProps.raw;
    setSelectedInterview(interview);
    setSelectedDate(null);
    setIsModalOpen(true);
  };

  const handleEventDrop = async (arg: any) => {
    const { event } = arg;
    const interviewId = event.id;
    const payload = {
      start_at: event.start.toISOString(),
      end_at: event.end ? event.end.toISOString() : null,
    };

    try {
      await api.put(`/api/recruitment/interviews/${interviewId}`, payload);
      toast.success("Entrevista atualizada com sucesso!");
      fetchInterviews();
    } catch (err) {
      toast.error("Erro ao atualizar a entrevista.");
      arg.revert();
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedInterview(null);
    setSelectedDate(null);
  };

  const handleModalSuccess = () => {
    handleModalClose();
    fetchInterviews();
  };

  if (loading || !user || (user.role !== "admin" && user.role !== "rh")) {
    return <div className="tela-loading">Carregando...</div>;
  }

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="document-header">
          <h2>Agenda de Entrevistas</h2>
        </div>

        <div className="calendar-container interview-calendar">
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
              if (arg.event.end && arg.event.end < now) {
                return ["fc-event-past"];
              }
              return [];
            }}
          />
        </div>
      </div>

      {isModalOpen && (
        <InterviewModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
          interviewToEdit={selectedInterview}
          selectedDate={selectedDate}
        />
      )}

      <Footer />
    </div>
  );
};

export default InterviewsCalendar;
