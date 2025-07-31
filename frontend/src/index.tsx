import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import App from './App';
import Dashboard from './Dashboard';
import AdminUsers from './AdminUsers';
import Perfil from './Perfil';
import { AuthProvider } from './context/AuthContext';
import './styles.css';

const AppRouter: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/perfil" element={<Perfil />} />
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