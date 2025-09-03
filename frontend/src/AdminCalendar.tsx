import React, { useState, useEffect } from "react";
import api from "./api.ts";
import Menu from "./Menu.tsx";
import Footer from "./Footer.tsx";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction"; // para cliques no calendário
import toast from "react-hot-toast";

const AdminCalendar: React.FC = () => {
  const [events, setEvents] = useState([]);

  // Função para buscar os eventos da API
  const fetchEvents = async () => {
    try {
      const res = await api.get("/api/admin/events");
      // O FullCalendar espera os campos 'title', 'start' e 'end'
      const formattedEvents = res.data.map((event) => ({
        id: event.id,
        title: event.title,
        start: event.start_date,
        end: event.end_date,
        // Podemos usar a categoria para definir cores diferentes!
        backgroundColor:
          event.category === "Aniversário" ? "#04A146" : "#daa520",
        borderColor: event.category === "Aniversário" ? "#04A146" : "#daa520",
      }));
      setEvents(formattedEvents);
    } catch (err) {
      toast.error("Não foi possível carregar os eventos.");
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  // Função para lidar com o clique em uma data (para criar um novo evento)
  const handleDateClick = (arg) => {
    // Aqui, podemos abrir um MODAL para criar um novo evento
    // O modal receberia 'arg.dateStr' como a data de início
    alert("Abrir modal para criar evento em: " + arg.dateStr);
  };

  // Função para lidar com o clique em um evento existente (para editar/excluir)
  const handleEventClick = (arg) => {
    // Aqui, podemos abrir o mesmo MODAL, mas preenchido com os dados do evento
    // para edição ou exclusão. O id do evento é 'arg.event.id'
    alert("Abrir modal para editar o evento: " + arg.event.title);
  };

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="document-header">
          <h2>Agenda de Eventos do RH</h2>
        </div>
        <div className="calendar-container" style={{ marginTop: "20px" }}>
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            weekends={true}
            events={events}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            locale="pt-br" // Para traduzir
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,dayGridWeek",
            }}
            buttonText={{
              today: "Hoje",
              month: "Mês",
              week: "Semana",
            }}
          />
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AdminCalendar;
