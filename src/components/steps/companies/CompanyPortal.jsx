import { useState } from "react";
import CompanyLayout from "./shared/CompanyLayout.jsx";
import CompanyDashboardPage from "./pages/CompanyDashboardPage.jsx";
import CompanyJobsPage from "./pages/CompanyJobsPage.jsx";
import CompanyApplicantsPage from "./pages/CompanyApplicantsPage.jsx";
import CompanyProfilePage from "./pages/CompanyProfilePage.jsx";
import InterviewsPage from "../candidates/pages/InterviewsPage.jsx";
import CalendarPage from "../candidates/pages/CalendarPage.jsx";
import InterviewRoomPage from "../candidates/pages/InterviewRoomPage.jsx";

const BADGES = {
  dashboard: "COMPANY OVERVIEW",
  jobs: "VACANCY POSTS",
  applicants: "APPLICANTS AND RANKING",
  interviews: "INTERVIEWS",
  calendar: "CALENDAR",
  profile: "COMPANY PROFILE",
};

export default function CompanyPortal({ user, onLogout }) {
  const invitationRequested = new URLSearchParams(window.location.search).has("interview_id");
  const [activePage, setActivePage] = useState(invitationRequested ? "interviews" : "dashboard");
  const [activeInterview, setActiveInterview] = useState(null);

  if (activeInterview) return <InterviewRoomPage interview={activeInterview} user={user} onLeave={() => setActiveInterview(null)} />;

  let page;
  if (activePage === "jobs") page = <CompanyJobsPage />;
  else if (activePage === "applicants") page = <CompanyApplicantsPage />;
  else if (activePage === "interviews") page = <InterviewsPage user={user} onJoinInterview={setActiveInterview} />;
  else if (activePage === "calendar") page = <CalendarPage />;
  else if (activePage === "profile") page = <CompanyProfilePage user={user} />;
  else page = <CompanyDashboardPage onNavigate={setActivePage} />;

  return <CompanyLayout user={user} activePage={activePage} onNavigate={setActivePage} onLogout={onLogout} pageBadge={BADGES[activePage]}>{page}</CompanyLayout>;
}
