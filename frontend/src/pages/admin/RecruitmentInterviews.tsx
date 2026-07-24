import React, { useState, useEffect, useCallback } from "react";
import api from "../../api.ts";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import toast from "react-hot-toast";
import InterviewModal from "../../components/recruitment/InterviewModal.tsx";
import { useAuth } from "../../context/AuthContext.tsx";
import { useNavigate } from "react-router-dom";

const RecruitmentInterviews: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<any | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const fetchInterviews = useCallback(async () => {
    try {
      const res = await api.get("/api/recruitment/interviews");
      const formatted = res.data.map((it: any) => ({
        id: it.id,
        title: `${it.candidate_name || ""}${it.title ? " - " + it.title : ""}`,
        start: it.start_at,
        end: it.end_at,
        backgroundColor: it.is_virtual ? "#81a7e1" : "#81e18c",
        borderColor: it.is_virtual ? "#81a7e1" : "#81e18c",
        extendedProps: {
          ...it,
        },
      }));
      setEvents(formatted);
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível carregar entrevistas.");
    }
  }, []);

  useEffect(() => {
    if (!loading && (!user || (user.role !== "admin" && user.role !== "rh"))) {
      toast.error("Acesso restrito aos administradores.");
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

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
    setSelectedInterview(arg.event.extendedProps);
    setSelectedDate(null);
    setIsModalOpen(true);
  };

  const handleEventDrop = async (arg: any) => {
    const { event } = arg;
    const ext = event.extendedProps || {};
    const payload = {
      candidate_id: ext.candidate_id,
      interviewer_id: ext.interviewer_id,
      stage_id: ext.stage_id,
      title: ext.title || event.title,
      description: ext.description,
      start_at: event.start.toISOString(),
      end_at: event.end ? event.end.toISOString() : null,
      is_virtual: !!ext.is_virtual,
      meeting_link: ext.meeting_link,
      location: ext.location,
      status: ext.status || "scheduled",
    };

    try {
      await api.put(`/api/recruitment/interviews/${event.id}`, payload);
      toast.success("Entrevista atualizada com sucesso.");
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
              if (arg.event.end && arg.event.end < now)
                return ["fc-event-past"];
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

export default RecruitmentInterviews;
