import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import { ThemeProvider } from "./context/ThemeContext.tsx";
import App from "./pages/public/App.tsx";
import Home from "./pages/home/Home.tsx";
import Dashboards from "./pages/admin/Dashboards.tsx";
import AdminUsers from "./pages/admin/AdminUsers.tsx";
import Perfil from "./pages/profile/Perfil.tsx";
import { AuthProvider } from "./context/AuthContext.tsx";
import Documentos from "./pages/documents/Documentos.tsx";
import MidiasSociais from "./pages/social/SocialMedia.tsx";
import Videos from "./pages/videos/Videos.tsx";
import ActivityLogs from "./pages/admin/ActivityLogs.tsx";
import Faq from "./pages/faq/Faq.tsx";
import ResetPassword from "./pages/public/ResetPassword.tsx";
import AdminCourses from "./pages/admin/AdminCourses.tsx";
import AdminCourseEditor from "./pages/admin/AdminCourseEditor.tsx";
import CoursesPage from "./pages/courses/CoursesPage.tsx";
import LessonPlayer from "./pages/courses/LessonPlayer.tsx";
import QuizPlayer from "./pages/courses/QuizPlayer.tsx";
import NotFoundPage from "./pages/public/NotFoundPage.tsx";
import AdminCalendar from "./pages/admin/AdminCalendar.tsx";
import InterviewsCalendar from "./pages/admin/InterviewsCalendar.tsx";
import EnneagramPage from "./pages/profile/EnneagramPage.tsx";
import EnneagramResultsPage from "./pages/profile/EnneagramResultsPage.tsx";
import Empresa from "./pages/company/Empresa.tsx";
import GestaoFerias from "./pages/admin/GestaoFerias.tsx";
import SolicitarFerias from "./pages/internal/SolicitarFerias.tsx";
import Recruitment from "./pages/admin/Recruitment.tsx";
import ChecklistTemplatesAdmin from "./pages/admin/ChecklistTemplatesAdmin.tsx";
import RhGestao from "./pages/admin/RhGestao.tsx";
import Feedbacks from "./pages/feedbacks/Feedbacks.tsx";
import AdminGestao from "./pages/admin/AdminGestao.tsx";
import AdminStatistics from "./pages/admin/AdminStatistics.tsx";
import InternalGestao from "./pages/internal/InternalGestao.tsx";
import ContentGestao from "./pages/content/ContentGestao.tsx";
import MuralDeAvisos from "./pages/notices/MuralDeAvisos.tsx";
import HelpDeskKanban from "./pages/itsm/HelpDeskKanban.tsx";
import WidgetTenants from "./pages/itsm/WidgetTenants.tsx";
import MeetingRecords from "./pages/meetings/MeetingRecords.tsx";
import Arquivos from "./pages/archives/Arquivos.tsx";
import SupportWidget from "./components/layout/SupportWidget.tsx";
import Acompanhar from "./pages/public/Acompanhar.tsx";
import MeusChamados from "./pages/internal/MeusChamados.tsx";

import "react-big-calendar/lib/css/react-big-calendar.css";
import "./styles/1-global.css";
import "./styles/2-components.css";
import "./styles/3-Login.css";
import "./styles/4-Menu.css";
import "./styles/5-Home.css";
import "./styles/6-ContentPages.css";
import "./styles/7-AdminPages.css";
import "./styles/8-Profile.css";
import "./styles/9-Assesments.css";
import "./styles/10-Company.css";
import "./styles/11-Dashboards.css";
import "./styles/12-Internal.css";
import "./styles/13-Recruitment.css";
import "./styles/14-Feedbacks.css";
import "./styles/15-Gestao.css";
import "./styles/16-Projects.css";
import "./styles/17-Kanban.css";
import "./styles/18-MeetingRecords.css";
import "./styles/19-Tracking.css";
import "./styles/20-Brand.css";

<meta name="viewport" content="width=device-width, initial-scale=1.0" />;

const AppRouter: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Toaster
          position="top-right"
          toastOptions={{
            success: {
              style: {
                background: "#04a146",
                color: "white",
              },
            },
            error: {
              style: {
                background: "#c82333",
                color: "white",
              },
            },
          }}
        />
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/reset-password" element={<ResetPassword />} />{" "}
          <Route path="/acompanhar" element={<Acompanhar />} />{" "}
          <Route path="/home" element={<Home />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/content/documentos" element={<Documentos />} />
          <Route path="/content/arquivos" element={<Arquivos />} />
          <Route path="/content/midiassociais" element={<MidiasSociais />} />
          <Route path="/content/videos" element={<Videos />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/content/courses" element={<CoursesPage />} />
          <Route path="/content/courses/:courseId" element={<LessonPlayer />} />
          <Route
            path="/content/courses/:courseId/quiz"
            element={<QuizPlayer />}
          />
          <Route path="/enneagram" element={<EnneagramPage />} />
          <Route
            path="/perfil/enneagram-results"
            element={<EnneagramResultsPage />}
          />
          <Route path="/content/content-gestao" element={<ContentGestao />} />
          <Route path="/content/avisos" element={<MuralDeAvisos />} />
          {/* Rotas da Área Interna */}
          <Route
            path="/internal/internal-gestao"
            element={<InternalGestao />}
          />
          <Route path="/internal/ferias" element={<SolicitarFerias />} />
          <Route path="/internal/meus-chamados" element={<MeusChamados />} />
          <Route path="/internal/empresa" element={<Empresa />} />
          <Route
            path="/internal/meeting-records"
            element={<MeetingRecords />}
          />
          {/* Rotas de Admin */}
          <Route path="/admin/logs" element={<ActivityLogs />} />
          <Route path="/admin/courses" element={<AdminCourses />} />
          <Route
            path="/admin/courses/:courseId"
            element={<AdminCourseEditor />}
          />
          <Route path="/admin/calendar" element={<AdminCalendar />} />
          <Route path="/admin/ferias" element={<GestaoFerias />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/dashboards" element={<Dashboards />} />
          <Route
            path="/admin/recrutamento/entrevistas"
            element={<InterviewsCalendar />}
          />
          <Route path="/admin/recrutamento" element={<Recruitment />} />
          <Route
            path="/admin/checklist-templates"
            element={<ChecklistTemplatesAdmin />}
          />
          <Route path="/admin/rh-gestao" element={<RhGestao />} />
          <Route path="/admin/feedbacks" element={<Feedbacks />} />
          <Route path="/admin/admin-gestao" element={<AdminGestao />} />
          <Route path="/admin/statistics" element={<AdminStatistics />} />
          <Route path="/admin/helpdesk" element={<HelpDeskKanban />} />
          <Route path="/admin/widget-tenants" element={<WidgetTenants />} />
          {/* Rota 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <SupportWidget />
      </Router>
    </AuthProvider>
  );
};

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);

root.render(
  <React.Fragment>
    <ThemeProvider>
      <AppRouter />
    </ThemeProvider>
  </React.Fragment>,
);
