import { useEffect, useState } from "react";
import { BriefcaseBusiness, CalendarClock, CheckCircle2, LoaderCircle, Send } from "lucide-react";
import { applicationsApi, interviewApi, jobsApi } from "../../../../lib/api.js";

function formatDate(value) {
  if (!value) return "—";
  const parsed = new Date(value.endsWith?.("Z") ? value : `${value}Z`);
  return Number.isNaN(parsed.valueOf()) ? value : parsed.toLocaleString();
}

export default function DashboardPage({ user, onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      applicationsApi.mine(),
      jobsApi.list(),
      interviewApi.syncMe().then(() => interviewApi.list()),
    ]).then(([applications, jobs, interviews]) => {
      if (!active) return;
      setData({
        applications: applications.status === "fulfilled" ? applications.value : [],
        jobs: jobs.status === "fulfilled" ? jobs.value : [],
        interviews: interviews.status === "fulfilled" ? interviews.value : [],
      });
      const failed = [applications, jobs].find((result) => result.status === "rejected");
      if (failed) setError(failed.reason?.message || "Some candidate data could not be loaded");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <div className="admin-loading"><LoaderCircle className="spin" /> Loading your HireIQ activity…</div>;
  const applications = data?.applications || [];
  const interviews = data?.interviews || [];
  const activeInterviews = interviews.filter((item) => !["completed", "cancelled"].includes(item.status));
  const progressed = applications.filter((item) => !["under_review", "rejected"].includes(item.status)).length;

  return (
    <>
      <h1 className="admin-page-title">Welcome, {user?.fullName || user?.email}</h1>
      <p className="admin-page-sub">This overview is calculated from your applications and interview records.</p>
      {error && <div className="verification-alert">{error}</div>}

      <div className="admin-stat-row admin-stat-row-compact">
        <article className="admin-stat-card"><div className="admin-stat-top"><div><div className="admin-stat-label">Applications submitted</div><div className="admin-stat-value">{applications.length}</div></div><div className="admin-stat-icon"><Send size={18} /></div></div></article>
        <article className="admin-stat-card"><div className="admin-stat-top"><div><div className="admin-stat-label">Progressed applications</div><div className="admin-stat-value">{progressed}</div></div><div className="admin-stat-icon success"><CheckCircle2 size={18} /></div></div></article>
        <article className="admin-stat-card"><div className="admin-stat-top"><div><div className="admin-stat-label">Active interviews</div><div className="admin-stat-value">{activeInterviews.length}</div></div><div className="admin-stat-icon"><CalendarClock size={18} /></div></div></article>
      </div>

      <div className="admin-grid-3">
        <section className="chart-card" style={{ gridColumn: "span 2" }}>
          <div className="admin-section-heading"><div className="chart-card-title">Recent applications</div><button className="verification-profile-link" onClick={() => onNavigate("applications")}>View all</button></div>
          <div className="admin-table-card admin-embedded-table"><table className="admin-full-table"><thead><tr><th>Position</th><th>Company</th><th>Status</th><th>Match score</th><th>Applied</th></tr></thead><tbody>{applications.slice(0, 6).map((item) => <tr key={item.id}><td><strong>{item.job_title || item.job_id}</strong></td><td>{item.company_name || item.company_id || "—"}</td><td><span className={`pill ${item.status === "rejected" ? "danger" : ["selected", "interview_scheduled"].includes(item.status) ? "success" : "warn"}`}>{item.status.replaceAll("_", " ")}</span></td><td>{item.match_score == null ? "Pending" : `${Number(item.match_score).toFixed(1)}%`}</td><td>{formatDate(item.created_at)}</td></tr>)}{!applications.length && <tr><td colSpan="5">You have not submitted any applications.</td></tr>}</tbody></table></div>
        </section>
        <section className="chart-card"><div className="chart-card-title">Live marketplace</div><div className="portal-big-number">{data?.jobs?.length || 0}</div><p className="admin-page-sub">Active vacancies currently available from approved companies.</p><button className="btn btn-primary admin-inline-button" onClick={() => onNavigate("jobs")}><BriefcaseBusiness size={15} /> Browse jobs</button></section>
      </div>

      <section className="chart-card">
        <div className="admin-section-heading"><div className="chart-card-title">Upcoming interviews</div><button className="verification-profile-link" onClick={() => onNavigate("interviews")}>Open interviews</button></div>
        {activeInterviews.slice(0, 5).map((item) => <div className="calendar-event-row" key={item.id}><CalendarClock size={15} /><div><strong>{item.job_id || "HireIQ interview"}</strong><div className="notification-time">{formatDate(item.scheduled_at)} · {item.timezone}</div></div><span className={`pill ${item.scheduling_status === "accepted" ? "success" : item.scheduling_status === "rejected" ? "danger" : "warn"}`}>{item.scheduling_status.replaceAll("_", " ")}</span></div>)}
        {!activeInterviews.length && <p className="admin-page-sub" style={{ marginBottom: 0 }}>No upcoming interviews.</p>}
      </section>
    </>
  );
}
