import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import { ThemeProvider } from "./context/ThemeContext.tsx";
import App from "./pages/public/App.tsx";
import Dashboard from "./pages/dashboard/Dashboard.tsx";
import AdminUsers from "./pages/admin/AdminUsers.tsx";
import Perfil from "./pages/profile/Perfil.tsx";
import { AuthProvider } from "./context/AuthContext.tsx";
import Documentos from "./pages/documents/Documentos.tsx";
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
import EnneagramPage from "./pages/profile/EnneagramPage.tsx";
import EnneagramResultsPage from "./pages/profile/EnneagramResultsPage.tsx";

import "./styles/1-global.css";
import "./styles/2-components.css";
import "./styles/3-Login.css";
import "./styles/4-Menu.css";
import "./styles/5-Dashboard.css";
import "./styles/6-ContentPages.css";
import "./styles/7-AdminPages.css";
import "./styles/8-Profile.css";
import "./styles/9-Assesments.css";

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
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/documentos" element={<Documentos />} />
          <Route path="/videos" element={<Videos />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="/courses/:courseId" element={<LessonPlayer />} />
          <Route path="/courses/:courseId/quiz" element={<QuizPlayer />} />
          <Route path="/enneagram" element={<EnneagramPage />} />
          <Route
            path="/perfil/enneagram-results"
            element={<EnneagramResultsPage />}
          />
          {/* Rotas de Admin */}
          <Route path="/admin/logs" element={<ActivityLogs />} />
          <Route path="/admin/courses" element={<AdminCourses />} />
          <Route
            path="/admin/courses/:courseId"
            element={<AdminCourseEditor />}
          />
          <Route path="/admin/calendar" element={<AdminCalendar />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          {/* Rota 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <React.Fragment>
    <ThemeProvider>
      <AppRouter />
    </ThemeProvider>
  </React.Fragment>
);
