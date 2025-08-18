import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";

// Importação de todos os componentes de página
import App from "./App.tsx";
import Dashboard from "./Dashboard.tsx";
import AdminUsers from "./AdminUsers.tsx";
import Perfil from "./Perfil.tsx";
import { AuthProvider } from "./context/AuthContext.tsx";
import Documentos from "./Documentos.tsx";
import Videos from "./Videos.tsx";
import ActivityLogs from "./ActivityLogs.tsx";
import Faq from "./Faq.tsx";
import ResetPassword from "./ResetPassword.tsx";
import AdminCourses from "./AdminCourses.tsx";
import AdminCourseEditor from "./AdminCourseEditor.tsx";
import CoursesPage from "./CoursesPage.tsx";
import LessonPlayer from "./LessonPlayer.tsx";
import "./styles.css";

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
        {/* --- Estrutura de Rotas Corrigida e Completa --- */}
        <Routes>
          {/* Rotas Públicas e de Autenticação */}
          <Route path="/" element={<App />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Rotas de Usuário Logado */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/documentos" element={<Documentos />} />
          <Route path="/videos" element={<Videos />} />
          <Route path="/faq" element={<Faq />} />

          {/* Rotas do Módulo de Estudos (Aluno) */}
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="/courses/:courseId" element={<LessonPlayer />} />

          {/* Rotas de Administração */}
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/logs" element={<ActivityLogs />} />
          <Route path="/admin/courses" element={<AdminCourses />} />
          <Route
            path="/admin/courses/:courseId"
            element={<AdminCourseEditor />}
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);
root.render(<AppRouter />);
