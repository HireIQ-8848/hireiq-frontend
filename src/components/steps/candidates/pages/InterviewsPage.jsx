import { useCallback, useEffect, useState } from "react";
import { Calendar, Clock, Copy, LoaderCircle, Users, Video } from "lucide-react";
import { interviewApi } from "../../../../lib/api.js";


function when(value, timezone) {
  if (!value) return "Not scheduled";
  const parsed = new Date(value.endsWith?.("Z") ? value : `${value}Z`);
  return Number.isNaN(parsed.valueOf())
    ? value
    : `${parsed.toLocaleString()} · ${timezone || "Asia/Kathmandu"}`;
}


export default function InterviewsPage({ user, onJoinInterview }) {
  const companyView = user?.role === "company";
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(() => new URLSearchParams(window.location.search).get("interview_id") || "");
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    candidate_id: "",
    application_id: "",
    job_id: "",
    scheduled_at: "",
    duration_minutes: 60,
    timezone: "Asia/Kathmandu",
    note: "",
  });

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      await interviewApi.syncMe();
      const rows = await interviewApi.list();
      setItems(rows);
      setSelectedId((current) => current || rows[0]?.id || "");
    } catch (requestError) {
      setError(requestError.message || "Could not load interviews");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }
    void interviewApi.get(selectedId).then(setSelected).catch((requestError) => setError(requestError.message));
  }, [selectedId]);

  const act = async (action, extra = {}) => {
    if (!selectedId) return;
    setError("");
    setMessage("");
    try {
      await interviewApi.respond(selectedId, { action, ...extra });
      setMessage(action === "accept" ? "Interview accepted and added to your calendar." : "Your response was sent to the company.");
      await load();
      setSelected(await interviewApi.get(selectedId));
    } catch (requestError) {
      setError(requestError.message || "Could not update this invitation");
    }
  };

  const decideReschedule = async (action) => {
    if (!selectedId) return;
    setError("");
    setMessage("");
    try {
      const updated = await interviewApi.decideReschedule(selectedId, action, decisionNote || null);
      setMessage(action === "accept" ? "The requested time was accepted." : "The request was rejected. The original interview time remains confirmed.");
      setDecisionNote("");
      await load();
      setSelected(await interviewApi.get(updated.id));
    } catch (requestError) {
      setError(requestError.message || "Could not decide the reschedule request");
    }
  };

  const create = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const created = await interviewApi.create({
        ...form,
        interviewer_id: user.id,
        company_id: user.id,
        application_id: form.application_id || null,
        job_id: form.job_id || null,
        scheduled_at: form.scheduled_at,
        duration_minutes: Number(form.duration_minutes),
      });
      setMessage("Invitation created. The applicant can now accept, reject, or request rescheduling.");
      setShowCreate(false);
      await load();
      setSelectedId(created.interview_id);
    } catch (requestError) {
      setError(requestError.message || "Could not create the invitation");
    }
  };

  const cancel = async () => {
    try {
      await interviewApi.cancel(selectedId);
      setMessage("Interview cancelled.");
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 className="admin-page-title">Interviews</h1>
          <p className="admin-page-sub">{companyView ? "Create and manage shortlisted applicant interviews" : "Accept, reject, reschedule, or join your interviews"}</p>
        </div>
        {companyView && <button className="btn btn-primary" onClick={() => setShowCreate((value) => !value)}>Schedule Interview</button>}
      </div>

      {error && <div className="verification-alert" role="alert">{error}</div>}
      {message && <div className="verification-alert" style={{ borderColor: "var(--success)", color: "var(--success)" }}>{message}</div>}

      {showCreate && (
        <form className="chart-card" onSubmit={create} style={{ marginBottom: 18 }}>
          <div className="chart-card-title">New interview invitation</div>
          <div className="info-grid">
            <label className="item"><span className="k">Applicant profile ID</span><input required value={form.candidate_id} onChange={(event) => setForm({ ...form, candidate_id: event.target.value })} /></label>
            <label className="item"><span className="k">Application ID</span><input value={form.application_id} onChange={(event) => setForm({ ...form, application_id: event.target.value })} /></label>
            <label className="item"><span className="k">Job ID / Position</span><input value={form.job_id} onChange={(event) => setForm({ ...form, job_id: event.target.value })} /></label>
            <label className="item"><span className="k">Proposed date and time</span><input type="datetime-local" required value={form.scheduled_at} onChange={(event) => setForm({ ...form, scheduled_at: event.target.value })} /></label>
            <label className="item"><span className="k">Duration (minutes)</span><input type="number" min="15" max="480" value={form.duration_minutes} onChange={(event) => setForm({ ...form, duration_minutes: event.target.value })} /></label>
            <label className="item"><span className="k">Timezone</span><input required value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} /></label>
          </div>
          <label className="item"><span className="k">Note</span><textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></label>
          <button className="btn btn-primary" type="submit">Send Invitation</button>
        </form>
      )}

      {busy ? <LoaderCircle className="spin" /> : (
        <div className="admin-grid-3">
          <div className="chart-card">
            <div className="chart-card-title">All Interviews</div>
            <div className="interview-list">
              {items.length === 0 && <p className="admin-page-sub">No interviews yet.</p>}
              {items.map((item) => (
                <button key={item.id} className={`interview-list-row ${item.id === selectedId ? "active" : ""}`} onClick={() => setSelectedId(item.id)}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{item.job_id || "HireIQ Interview"}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{item.scheduling_status.replaceAll("_", " ")}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted-soft)" }}>{when(item.scheduled_at, item.timezone)}</div>
                </button>
              ))}
            </div>
          </div>

          {selected && (
            <div className="chart-card" style={{ gridColumn: "span 2" }}>
              <div className="tile-icon" style={{ width: 44, height: 44, borderRadius: 12, marginBottom: 10 }}><Video size={18} /></div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{selected.job_id || "HireIQ Interview"}</div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 18, textTransform: "capitalize" }}>{selected.scheduling_status.replaceAll("_", " ")}</div>
              <div className="info-grid" style={{ marginBottom: 18 }}>
                <div className="item"><div className="k"><Calendar size={11} /> {selected.scheduling_status === "reschedule_requested" ? "Original date & time" : "Date & Time"}</div><div className="v">{when(selected.scheduled_at, selected.timezone)}</div></div>
                <div className="item"><div className="k"><Clock size={11} /> Duration</div><div className="v">{selected.duration_minutes} minutes</div></div>
                <div className="item"><div className="k"><Users size={11} /> Applicant ID</div><div className="v">{selected.applicant_record_id || selected.application_id || "—"}</div></div>
              </div>
              {selected.scheduling_status === "reschedule_requested" && (
                <div className="reschedule-review-card">
                  <div><strong>Requested new time</strong><span>{when(selected.pending_reschedule_at, selected.pending_reschedule_timezone)}</span></div>
                  {selected.pending_reschedule_note && <p>{selected.pending_reschedule_note}</p>}
                  {companyView ? <>
                    <label className="item"><span className="k">Response note (optional)</span><textarea value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} /></label>
                    <div className="reschedule-review-actions"><button className="btn btn-primary" onClick={() => decideReschedule("accept")}>Accept new time</button><button className="btn btn-outline" onClick={() => decideReschedule("reject")}>Reject · keep original time</button></div>
                  </> : <p>The company must accept the requested change. Until then, the original interview time remains active.</p>}
                </div>
              )}
              {selected.join_url && (
                <div className="meeting-link-row"><Video size={14} /><span>{selected.join_url}</span><button className="icon-btn" onClick={() => navigator.clipboard.writeText(selected.join_url)}><Copy size={13} /></button></div>
              )}
              {!companyView && selected.scheduling_status === "proposed" && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
                  <button className="btn btn-primary" onClick={() => act("accept")}>Accept</button>
                  <input type="datetime-local" value={rescheduleAt} onChange={(event) => setRescheduleAt(event.target.value)} />
                  <button className="btn btn-outline" disabled={!rescheduleAt} onClick={() => act("reschedule", { scheduled_at: rescheduleAt, timezone: selected.timezone })}>Request Reschedule</button>
                  <button className="btn btn-outline" style={{ color: "var(--danger)" }} onClick={() => act("reject")}>Reject</button>
                </div>
              )}
              {!companyView && selected.scheduling_status === "accepted" && (
                <div className="accepted-reschedule-row">
                  <input type="datetime-local" value={rescheduleAt} onChange={(event) => setRescheduleAt(event.target.value)} />
                  <button className="btn btn-outline" disabled={!rescheduleAt} onClick={() => act("reschedule", { scheduled_at: rescheduleAt, timezone: selected.timezone })}>Request another time</button>
                </div>
              )}
              {selected.scheduling_status === "accepted" && selected.join_url && (
                <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => onJoinInterview(selected)}>Join Interview</button>
              )}
              {companyView && !["completed", "cancelled"].includes(selected.status) && (
                <button className="btn btn-outline" style={{ color: "var(--danger)", marginTop: 16 }} onClick={cancel}>Cancel Interview</button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
