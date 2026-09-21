import React, { useEffect, useState } from "react";
import api from "../../api.ts";
import { useAuth } from "../../context/AuthContext.tsx";
import Menu from "../../components/layout/Menu.tsx";
import Footer from "../../components/layout/Footer.tsx";
import toast from "react-hot-toast";
import EnneagramStats from "./EnneagramStats.tsx";
import CourseEngagementDash from "./CourseEngagementDash.tsx";
import LoadingSpinner from "../../components/ui/LoadingSpinner.tsx";

const Dashboard: React.FC = () => {
  const { user, loading, hasPermission } = useAuth();

  const [activeReportTab, setActiveReportTab] = useState(
    hasPermission("analytics.view") ? "eneagrama" : "cursos"
  );

  if (loading) {
    return <LoadingSpinner />;
  }
  if (!user) {
    return null;
  }

  return (
    <div className="p-2">
      <Menu />
      <div className="content-area">
        <div className="document-header">
          <h2>Dashboards de Colaboradores</h2>
        </div>

        <div className="dashboard-elements">
          <div className="analytics-tabs">
            {hasPermission("analytics.view") && (
              <button
                className={`analytics-tab ${
                  activeReportTab === "eneagrama" ? "active" : ""
                }`}
                onClick={() => setActiveReportTab("eneagrama")}
              >
                Eneagrama
              </button>
            )}

            <button
              className={`analytics-tab ${
                activeReportTab === "cursos" ? "active" : ""
              }`}
              onClick={() => setActiveReportTab("cursos")}
            >
              Cursos
            </button>
          </div>

          <div className="dashboard-elements-child">
            {activeReportTab === "eneagrama" && <EnneagramStats />}
            {activeReportTab === "cursos" && <CourseEngagementDash />}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Dashboard;
