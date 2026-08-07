import React, { useEffect, useState } from "react";
import api from "../../api.ts";
import toast from "react-hot-toast";
import DatePicker from "../forms/DatePicker.tsx";
import { TimePicker } from "../forms/TimePicker.tsx";

interface InterviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  interviewToEdit: any | null;
  selectedDate: string | null;
}

const InterviewModal: React.FC<InterviewModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  interviewToEdit,
  selectedDate,
}) => {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);

  const [candidateId, setCandidateId] = useState<number | null>(null);
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [candidatePhone, setCandidatePhone] = useState("");
  const [interviewerId, setInterviewerId] = useState<number | null>(null);
  const [stageId, setStageId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isVirtual, setIsVirtual] = useState(false);
  const [meetingLink, setMeetingLink] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState("scheduled");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    // load lists
    api
      .get("/api/recruitment/stages")
      .then((res) => setStages(res.data))
      .catch(() => {});
    api
      .get("/api/users/admin")
      .then((res) => setUsers(res.data))
      .catch(() => {});
    // fetch candidates (no filters) - paginated in production, but we fetch first page here
    api
      .get("/api/recruitment/candidates")
      .then((res) => setCandidates(res.data.candidates || res.data))
      .catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    const getFormattedTime = (date: Date) =>
      String(date.getHours()).padStart(2, "0") +
      ":" +
      String(date.getMinutes()).padStart(2, "0");

    if (interviewToEdit) {
      setCandidateId(interviewToEdit.candidate_id || null);
      setInterviewerId(interviewToEdit.interviewer_id || null);
      setStageId(interviewToEdit.stage_id || null);
      setTitle(interviewToEdit.title || "");
      setDescription(interviewToEdit.description || "");
      setIsVirtual(!!interviewToEdit.is_virtual);
      setMeetingLink(interviewToEdit.meeting_link || "");
      setLocation(interviewToEdit.location || "");
      setStatus(interviewToEdit.status || "scheduled");

      const start = new Date(interviewToEdit.start_at);
      const end = interviewToEdit.end_at
        ? new Date(interviewToEdit.end_at)
        : new Date(start.getTime() + 30 * 60000);
      setEventDate(start.toISOString().split("T")[0]);
      setStartTime(getFormattedTime(start));
      setEndTime(getFormattedTime(end));
    } else if (selectedDate) {
      const startDateObj = new Date(`${selectedDate}T09:00:00`);
      const endDateObj = new Date(startDateObj.getTime() + 30 * 60000);
      setCandidateId(null);
      setInterviewerId(null);
      setStageId(null);
      setTitle("");
      setDescription("");
      setIsVirtual(false);
      setMeetingLink("");
      setLocation("");
      setStatus("scheduled");
      setEventDate(startDateObj.toISOString().split("T")[0]);
      setStartTime(startDateObj.getHours().toString().padStart(2, "0") + ":00");
      setEndTime(endDateObj.getHours().toString().padStart(2, "0") + ":30");
    }
  }, [interviewToEdit, selectedDate]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if ((!candidateId && !candidateName) || !startTime || !eventDate) {
      toast.error("Preencha candidato (ou crie novo) e data/hora de início.");
      return;
    }

    const payload: any = {
      candidate_id: candidateId,
      candidate_name: candidateId ? undefined : candidateName,
      candidate_email: candidateId ? undefined : candidateEmail,
      candidate_phone: candidateId ? undefined : candidatePhone,
      interviewer_id: interviewerId,
      stage_id: stageId,
      title,
      description,
      start_at: new Date(`${eventDate}T${startTime}`).toISOString(),
      end_at: endTime
        ? new Date(`${eventDate}T${endTime}`).toISOString()
        : null,
      is_virtual: isVirtual,
      meeting_link: meetingLink,
      location,
      status,
    };

    try {
      if (interviewToEdit) {
        await api.put(
          `/api/recruitment/interviews/${interviewToEdit.id}`,
          payload
        );
        toast.success("Entrevista atualizada com sucesso.");
      } else {
        await api.post(`/api/recruitment/interviews`, payload);
        toast.success("Entrevista criada com sucesso.");
      }
      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar a entrevista.");
    }
  };

  const handleDelete = async () => {
    if (!interviewToEdit) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/recruitment/interviews/${interviewToEdit.id}`);
      toast.success("Entrevista excluída.");
      onSuccess();
    } catch (err) {
      toast.error("Erro ao excluir a entrevista.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleApprove = async () => {
    if (!interviewToEdit) return;
    try {
      await api.post(
        `/api/recruitment/interviews/${interviewToEdit.id}/approve`
      );
      toast.success("Candidato aprovado para o Kanban.");
      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao aprovar o candidato.");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button type="button" className="modal-close-button" aria-label="Fechar" onClick={onClose}>
          &times;
        </button>
        <h2>{interviewToEdit ? "Editar Entrevista" : "Agendar Entrevista"}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Candidato (selecione ou preencha dados para criar)</label>
            <select
              value={candidateId ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                setCandidateId(val ? Number(val) : null);
              }}
              className="form-input"
            >
              <option value="">(Criar novo candidato)</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || c.nome || c.email}
                </option>
              ))}
            </select>
          </div>

          {!candidateId && (
            <>
              <div className="form-row">
                <input
                  type="text"
                  placeholder="Nome do candidato"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  className="form-input"
                  required={!candidateId}
                />
              </div>
              <div className="form-row">
                <input
                  type="email"
                  placeholder="Email do candidato (opcional)"
                  value={candidateEmail}
                  onChange={(e) => setCandidateEmail(e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="form-row">
                <input
                  type="tel"
                  placeholder="Telefone do candidato (opcional)"
                  value={candidatePhone}
                  onChange={(e) => setCandidatePhone(e.target.value)}
                  className="form-input"
                />
              </div>
            </>
          )}

          <div className="form-row">
            <label>Entrevistador</label>
            <select
              value={interviewerId ?? ""}
              onChange={(e) => setInterviewerId(Number(e.target.value) || null)}
              className="form-input"
            >
              <option value="">(opcional) Selecionar entrevistador...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome || u.email}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>Etapa</label>
            <select
              value={stageId ?? ""}
              onChange={(e) => setStageId(Number(e.target.value) || null)}
              className="form-input"
            >
              <option value="">(opcional) Selecionar etapa...</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <input
              type="text"
              placeholder="Assunto (opcional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-row">
            <label>Data</label>
            <DatePicker
              value={eventDate}
              onChange={(d: string) => setEventDate(d)}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Início</label>
              <TimePicker value={startTime} onChange={setStartTime} />
            </div>
            <div className="form-group">
              <label>Fim</label>
              <TimePicker value={endTime} onChange={setEndTime} />
            </div>
          </div>

          <div className="form-row">
            <textarea
              placeholder="Descrição (opcional)..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-input"
              rows={3}
            />
          </div>

          <div className="form-row">
            <label>
              <input
                type="checkbox"
                checked={isVirtual}
                onChange={(e) => setIsVirtual(e.target.checked)}
              />{" "}
              Entrevista virtual
            </label>
          </div>

          {isVirtual && (
            <div className="form-row">
              <input
                type="text"
                placeholder="Link da reunião"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                className="form-input"
              />
            </div>
          )}

          <div className="form-row">
            <input
              type="text"
              placeholder="Local (se presencial)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="modal-actions">
            {interviewToEdit && (
              <>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="form-button delete"
                  disabled={isDeleting}
                >
                  {isDeleting ? "Excluindo..." : "Excluir"}
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  className="form-button"
                >
                  Aprovar para Kanban
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="form-button-cancel"
            >
              Cancelar
            </button>
            <button type="submit" className="form-button">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InterviewModal;
