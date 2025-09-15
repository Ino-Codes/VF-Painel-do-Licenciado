import React from "react";

interface Event {
  id: number;
  title: string;
  start_date: string;
  category: string;
  color: string;
}

interface EventCardProps {
  event: Event;
}

const EventCard: React.FC<EventCardProps> = ({ event }) => {
  const eventDate = new Date(event.start_date);

  const day = eventDate.toLocaleDateString("pt-BR", { day: "2-digit" });

  const month = eventDate
    .toLocaleDateString("pt-BR", { month: "short" })
    .replace(".", "")
    .toUpperCase();

  return (
    <div className="event-card" style={{ borderLeftColor: event.color }}>
      <div className="event-card-date">
        <span className="day">{day}</span>
        <span className="month">{month}</span>
      </div>
      <div className="event-card-info">
        <span className="category">{event.category}</span>
        <h4 className="title">{event.title}</h4>
      </div>
    </div>
  );
};

export default EventCard;
