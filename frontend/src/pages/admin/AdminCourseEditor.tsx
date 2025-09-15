import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from ".../api.ts";
import { useAuth } from "./context/AuthContext.tsx";
import Menu from ".../components/layout/Menu.tsx";
import Footer from ".../components/layout/Footer.tsx";
import toast from "react-hot-toast";
import ConfirmationModal from ".../components/ui/ConfirmationModal.tsx";
import LessonEditModal from ".../components/forms/LessonEditModal.tsx";
import { SortableModuleItem } from ".../components/ui/SortableModuleItem.tsx";
import { Course, Module, Lesson, Quiz, Question, Option } from "./types.ts";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

const AdminCourseEditor: React.FC = () => {
  const { user, loading } = useAuth();
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [modules, setModules] = useState<Module[]>([]);

  useEffect(() => {
    if (course) {
      setModules(course.modules);
    }
  }, [course]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleModuleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      let reorderedModules;
      setModules((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        reorderedModules = arrayMove(items, oldIndex, newIndex);
        return reorderedModules;
      });

      if (reorderedModules) {
        const orderedModuleIds = reorderedModules.map((m) => m.id);
        api
          .put(
            `/api/admin/courses/${courseId}/modules/order`,
            { orderedModuleIds },
            getAuthHeaders()
          )
          .then(() => toast.success("Ordem dos módulos salva!"))
          .catch(() => toast.error("Erro ao salvar a ordem dos módulos."));
      }
    }
  };

  const handleLessonOrderChange = async (
    moduleId: number,
    orderedLessonIds: number[]
  ) => {
    try {
      await api.put(
        `/api/admin/courses/modules/${moduleId}/lessons/order`,
        { orderedLessonIds },
        getAuthHeaders()
      );
      toast.success("Ordem das aulas salva!");
    } catch (err) {
      toast.error("Erro ao salvar a ordem das aulas.");
      fetchCourseDetails();
    }
  };

  const [itemToDelete, setItemToDelete] = useState<{
    type: "module" | "lesson";
    id: number;
  } | null>(null);
  const [lessonToEdit, setLessonToEdit] = useState<Partial<Lesson> | null>(
    null
  );
  const [activeModuleId, setActiveModuleId] = useState<number | null>(null);

  const getAuthHeaders = useCallback(() => {
    if (!user) return {};
    return { headers: { "x-user-id": user.id } };
  }, [user]);

  const fetchCourseDetails = useCallback(async () => {
    if (!user || !courseId) return;
    try {
      const res = await api.get(
        `/api/admin/courses/${courseId}`,
        getAuthHeaders()
      );
      setCourse(res.data);
    } catch (err) {
      toast.error("Falha ao carregar detalhes do curso.");
      navigate("/admin/courses");
    }
  }, [user, courseId, getAuthHeaders, navigate]);

  useEffect(() => {
    if (user) {
      fetchCourseDetails();
    }
  }, [user, fetchCourseDetails]);

  const handleAddModule = async () => {
    if (!newModuleTitle.trim() || !course) return;
    try {
      const newOrder = (course.modules.length || 0) + 1;
      await api.post(
        `/api/admin/courses/${course.id}/modules`,
        { title: newModuleTitle, module_order: newOrder },
        getAuthHeaders()
      );
      toast.success("Módulo adicionado!");
      setNewModuleTitle("");
      fetchCourseDetails();
    } catch (err) {
      toast.error("Erro ao adicionar módulo.");
    }
  };

  const handleSaveLesson = async (
    lessonData: Omit<Lesson, "id" | "lesson_order" | "module_id">
  ) => {
    if (!course) return;
    try {
      if (lessonToEdit && "id" in lessonToEdit && lessonToEdit.id) {
        await api.put(
          `/api/admin/courses/lessons/${lessonToEdit.id}`,
          lessonData,
          getAuthHeaders()
        );
        toast.success("Aula atualizada com sucesso!");
      } else {
        const module = modules.find((m) => m.id === activeModuleId);
        if (!module) {
          toast.error("Módulo não encontrado para adicionar a aula.");
          return;
        }
        const newOrder = (module.lessons.length || 0) + 1;
        const newLessonData = { ...lessonData, lesson_order: newOrder };
        await api.post(
          `/api/admin/courses/modules/${module.id}/lessons`,
          newLessonData,
          getAuthHeaders()
        );
        toast.success("Aula adicionada com sucesso!");
      }
      setLessonToEdit(null);
      setActiveModuleId(null);
      fetchCourseDetails();
    } catch (err) {
      toast.error("Erro ao salvar a aula.");
    }
  };

  const handleDeleteClick = (type: "module" | "lesson", id: number) =>
    setItemToDelete({ type, id });

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    const { type, id } = itemToDelete;
    const url =
      type === "module"
        ? `/api/admin/courses/modules/${id}`
        : `/api/admin/courses/lessons/${id}`;
    try {
      await api.delete(url, getAuthHeaders());
      toast.success(
        `${type === "module" ? "Módulo" : "Aula"} excluído com sucesso!`
      );
      fetchCourseDetails();
    } catch (err) {
      toast.error(`Erro ao excluir ${type}.`);
    } finally {
      setItemToDelete(null);
    }
  };

  const openAddLessonModal = (moduleId: number) => {
    setActiveModuleId(moduleId);
    setLessonToEdit({});
  };

  const [newQuestionText, setNewQuestionText] = useState("");
  const [newOptionText, setNewOptionText] = useState<{ [key: number]: string }>(
    {}
  );

  const handleCreateQuiz = async () => {
    if (!courseId) return;
    const quizData = {
      title: `Teste Final - ${course?.title}`,
      passing_score: 70,
    };
    try {
      toast.loading("A criar o quiz...");
      await api.post(
        `/api/quizzes/course/${courseId}`,
        quizData,
        getAuthHeaders()
      );
      toast.dismiss();
      toast.success("Quiz criado com sucesso! Agora adicione as perguntas.");
      fetchCourseDetails();
    } catch (err) {
      toast.dismiss();
      toast.error("Não foi possível criar o quiz.");
      console.error("Erro ao criar quiz:", err);
    }
  };

  const handleAddQuestion = async () => {
    if (!course?.quiz || !newQuestionText.trim()) {
      toast.error("Por favor, digite o texto da pergunta.");
      return;
    }
    try {
      await api.post(
        `/api/quizzes/${course.quiz.id}/questions`,
        { question_text: newQuestionText },
        getAuthHeaders()
      );
      toast.success("Pergunta adicionada!");
      setNewQuestionText("");
      fetchCourseDetails();
    } catch (err) {
      toast.error("Erro ao adicionar pergunta.");
    }
  };

  const handleDeleteQuestion = async (questionId: number) => {
    try {
      await api.delete(
        `/api/quizzes/questions/${questionId}`,
        getAuthHeaders()
      );
      toast.success("Pergunta excluída com sucesso!");
      fetchCourseDetails();
    } catch (err) {
      toast.error("Erro ao excluir pergunta.");
    }
  };

  const handleAddOption = async (questionId: number) => {
    const optionText = newOptionText[questionId];
    if (!optionText || !optionText.trim()) {
      toast.error("Por favor, digite o texto da opção.");
      return;
    }
    try {
      await api.post(
        `/api/quizzes/questions/${questionId}/options`,
        { option_text: optionText },
        getAuthHeaders()
      );
      toast.success("Opção adicionada!");
      setNewOptionText({ ...newOptionText, [questionId]: "" });
      fetchCourseDetails();
    } catch (err) {
      toast.error("Erro ao adicionar opção.");
    }
  };

  const handleSetCorrectOption = async (optionId: number) => {
    try {
      await api.put(
        `/api/quizzes/options/${optionId}/correct`,
        {},
        getAuthHeaders()
      );
      toast.success("Opção marcada como correta!");
      fetchCourseDetails();
    } catch (err) {
      toast.error("Erro ao definir a resposta correta.");
    }
  };

  const handleDeleteOption = async (optionId: number) => {
    try {
      await api.delete(`/api/quizzes/options/${optionId}`, getAuthHeaders());
      toast.success("Opção excluída!");
      fetchCourseDetails();
    } catch (err) {
      toast.error("Erro ao excluir opção.");
    }
  };

  if (loading || !course) {
    return <div className="tela-loading">Carregando...</div>;
  }

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <button
          onClick={() => navigate("/admin/courses")}
          className="form-button-cancel mb-4"
        >
          ← Voltar
        </button>

        <h2>Editor do Curso: {course.title}</h2>

        <div className="admin-form mt-4">
          <h3>Adicionar Novo Módulo</h3>
          <div className="form-row">
            <input
              className="form-input"
              type="text"
              placeholder="Título do novo módulo"
              value={newModuleTitle}
              onChange={(e) => setNewModuleTitle(e.target.value)}
            />
            <button
              className="form-button"
              type="button"
              onClick={handleAddModule}
            >
              Adicionar Módulo
            </button>
          </div>
        </div>

        <div className="modules-list">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleModuleDragEnd}
          >
            <SortableContext
              items={modules.map((m) => m.id)}
              strategy={verticalListSortingStrategy}
            >
              {modules.map((module) => (
                <SortableModuleItem
                  key={module.id}
                  module={module}
                  setModules={setModules}
                  onDeleteModule={(id) => handleDeleteClick("module", id)}
                  onAddLesson={openAddLessonModal}
                  onEditLesson={setLessonToEdit}
                  onDeleteLesson={(id) => handleDeleteClick("lesson", id)}
                  onLessonOrderChange={handleLessonOrderChange}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        <hr className="section-divider" />

        <div className="quiz-editor-section">
          <h2>Quiz do Curso</h2>
          {!course.quiz ? (
            <div className="admin-form">
              <p>Este curso ainda não tem um quiz.</p>
              <div className="form-row">
                <button className="form-button" onClick={handleCreateQuiz}>
                  Criar Quiz
                </button>
              </div>
            </div>
          ) : (
            <div>
              {course.quiz.questions.map((question) => (
                <div key={question.id} className="question-editor-item">
                  <div className="question-header">
                    <strong>{question.question_text}</strong>
                    <button
                      className="delete-button"
                      onClick={() => handleDeleteQuestion(question.id)}
                    >
                      Excluir Pergunta
                    </button>
                  </div>
                  <ul className="option-list">
                    {question.options.map((option) => (
                      <li
                        key={option.id}
                        className={`option-list-item ${
                          option.is_correct ? "correct-option" : ""
                        }`}
                      >
                        <span>{option.option_text}</span>
                        <div className="option-actions">
                          <button
                            className="list-button"
                            onClick={() => handleSetCorrectOption(option.id)}
                            disabled={option.is_correct}
                          >
                            {option.is_correct
                              ? "✓ Correta"
                              : "Marcar como Correta"}
                          </button>
                          <button
                            className="delete-button"
                            onClick={() => handleDeleteOption(option.id)}
                          >
                            Excluir
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="add-item-form">
                    <input
                      className="form-input"
                      placeholder="Nova opção de resposta"
                      value={newOptionText[question.id] || ""}
                      onChange={(e) =>
                        setNewOptionText({
                          ...newOptionText,
                          [question.id]: e.target.value,
                        })
                      }
                    />
                    <button
                      className="form-button"
                      onClick={() => handleAddOption(question.id)}
                    >
                      Adicionar Opção
                    </button>
                  </div>
                </div>
              ))}

              <div className="admin-form add-item-form">
                <input
                  className="form-input"
                  placeholder="Texto da nova pergunta"
                  value={newQuestionText}
                  onChange={(e) => setNewQuestionText(e.target.value)}
                />
                <button className="form-button" onClick={handleAddQuestion}>
                  Adicionar Pergunta
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />

      {lessonToEdit && (
        <LessonEditModal
          lesson={lessonToEdit}
          onClose={() => {
            setLessonToEdit(null);
            setActiveModuleId(null);
          }}
          onSave={handleSaveLesson}
        />
      )}
      <ConfirmationModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message={`Tem certeza que deseja excluir este item? ${
          itemToDelete?.type === "module"
            ? "Todas as aulas dentro dele serão perdidas."
            : ""
        }`}
      />
    </div>
  );
};

export default AdminCourseEditor;
