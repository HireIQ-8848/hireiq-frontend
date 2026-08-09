import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Eye, LoaderCircle } from "lucide-react";
import { interviewApi } from "../../../../lib/api.js";


const TABS = ["Upcoming", "Completed", "Cancelled"];


export default function InterviewsPage() {
  const [tab, setTab] = useState(0);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState(null);
  const [calendar, setCalendar] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void interviewApi.list()
      .then(setItems)
      .catch((requestError) => setError(requestError.message))
      .finally(() => setBusy(false));
  }, []);

  const filtered = useMemo(() => items.filter((item) => {
    if (tab === 1) return item.status === "completed";
    if (tab === 2) return item.status === "cancelled" || item.scheduling_status === "cancelled";
    return !["completed", "cancelled"].includes(item.status);
  }), [items, tab]);

  const inspect = async (item) => {
    setSelected(item);
    setError("");
    try {
      const [dashboard, events, report] = await Promise.all([
        interviewApi.dashboard(item.id),
        interviewApi.proctoringEvents(item.id),
        interviewApi.report(item.id).catch(() => null),
      ]);
      setDetails({ dashboard, events, report });
    } catch (requestError) {
      setError(requestError.message || "Could not load interview monitoring details");
    }
  };

  const loadCalendar = async () => {
    try {
      setCalendar(await interviewApi.calendar());
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div><h1 className="admin-page-title">Interview Monitoring</h1><p className="admin-page-sub">Read-only system activity, failures, proctoring, and report status</p></div>
        <button className="btn btn-outline" style={{ width: "auto", padding: "10px 18px" }} onClick={loadCalendar}><CalendarDays size={15} /> View Calendar</button>
      </div>
      {error && <div className="verification-alert" role="alert">{error}</div>}
      <div className="admin-tabs">
        {TABS.map((label, index) => <button key={label} className={tab === index ? "active" : ""} onClick={() => setTab(index)}>{label}</button>)}
      </div>
      {busy ? <LoaderCircle className="spin" /> : (
        <div className="admin-table-card">
          <table className="admin-full-table">
            <thead><tr><th>Applicant profile</th><th>Applicant ID</th><th>Job</th><th>Company / Interviewer</th><th>Date & Time</th><th>Status</th><th /></tr></thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{item.candidate_id}</td><td>{item.applicant_record_id || item.application_id || "—"}</td><td>{item.job_id || "—"}</td><td>{item.company_id || item.interviewer_id}</td>
                  <td>{item.scheduled_at ? new Date(`${item.scheduled_at}Z`).toLocaleString() : "—"}</td>
                  <td><span className={`pill ${item.status === "completed" ? "success" : ""}`}>{item.status} / {item.scheduling_status}</span></td>
                  <td><button className="icon-btn" onClick={() => inspect(item)} title="Monitor"><Eye size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {calendar && (
        <div className="chart-card" style={{ marginTop: 18 }}><div className="chart-card-title">All participant calendar entries</div>{calendar.map((event) => <div className="calendar-event-row" key={event.id}><CalendarDays size={14} /><div><strong>{event.title}</strong><div className="notification-time">Owner {event.owner_id} · {event.start_at} · {event.status}</div></div></div>)}</div>
      )}
      {selected && details && (
        <div className="chart-card" style={{ marginTop: 18 }}>
          <div className="chart-card-title">Interview {selected.id}</div>
          <div className="info-grid">
            <div className="item"><div className="k">Oral round</div><div className="v">{details.dashboard.oral_interview.status || "Not started"} · {details.dashboard.oral_interview.final_oral_score ?? "—"}</div></div>
            <div className="item"><div className="k">Coding round</div><div className="v">{details.dashboard.coding.coding_round_status || "Not started"} · {details.dashboard.coding.overall_accuracy ?? "—"}</div></div>
            <div className="item"><div className="k">Proctoring</div><div className="v">{details.dashboard.proctoring.events_count} events · risk {details.dashboard.proctoring.risk_score}</div></div>
            <div className="item"><div className="k">Report</div><div className="v">{details.report ? `${details.report.recommendation} · PDF ${details.report.pdf.storage_status}` : "Not generated"}</div></div>
          </div>
          <div className="chart-card-title" style={{ marginTop: 16 }}>Recent proctoring events</div>
          {details.events.length === 0 ? <p className="admin-page-sub">No events.</p> : details.events.slice(0, 20).map((event) => <div className="calendar-event-row" key={event.id}><span className="pill">{event.severity}</span><div>{event.event_type}<div className="notification-time">{event.created_at}</div></div></div>)}
        </div>
      )}
    </>
  );
}
