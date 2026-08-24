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
import GroupsManagement from "./pages/admin/GroupsManagement.tsx";
import ProtectedRoute from "./components/auth/ProtectedRoute.tsx";

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
          {/* Rotas públicas */}
          <Route path="/" element={<App />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/acompanhar" element={<Acompanhar />} />

          {/* Baseline (basta estar logado) */}
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/perfil"
            element={
              <ProtectedRoute>
                <Perfil />
              </ProtectedRoute>
            }
          />

          {/* Conteúdo */}
          <Route
            path="/content/documentos"
            element={
              <ProtectedRoute permission="files.view">
                <Documentos />
              </ProtectedRoute>
            }
          />
          <Route
            path="/content/arquivos"
            element={
              <ProtectedRoute permission="archives.view">
                <Arquivos />
              </ProtectedRoute>
            }
          />
          <Route
            path="/content/midiassociais"
            element={
              <ProtectedRoute permission="social.view">
                <MidiasSociais />
              </ProtectedRoute>
            }
          />
          <Route
            path="/content/videos"
            element={
              <ProtectedRoute permission="videos.view">
                <Videos />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faq"
            element={
              <ProtectedRoute permission="faq.view">
                <Faq />
              </ProtectedRoute>
            }
          />
          <Route
            path="/content/courses"
            element={
              <ProtectedRoute permission="courses.view">
                <CoursesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/content/courses/:courseId"
            element={
              <ProtectedRoute permission="courses.view">
                <LessonPlayer />
              </ProtectedRoute>
            }
          />
          <Route
            path="/content/courses/:courseId/quiz"
            element={
              <ProtectedRoute permission="courses.view">
                <QuizPlayer />
              </ProtectedRoute>
            }
          />
          <Route
            path="/enneagram"
            element={
              <ProtectedRoute permission="enneagram.view">
                <EnneagramPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/perfil/enneagram-results"
            element={
              <ProtectedRoute permission="enneagram.view">
                <EnneagramResultsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/content/content-gestao"
            element={
              <ProtectedRoute permission="content_hub.view">
                <ContentGestao />
              </ProtectedRoute>
            }
          />
          <Route
            path="/content/avisos"
            element={
              <ProtectedRoute permission="notices.view">
                <MuralDeAvisos />
              </ProtectedRoute>
            }
          />

          {/* Área Interna */}
          <Route
            path="/internal/internal-gestao"
            element={
              <ProtectedRoute permission="internal_access">
                <InternalGestao />
              </ProtectedRoute>
            }
          />
          <Route
            path="/internal/meus-chamados"
            element={
              <ProtectedRoute permission="internal_access">
                <MeusChamados />
              </ProtectedRoute>
            }
          />
          <Route
            path="/internal/empresa"
            element={
              <ProtectedRoute permission="internal_access">
                <Empresa />
              </ProtectedRoute>
            }
          />
          <Route
            path="/internal/meeting-records"
            element={
              <ProtectedRoute permission="meeting_records.view">
                <MeetingRecords />
              </ProtectedRoute>
            }
          />

          {/* Admin */}
          <Route
            path="/admin/logs"
            element={
              <ProtectedRoute permission="logs.view">
                <ActivityLogs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/courses"
            element={
              <ProtectedRoute permission="courses.manage">
                <AdminCourses />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/courses/:courseId"
            element={
              <ProtectedRoute permission="courses.manage">
                <AdminCourseEditor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/calendar"
            element={
              <ProtectedRoute permission="events.manage">
                <AdminCalendar />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute permission="users.view">
                <AdminUsers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/groups"
            element={
              <ProtectedRoute permission="groups.view">
                <GroupsManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/dashboards"
            element={
              <ProtectedRoute permission="analytics.view">
                <Dashboards />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/recrutamento/entrevistas"
            element={
              <ProtectedRoute permission="recruitment.view">
                <InterviewsCalendar />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/recrutamento"
            element={
              <ProtectedRoute permission="recruitment.view">
                <Recruitment />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/checklist-templates"
            element={
              <ProtectedRoute permission="recruitment.view">
                <ChecklistTemplatesAdmin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/rh-gestao"
            element={
              <ProtectedRoute
                anyOf={[
                  "users.view",
                  "recruitment.view",
                  "feedbacks.view",
                  "analytics.view",
                  "meeting_records.view",
                  "courses.manage",
                  "events.manage",
                ]}
              >
                <RhGestao />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/feedbacks"
            element={
              <ProtectedRoute permission="feedbacks.view">
                <Feedbacks />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/admin-gestao"
            element={
              <ProtectedRoute
                anyOf={[
                  "groups.view",
                  "logs.view",
                  "widget_tenants.view",
                  "analytics.view",
                  "projects.view",
                  "units.view",
                ]}
              >
                <AdminGestao />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/statistics"
            element={
              <ProtectedRoute permission="analytics.view">
                <AdminStatistics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/helpdesk"
            element={
              <ProtectedRoute permission="tickets.view">
                <HelpDeskKanban />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/widget-tenants"
            element={
              <ProtectedRoute permission="widget_tenants.view">
                <WidgetTenants />
              </ProtectedRoute>
            }
          />

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
