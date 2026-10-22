import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { FiAward, FiCheck, FiDownload, FiExternalLink, FiPlay } from "react-icons/fi";
import api from "../../api.ts";
import { useAuth } from "../../context/AuthContext.tsx";
import LoadingSpinner from "../ui/LoadingSpinner.tsx";
import CapaPadraoCurso from "../../img/curso-padrao.webp";

// Formato do GET /api/certificates/mine.
interface CursoDoAluno {
  courseId: number;
  titulo: string;
  thumbnailUrl: string | null;
  empresaSlug: string | null;
  empresaNome: string | null;
  totalAulas: number;
  aulasConcluidas: number;
  /** "AAAA-MM-DD" — data da última aula concluída. */
  ultimaAula: string;
  quiz: { nota: number; aprovado: boolean } | null;
}

interface Resposta {
  concluidos: CursoDoAluno[];
  emAndamento: CursoDoAluno[];
}

// A data vem como texto puro, sem passar por fuso no navegador.
const dataBR = (iso: string) => {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
};

const nomeDoArquivo = (titulo: string) =>
  `certificado-${titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()}.pdf`;

// Seção "Cursos do Painel" do Perfil: certificados dos cursos concluídos e,
// logo abaixo, os cursos começados que ainda faltam terminar.
const CertificadosCursos: React.FC = () => {
  const { hasPermission } = useAuth();
  const [dados, setDados] = useState<Resposta | null>(null);
  const [erro, setErro] = useState(false);
  // Curso cujo PDF está sendo gerado (o servidor leva alguns segundos).
  const [gerando, setGerando] = useState<number | null>(null);

  useEffect(() => {
    api
      .get("/api/certificates/mine")
      .then((res) => setDados(res.data as Resposta))
      .catch(() => setErro(true));
  }, []);

  const buscarPdf = async (curso: CursoDoAluno) => {
    const res = await api.get(`/api/admin/courses/${curso.courseId}/certificate`, {
      responseType: "blob",
    });
    return URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
  };

  const ver = async (curso: CursoDoAluno) => {
    // Abre a aba já no clique — pedida depois do await, o navegador
    // trataria como pop-up e bloquearia.
    const aba = window.open("", "_blank");
    setGerando(curso.courseId);
    try {
      const url = await buscarPdf(curso);
      if (aba) aba.location.href = url;
      else window.location.href = url;
      // A aba nova já carregou o PDF quando isso rodar.
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      aba?.close();
      toast.error("Não foi possível gerar o certificado. Tente novamente.");
    } finally {
      setGerando(null);
    }
  };

  const baixar = async (curso: CursoDoAluno) => {
    setGerando(curso.courseId);
    try {
      const url = await buscarPdf(curso);
      const link = document.createElement("a");
      link.href = url;
      link.download = nomeDoArquivo(curso.titulo);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Não foi possível gerar o certificado. Tente novamente.");
    } finally {
      setGerando(null);
    }
  };

  const capa = (curso: CursoDoAluno) => (
    <img
      src={curso.thumbnailUrl || CapaPadraoCurso}
      alt=""
      loading="lazy"
    />
  );

  const empresa = (curso: CursoDoAluno) => curso.empresaNome || "V-CORP";

  const nada = dados && !dados.concluidos.length && !dados.emAndamento.length;

  return (
    <div className="profile-section">
      <h3>Cursos do Painel</h3>

      {erro ? (
        <p className="ext-cert-vazio">Não foi possível carregar seus certificados.</p>
      ) : !dados ? (
        <LoadingSpinner variant="inline" label="Carregando certificados" />
      ) : nada ? (
        <div className="ext-cert-vazio">
          <FiAward className="ext-cert-vazio-icon" aria-hidden="true" />
          <p>
            Ao concluir todas as aulas de um curso do Painel, o certificado
            aparece aqui, pronto para baixar.
          </p>
          {hasPermission("courses.view") && (
            <Link to="/content/courses" className="form-button btn-icon-text">
              <FiPlay aria-hidden="true" />
              Ver cursos
            </Link>
          )}
        </div>
      ) : (
        <>
          {dados.concluidos.length > 0 ? (
            <ul className="ext-cert-grid">
              {dados.concluidos.map((c) => {
                const ocupado = gerando === c.courseId;
                return (
                  <li key={c.courseId} className="ext-cert-card">
                    <button
                      type="button"
                      className="ext-cert-thumb course-cert-thumb"
                      onClick={() => ver(c)}
                      disabled={ocupado}
                      aria-label={`Ver o certificado de ${c.titulo}`}
                    >
                      {capa(c)}
                      <span className="course-cert-selo">
                        <FiCheck aria-hidden="true" />
                        Concluído
                      </span>
                      {ocupado && (
                        <span className="course-cert-gerando">Gerando certificado…</span>
                      )}
                    </button>
                    <div className="ext-cert-info">
                      <h4 title={c.titulo}>{c.titulo}</h4>
                      <p>{empresa(c)}</p>
                      <p className="ext-cert-data">
                        Concluído em {dataBR(c.ultimaAula)}
                        {c.quiz && ` · quiz: nota ${c.quiz.nota}`}
                      </p>
                    </div>
                    <div className="ext-cert-actions">
                      <button
                        type="button"
                        className="form-icon-edit"
                        onClick={() => ver(c)}
                        disabled={ocupado}
                        aria-label={`Abrir o certificado de ${c.titulo}`}
                        title="Abrir"
                      >
                        <FiExternalLink />
                      </button>
                      <button
                        type="button"
                        className="form-icon-edit"
                        onClick={() => baixar(c)}
                        disabled={ocupado}
                        aria-label={`Baixar o certificado de ${c.titulo}`}
                        title="Baixar PDF"
                      >
                        <FiDownload />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="ext-cert-vazio-texto">
              Nenhum curso concluído ainda. Termine as aulas de um curso abaixo
              para liberar o certificado.
            </p>
          )}

          {dados.emAndamento.length > 0 && (
            <>
              <h4 className="course-cert-subtitulo">
                Em andamento
                <span>conclua todas as aulas para liberar o certificado</span>
              </h4>
              <ul className="ext-cert-grid">
                {dados.emAndamento.map((c) => {
                  const pct = Math.round((c.aulasConcluidas / c.totalAulas) * 100);
                  const faltam = c.totalAulas - c.aulasConcluidas;
                  return (
                    <li key={c.courseId} className="ext-cert-card">
                      <Link
                        to={`/content/courses/${c.courseId}`}
                        className="ext-cert-thumb course-cert-thumb course-cert-thumb--andamento"
                        aria-label={`Continuar ${c.titulo}`}
                      >
                        {capa(c)}
                      </Link>
                      <div className="ext-cert-info">
                        <h4 title={c.titulo}>{c.titulo}</h4>
                        <p>{empresa(c)}</p>
                        <div
                          className="course-cert-progresso"
                          role="progressbar"
                          aria-valuenow={pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`Progresso em ${c.titulo}`}
                          style={{ "--pct": `${pct}%` } as React.CSSProperties}
                        />
                        <p className="ext-cert-data">
                          {c.aulasConcluidas} de {c.totalAulas} aulas · {pct}% ·{" "}
                          {faltam === 1 ? "falta 1 aula" : `faltam ${faltam} aulas`}
                        </p>
                      </div>
                      <div className="ext-cert-actions">
                        <Link
                          to={`/content/courses/${c.courseId}`}
                          className="form-icon-edit btn-icon-text"
                        >
                          <FiPlay aria-hidden="true" />
                          Continuar
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default CertificadosCursos;
