import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";

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
          {/* Rotas de Admin */}
          <Route path="/admin/logs" element={<ActivityLogs />} />
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="/courses/:courseId" element={<LessonPlayer />} />
          <Route path="/admin/courses" element={<AdminCourses />} />
          <Route
            path="/admin/courses/:courseId"
            element={<AdminCourseEditor />}
          />
          <Route path="/admin/users" element={<AdminUsers />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);
root.render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>
);
