import { useEffect, useMemo, useState } from "react";
import { CalendarClock, LoaderCircle, RefreshCw } from "lucide-react";
import { applicationsApi, interviewApi } from "../../../../lib/api.js";

const FILTERS = ["all", "under_review", "shortlisted", "interview_requested", "interview_scheduled", "selected", "rejected"];

function label(value) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function ApplicationsPage({ onNavigate }) {
  const [items, setItems] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [applicationRows, interviewResult] = await Promise.all([
        applicationsApi.mine(),
        interviewApi.syncMe().then(() => interviewApi.list()).catch(() => []),
      ]);
      setItems(applicationRows);
      setInterviews(interviewResult);
    }
    catch (reason) { setError(reason.message || "Could not load applications"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => filter === "all" ? items : items.filter((item) => item.status === filter), [filter, items]);
  const interviewFor = (applicationId) => interviews.find((item) => item.application_id === applicationId && item.scheduling_status !== "cancelled");
  const count = (value) => value === "all" ? items.length : items.filter((item) => item.status === value).length;

  const openInterview = (interviewId) => {
    const url = new URL(window.location.href);
    url.searchParams.set("interview_id", interviewId);
    window.history.replaceState({}, "", url);
    onNavigate?.("interviews");
  };

  return (
    <>
      <div className="verification-page-heading"><div><h1 className="admin-page-title">My Applications</h1><p className="admin-page-sub">Status changes appear here as soon as the company records them.</p></div><button className="btn btn-secondary verification-refresh" onClick={load}><RefreshCw size={15} /> Refresh</button></div>
      {error && <div className="verification-alert">{error}</div>}
      <div className="admin-tabs portal-tabs">{FILTERS.map((value) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label(value)} ({count(value)})</button>)}</div>
      <div className="admin-table-card"><table className="admin-full-table"><thead><tr><th>Position</th><th>Company</th><th>Application status</th><th>CV match score</th><th>Interview</th><th>Submitted</th><th>Last updated</th></tr></thead><tbody>
        {loading && <tr><td colSpan="7"><LoaderCircle className="spin" size={17} /> Loading applications…</td></tr>}
        {!loading && filtered.map((item) => {
          const interview = interviewFor(item.id);
          return <tr key={item.applicant_record_id || item.id}><td><strong>{item.job_title || item.job_id}</strong><div className="verification-candidate-email">Applicant ID: {item.applicant_record_id || item.id}</div></td><td>{item.company_name || item.company_id || "—"}</td><td><span className={`pill ${item.status === "rejected" ? "danger" : ["selected", "interview_scheduled"].includes(item.status) ? "success" : "warn"}`}>{label(item.status)}</span></td><td>{item.match_score == null ? "Pending" : `${Number(item.match_score).toFixed(1)}%`}</td><td>{interview ? <div className="application-interview-cell"><span className={`pill ${interview.scheduling_status === "accepted" ? "success" : interview.scheduling_status === "rejected" ? "danger" : "warn"}`}>{label(interview.scheduling_status)}</span><small>{formatDate(interview.scheduled_at)}</small><button type="button" className="btn btn-outline admin-inline-button" onClick={() => openInterview(interview.id)}><CalendarClock size={14} /> View invitation</button></div> : "—"}</td><td>{formatDate(item.created_at)}</td><td>{formatDate(item.updated_at)}</td></tr>;
        })}
        {!loading && !filtered.length && <tr><td colSpan="7">No applications match this status.</td></tr>}
      </tbody></table></div>
    </>
  );
}
