// src/pages/AreaInterna/Projetos.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../../context/AuthContext.tsx";
import { useNavigate } from "react-router-dom";
import api from "../../api.ts";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import LoadingSpinner from "../../components/ui/LoadingSpinner.tsx";
import EmptyState from "../../components/ui/EmptyState.tsx";
import ConfirmationModal from "../../components/ui/ConfirmationModal.tsx";
import ProjectModal from "../../components/forms/ProjectModal.tsx";
import TaskModal from "../../components/forms/TaskModal.tsx";
import toast from "react-hot-toast";
import { FiEdit, FiEdit2, FiTrash2 } from "react-icons/fi";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Project {
  id: number;
  name: string;
  team: string;
  description: string;
  company_name?: string;
  creator_name?: string;
  created_at: string;
}

interface ProjectTask {
  id: number;
  project_id: number;
  name: string;
  start_year: number;
  start_month: number;
  end_year: number;
  end_month: number;
  color: string;
  order_index: number;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const MONTHS_PT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

// ─── Helpers do Cronograma ────────────────────────────────────────────────────

/**
 * Monta a lista de colunas { year, month } que o grid precisa exibir.
 * Garante mínimo de 12 meses a partir do mês atual.
 * Se as tasks extrapolarem esse intervalo, expande automaticamente.
 */
const buildTimelineColumns = (tasks: ProjectTask[]) => {
  // Sem tarefas: exibe o ano atual completo como fallback
  if (tasks.length === 0) {
    const year = new Date().getFullYear();
    return Array.from({ length: 12 }, (_, i) => ({ year, month: i }));
  }

  // Com tarefas: pega todos os anos envolvidos e exibe janeiro–dezembro de cada um
  const years = new Set<number>();
  tasks.forEach((t) => {
    for (let y = t.start_year; y <= t.end_year; y++) {
      years.add(y);
    }
  });

  const sortedYears = Array.from(years).sort((a, b) => a - b);

  const columns: { year: number; month: number }[] = [];
  sortedYears.forEach((year) => {
    for (let month = 0; month < 12; month++) {
      columns.push({ year, month });
    }
  });

  return columns;
};

/**
 * Dado uma task com start_year/start_month/end_year/end_month,
 * retorna gridColumnStart e gridColumnEnd para o CSS grid.
 * A coluna 1 do grid é sempre o label lateral (180px fixo),
 * então as colunas de meses começam na posição 2.
 */
const getBarPosition = (
  task: ProjectTask,
  columns: { year: number; month: number }[],
) => {
  const startIdx = columns.findIndex(
    (c) => c.year === task.start_year && c.month === task.start_month - 1,
  );
  const endIdx = columns.findIndex(
    (c) => c.year === task.end_year && c.month === task.end_month - 1,
  );

  // Fallback: se não encontrar, usa primeiro/último
  const s = startIdx === -1 ? 0 : startIdx;
  const e = endIdx === -1 ? columns.length - 1 : endIdx;

  // +2 porque col 1 = label; colunas de meses começam em 2
  return { start: s + 2, end: e + 3 };
};

/**
 * Agrupa colunas por ano para renderizar o header de anos no Gantt.
 */
const groupByYear = (columns: { year: number; month: number }[]) => {
  const groups: { year: number; count: number }[] = [];
  columns.forEach((col) => {
    const last = groups[groups.length - 1];
    if (last && last.year === col.year) {
      last.count++;
    } else {
      groups.push({ year: col.year, count: 1 });
    }
  });
  return groups;
};

// ─── Componente ───────────────────────────────────────────────────────────────

const Projetos: React.FC = () => {
  const { user, hasPermission } = useAuth() as {
    user: any;
    hasPermission: (key: string) => boolean;
  };
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"projects" | "schedule">(
    "projects",
  );

  // ── Estado: Projetos ──
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  // ── Estado: Cronograma ──
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    null,
  );
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<ProjectTask | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<ProjectTask | null>(null);

  // ─── Fetch: Projetos ─────────────────────────────────────────────────────

  const fetchProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    try {
      const res = await api.get("/api/projects");
      setProjects(res.data);
    } catch {
      toast.error("Erro ao carregar projetos.");
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // ─── Fetch: Tasks ────────────────────────────────────────────────────────

  const fetchTasks = useCallback(async (projectId: number) => {
    setIsLoadingTasks(true);
    try {
      const res = await api.get(`/api/projects/${projectId}/tasks`);
      setTasks(res.data);
    } catch {
      toast.error("Erro ao carregar tarefas.");
    } finally {
      setIsLoadingTasks(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProjectId !== null) {
      fetchTasks(selectedProjectId);
    } else {
      setTasks([]);
    }
  }, [selectedProjectId, fetchTasks]);

  // ─── Handlers: Projetos ──────────────────────────────────────────────────

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    try {
      await api.delete(`/api/projects/${projectToDelete.id}`);
      toast.success("Projeto excluído com sucesso.");
      setProjectToDelete(null);
      fetchProjects();
      if (selectedProjectId === projectToDelete.id) setSelectedProjectId(null);
    } catch {
      toast.error("Erro ao excluir projeto.");
    }
  };

  // ─── Handlers: Tasks ─────────────────────────────────────────────────────

  const handleDeleteTask = async () => {
    if (!taskToDelete || !selectedProjectId) return;
    try {
      await api.delete(
        `/api/projects/${selectedProjectId}/tasks/${taskToDelete.id}`,
      );
      toast.success("Tarefa excluída com sucesso.");
      setTaskToDelete(null);
      fetchTasks(selectedProjectId);
    } catch {
      toast.error("Erro ao excluir tarefa.");
    }
  };

  // ─── Cronograma: cálculo das colunas ────────────────────────────────────

  const columns = useMemo(() => buildTimelineColumns(tasks), [tasks]);
  const yearGroups = useMemo(() => groupByYear(columns), [columns]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        {/* ── Cabeçalho ── */}
        <div className="projetos-header">
          <h1>Projetos</h1>
        </div>

        {/* ── Tabs ── */}
        <div className="tabs">
          <button
            className={`tab-item ${activeTab === "projects" ? "active" : ""}`}
            onClick={() => setActiveTab("projects")}
          >
            Projetos
          </button>
          <button
            className={`tab-item ${activeTab === "schedule" ? "active" : ""}`}
            onClick={() => setActiveTab("schedule")}
          >
            Cronograma
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB: Projetos                                                      */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "projects" && (
          <div className="projetos-tab-content">
            {hasPermission("projects.manage") && (
              <div className="projetos-toolbar">
                <button
                  className="form-button form-button--add"
                  onClick={() => {
                    setProjectToEdit(null);
                    setIsProjectModalOpen(true);
                  }}
                >
                  + Novo Projeto
                </button>
              </div>
            )}

            {isLoadingProjects ? (
              <LoadingSpinner />
            ) : projects.length === 0 ? (
              <EmptyState
                imageKey="projetos"
                title="Nenhum Projeto Encontrado"
                message="Nenhum projeto foi criado ainda."
              />
            ) : (
              <div className="projetos-table-wrapper">
                <table className="projetos-table">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Time Responsável</th>
                      <th>Descrição</th>
                      {hasPermission("projects.manage") && <th>Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((project) => (
                      <tr key={project.id}>
                        <td className="projeto-nome">{project.name}</td>
                        <td>{project.team || "—"}</td>
                        <td className="projeto-descricao">
                          {project.description || "—"}
                        </td>
                        {hasPermission("projects.manage") && (
                          <td className="projeto-acoes">
                            <div className="projeto-acoes-inner">
                              <button
                                className="form-icon-edit"
                                onClick={() => {
                                  setProjectToEdit(project);
                                  setIsProjectModalOpen(true);
                                }}
                              >
                                <FiEdit />
                              </button>

                              <button
                                className="form-icon-delete"
                                onClick={() => setProjectToDelete(project)}
                              >
                                <FiTrash2 />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TAB: Cronograma                                                    */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "schedule" && (
          <div className="projetos-tab-content">
            {/* Toolbar: seletor de projeto + botão nova tarefa */}
            <div className="cronograma-toolbar">
              <select
                className="form-input cronograma-select"
                value={selectedProjectId ?? ""}
                onChange={(e) =>
                  setSelectedProjectId(
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
              >
                <option value="">Selecione um projeto</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              {hasPermission("projects.manage") && selectedProjectId && (
                <button
                  className="form-button form-button--add"
                  onClick={() => {
                    setTaskToEdit(null);
                    setIsTaskModalOpen(true);
                  }}
                >
                  + Nova Tarefa
                </button>
              )}
            </div>

            {/* Sem projeto selecionado */}
            {!selectedProjectId && (
              <div className="cronograma-empty">
                <p>Selecione um projeto para visualizar o cronograma.</p>
              </div>
            )}

            {/* Loading */}
            {selectedProjectId && isLoadingTasks && <LoadingSpinner />}

            {/* Gantt */}
            {selectedProjectId && !isLoadingTasks && (
              <>
                {tasks.length === 0 ? (
                  <div className="cronograma-empty">
                    <p>Nenhuma tarefa cadastrada para este projeto.</p>
                    {hasPermission("projects.manage") && (
                      <button
                        className="form-button form-button--add"
                        onClick={() => {
                          setTaskToEdit(null);
                          setIsTaskModalOpen(true);
                        }}
                      >
                        + Adicionar primeira tarefa
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="gantt-wrapper">
                    <div
                      className="gantt-grid"
                      style={{ "--gantt-cols": columns.length } as React.CSSProperties}
                    >
                      {/* ── Header: Anos ── */}
                      <div className="gantt-cell gantt-header-corner" />
                      {yearGroups.map((g) =>
                        Array.from({ length: g.count }).map((_, i) => (
                          <div
                            key={`year-${g.year}-${i}`}
                            className={`gantt-cell gantt-year ${i === 0 ? "gantt-year-start" : ""}`}
                          >
                            {i === 0 ? g.year : ""}
                          </div>
                        )),
                      )}

                      {/* ── Header: Meses ── */}
                      <div className="gantt-cell gantt-header-label">
                        <p className="gantt-title">Atividades</p>
                      </div>
                      {columns.map((col, i) => (
                        <div
                          key={`month-${i}`}
                          className="gantt-cell gantt-month"
                        >
                          {MONTHS_PT[col.month]}
                        </div>
                      ))}

                      {/* ── Linhas de Tarefas ── */}
                      {tasks.map((task) => {
                        const { start, end } = getBarPosition(task, columns);

                        return (
                          <React.Fragment key={task.id}>
                            {/* Label lateral */}
                            <div className="gantt-cell gantt-task-label">
                              <span
                                className="gantt-task-label-dot"
                                style={{ "--dot-color": task.color } as React.CSSProperties}
                              />
                              <span className="gantt-task-label-text">
                                {task.name}
                              </span>
                              {hasPermission("projects.manage") && (
                                <span className="gantt-task-actions">
                                  <button
                                    className="gantt-icon-btn"
                                    onClick={() => {
                                      setTaskToEdit(task);
                                      setIsTaskModalOpen(true);
                                    }}
                                    title="Editar"
                                  >
                                    <FiEdit2 />
                                  </button>
                                  <button
                                    className="gantt-icon-btn delete"
                                    onClick={() => setTaskToDelete(task)}
                                    title="Excluir"
                                  >
                                    <FiTrash2 />
                                  </button>
                                </span>
                              )}
                            </div>

                            {/* Células de fundo da linha */}
                            {columns.map((_, i) => (
                              <div
                                key={`bg-${task.id}-${i}`}
                                className="gantt-cell gantt-row-bg"
                              />
                            ))}

                            {/* Barra da tarefa — subgrid sobre as células de fundo */}
                            <div className="gantt-bar-row">
                              <div
                                className="gantt-bar"
                                style={
                                  {
                                    "--bar-col-start": start - 1,
                                    "--bar-col-end": end - 1,
                                    "--bar-color": task.color,
                                  } as React.CSSProperties
                                }
                                title={`${task.name}: ${MONTHS_PT[task.start_month - 1]}/${task.start_year} → ${MONTHS_PT[task.end_month - 1]}/${task.end_year}`}
                              />
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <Footer />

      {/* ── Modal: Projeto ── */}
      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onSuccess={() => {
          setIsProjectModalOpen(false);
          fetchProjects();
        }}
        projectToEdit={projectToEdit}
      />

      {/* ── Modal: Tarefa ── */}
      {selectedProjectId && (
        <TaskModal
          isOpen={isTaskModalOpen}
          onClose={() => setIsTaskModalOpen(false)}
          onSuccess={() => {
            setIsTaskModalOpen(false);
            fetchTasks(selectedProjectId);
          }}
          projectId={selectedProjectId}
          taskToEdit={taskToEdit}
        />
      )}

      {/* ── Confirmação: excluir projeto ── */}
      <ConfirmationModal
        isOpen={!!projectToDelete}
        onClose={() => setProjectToDelete(null)}
        onConfirm={handleDeleteProject}
        title="Excluir Projeto"
        message={`Tem certeza que deseja excluir o projeto "${projectToDelete?.name}"? Todas as tarefas do cronograma serão removidas.`}
      />

      {/* ── Confirmação: excluir tarefa ── */}
      <ConfirmationModal
        isOpen={!!taskToDelete}
        onClose={() => setTaskToDelete(null)}
        onConfirm={handleDeleteTask}
        title="Excluir Tarefa"
        message={`Tem certeza que deseja excluir a tarefa "${taskToDelete?.name}"?`}
      />
    </div>
  );
};

export default Projetos;
