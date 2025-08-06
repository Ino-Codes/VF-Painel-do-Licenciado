import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { SpeedInsights } from "@vercel/speed-insights/react";

import App from './App.tsx';
import Dashboard from './Dashboard.tsx';
import AdminUsers from './AdminUsers.tsx';
import Perfil from './Perfil.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import Documentos from './Documentos.tsx';
import Videos from './Videos.tsx';
import ActivityLogs from './ActivityLogs.tsx';
import Faq from './Faq.tsx';
import ResetPassword from './ResetPassword.tsx'; 
import './styles.css';

<meta name="viewport" content="width=device-width, initial-scale=1.0" />

const AppRouter: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Toaster
          position="top-right"
          toastOptions={{
            success: {
              style: {
                background: '#04a146',
                color: 'white',
              },
            },
            error: {
              style: {
                background: '#c82333',
                color: 'white',
              },
            },
          }}
        />
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/reset-password" element={<ResetPassword />} /> {/* ADICIONE ESTA ROTA */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/documentos" element={<Documentos />} />
          <Route path="/videos" element={<Videos />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/admin/logs" element={<ActivityLogs />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>
);