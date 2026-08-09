import { useState } from "react";
import CandidateLayout from "./shared/CandidateLayout.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import JobsPage from "./pages/JobsPage.jsx";
import ApplicationsPage from "./pages/ApplicationsPage.jsx";
import InterviewsPage from "./pages/InterviewsPage.jsx";
import InterviewRoomPage from "./pages/InterviewRoomPage.jsx";
import CalendarPage from "./pages/CalendarPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";

const PAGE_BADGES = {
  dashboard: "DASHBOARD",
  jobs: "JOB MARKETPLACE",
  applications: "MY APPLICATIONS",
  interviews: "INTERVIEWS",
  calendar: "CALENDAR",
  profile: "PROFILE",
};

export default function CandidatePortal({ user, onLogout }) {
  const invitationRequested = new URLSearchParams(window.location.search).has("interview_id");
  const [activePage, setActivePage] = useState(invitationRequested ? "interviews" : "dashboard");
  const [activeInterview, setActiveInterview] = useState(null);

  // The authenticated video room is rendered without the portal sidebar.
  if (activeInterview) {
    return (
      <InterviewRoomPage
        interview={activeInterview}
        user={user}
        onLeave={() => setActiveInterview(null)}
      />
    );
  }

  const renderPage = () => {
    switch (activePage) {
      case "dashboard":
        return <DashboardPage user={user} onNavigate={setActivePage} />;
      case "jobs":
        return <JobsPage />;
      case "applications":
        return <ApplicationsPage onNavigate={setActivePage} />;
      case "interviews":
        return <InterviewsPage user={user} onJoinInterview={setActiveInterview} />;
      case "calendar":
        return <CalendarPage />;
      case "profile":
        return <ProfilePage user={user} />;
      default:
        return <DashboardPage user={user} onNavigate={setActivePage} />;
    }
  };

  return (
    <CandidateLayout
      user={user}
      activePage={activePage}
      onNavigate={setActivePage}
      onLogout={onLogout}
      pageBadge={PAGE_BADGES[activePage]}
    >
      {renderPage()}
    </CandidateLayout>
  );
}
