import { useState } from "react";
import AdminLayout from "./shared/AdminLayout.jsx";
import DashboardHome from "./pages/DashboardHome.jsx";
import InterviewsPage from "./pages/InterviewsPage.jsx";
import UsersPage from "./pages/UsersPage.jsx";
import CompaniesPage from "./pages/CompaniesPage.jsx";
import VerificationsPage from "./pages/VerificationsPage.jsx";
import SystemStatusPage from "./pages/SystemStatusPage.jsx";
import AuditLogPage from "./pages/AuditLogPage.jsx";

const PAGES = {
  dashboard: { Component: DashboardHome, badge: "ADMINISTRATION OVERVIEW" },
  registrations: { Component: UsersPage, badge: "USER REGISTRATIONS" },
  verifications: { Component: VerificationsPage, badge: "VERIFICATION EVIDENCE" },
  companies: { Component: CompaniesPage, badge: "COMPANY OVERSIGHT" },
  interviews: { Component: InterviewsPage, badge: "INTERVIEW MONITORING" },
  system: { Component: SystemStatusPage, badge: "BACKEND STATUS" },
  audit: { Component: AuditLogPage, badge: "AUDIT HISTORY" },
};

export default function AdminDashboard({ admin, onLogout }) {
  const [activePage, setActivePage] = useState("dashboard");
  const [verificationId, setVerificationId] = useState(null);

  const entry = PAGES[activePage];
  const Page = entry?.Component;

  const navigate = (page) => {
    setActivePage(page);
    if (page !== "verifications") setVerificationId(null);
  };

  const openVerification = (id) => {
    setVerificationId(id);
    setActivePage("verifications");
  };

  return (
    <AdminLayout admin={admin} activePage={activePage} onNavigate={navigate} onLogout={onLogout} pageBadge={entry?.badge}>
      {Page && (
        <Page
          admin={admin}
          onNavigate={navigate}
          onOpenVerification={openVerification}
          initialVerificationId={verificationId}
        />
      )}
    </AdminLayout>
  );
}
