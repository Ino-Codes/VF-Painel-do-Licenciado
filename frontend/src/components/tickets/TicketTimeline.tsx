import React, { useEffect, useRef, useState } from "react";
import {
  FiInbox,
  FiPlayCircle,
  FiPauseCircle,
  FiRotateCcw,
  FiCheckCircle,
  FiTag,
  FiUserCheck,
  FiMessageSquare,
  FiSend,
} from "react-icons/fi";
import { IconType } from "react-icons";
import api from "../../api.ts";
import { tipoInfo } from "./ticketTypes.ts";

// Linha do tempo do chamado na Central: trocas de status, classificação,
// atendimento assumido e comentários dos atendentes. Comentário só se soma —
// ninguém sobrescreve o de ninguém (substitui o antigo campo "Observação").

export interface EventoChamado {
  id: string;
  kind:
    | "status"
    | "comentario"
    | "classificacao"
    | "reclassificacao"
    | "assumido";
  body: string | null;
  meta: Record<string, any>;
  user_id: number | null;
  user_name: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  novo: "Novo",
  analise: "Em análise",
  andamento: "Em andamento",
  pausado: "Pausado",
  concluido: "Concluído",
};

const COMENTARIO_MAX = 5000;

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Ícone e frase de um evento que não é comentário. */
const descrever = (e: EventoChamado): { Icon: IconType; texto: React.ReactNode } => {
  const quem = <strong>{e.user_name || "Alguém"}</strong>;
  if (e.kind === "status") {
    const { de, para } = e.meta || {};
    if (!de) return { Icon: FiInbox, texto: <>Chamado aberto{e.user_name ? <> por {quem}</> : null}</> };
    if (de === "novo" && para === "andamento") return { Icon: FiPlayCircle, texto: <>{quem} iniciou o atendimento</> };
    if (para === "pausado") return { Icon: FiPauseCircle, texto: <>{quem} pausou o atendimento</> };
    if (de === "pausado" && para === "andamento") return { Icon: FiRotateCcw, texto: <>{quem} retomou o atendimento</> };
    if (para === "concluido") return { Icon: FiCheckCircle, texto: <>{quem} concluiu o chamado</> };
    return {
      Icon: FiRotateCcw,
      texto: <>{quem} mudou de {STATUS_LABEL[de] || de} para {STATUS_LABEL[para] || para}</>,
    };
  }
  if (e.kind === "classificacao") {
    return { Icon: FiTag, texto: <>{quem} classificou como <strong>{tipoInfo(e.meta?.type).label}</strong></> };
  }
  if (e.kind === "reclassificacao") {
    return {
      Icon: FiTag,
      texto: (
        <>
          {quem} reclassificou de {tipoInfo(e.meta?.de).label} para{" "}
          <strong>{tipoInfo(e.meta?.para).label}</strong>
        </>
      ),
    };
  }
  // assumido
  return {
    Icon: FiUserCheck,
    texto: (
      <>
        {quem} assumiu o atendimento
        {e.meta?.de_nome ? <> de {e.meta.de_nome}</> : null}
      </>
    ),
  };
};

interface Props {
  ticketId: number;
  /** Muda quando o chamado é alterado fora daqui: recarrega a linha. */
  versao?: number;
  podeComentar: boolean;
}

const TicketTimeline: React.FC<Props> = ({ ticketId, versao = 0, podeComentar }) => {
  const [eventos, setEventos] = useState<EventoChamado[] | null>(null);
  const [erro, setErro] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState("");
  const fimRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    let ativo = true;
    api
      .get(`/api/tickets/${ticketId}/timeline`)
      .then((res) => {
        if (!ativo) return;
        setEventos(res.data);
        setErro(false);
      })
      .catch(() => ativo && setErro(true));
    return () => {
      ativo = false;
    };
  }, [ticketId, versao]);

  const comentar = async () => {
    const limpo = texto.trim();
    if (!limpo || enviando) return;
    setEnviando(true);
    setErroEnvio("");
    try {
      const res = await api.post(`/api/tickets/${ticketId}/comentarios`, {
        texto: limpo,
      });
      setEventos((atual) => [...(atual || []), res.data]);
      setTexto("");
      setTimeout(() => fimRef.current?.scrollIntoView?.({ block: "nearest" }), 0);
    } catch (err: any) {
      setErroEnvio(err?.response?.data?.error || "Não foi possível comentar.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="ticket-timeline">
      <span className="kanban-modal-resolution-label">Linha do tempo</span>

      {erro ? (
        <p className="ticket-timeline-vazio">Não foi possível carregar a linha do tempo.</p>
      ) : eventos === null ? (
        <p className="ticket-timeline-vazio">Carregando…</p>
      ) : eventos.length === 0 ? (
        <p className="ticket-timeline-vazio">Nada registrado ainda.</p>
      ) : (
        <ol className="ticket-timeline-lista">
          {eventos.map((e, i) => {
            const ultimo = i === eventos.length - 1;
            if (e.kind === "comentario") {
              const antigo = e.meta?.origem === "observacao";
              return (
                <li
                  key={e.id}
                  ref={ultimo ? fimRef : undefined}
                  className="ticket-timeline-item ticket-timeline-item--comentario"
                >
                  <span className="ticket-timeline-icone" aria-hidden="true">
                    <FiMessageSquare />
                  </span>
                  <div className="ticket-timeline-comentario">
                    <div className="ticket-timeline-autor">
                      <strong>{antigo ? "Observação anterior" : e.user_name || "Alguém"}</strong>
                      <time dateTime={e.created_at}>{quando(e.created_at)}</time>
                    </div>
                    <p>{e.body}</p>
                  </div>
                </li>
              );
            }
            const { Icon, texto: frase } = descrever(e);
            return (
              <li key={e.id} ref={ultimo ? fimRef : undefined} className="ticket-timeline-item">
                <span className="ticket-timeline-icone" aria-hidden="true">
                  <Icon />
                </span>
                <div className="ticket-timeline-evento">
                  <span>{frase}</span>
                  <time dateTime={e.created_at}>{quando(e.created_at)}</time>
                  {e.kind === "assumido" && e.body && (
                    <p className="ticket-timeline-motivo">Motivo: {e.body}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {podeComentar && (
        <div className="ticket-timeline-novo">
          <textarea
            aria-label="Novo comentário"
            className="kanban-modal-resolution-textarea"
            placeholder="Escreva um comentário para a equipe (Ctrl+Enter envia)"
            value={texto}
            maxLength={COMENTARIO_MAX}
            rows={2}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                comentar();
              }
            }}
            disabled={enviando}
          />
          {erroEnvio && <span className="ticket-timeline-erro">{erroEnvio}</span>}
          <button
            type="button"
            className="ticket-modal-action-btn ticket-modal-action-btn--secondary btn-icon-text"
            onClick={comentar}
            disabled={enviando || !texto.trim()}
          >
            <FiSend aria-hidden="true" />
            {enviando ? "Enviando..." : "Comentar"}
          </button>
        </div>
      )}
    </div>
  );
};

export default TicketTimeline;
