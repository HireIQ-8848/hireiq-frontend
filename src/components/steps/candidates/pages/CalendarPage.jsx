import { useCallback, useEffect, useState } from "react";
import { CalendarDays, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { interviewApi } from "../../../../lib/api.js";


const EMPTY = { title: "", description: "", start_at: "", end_at: "", timezone: "Asia/Kathmandu", meeting_url: "" };


function displayDate(value) {
  if (!value) return "—";
  const parsed = new Date(value.endsWith?.("Z") ? value : `${value}Z`);
  return Number.isNaN(parsed.valueOf()) ? value : parsed.toLocaleString();
}


export default function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      await interviewApi.syncMe();
      setEvents(await interviewApi.calendar());
      setError("");
    } catch (requestError) {
      setError(requestError.message || "Could not load calendar");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async (event) => {
    event.preventDefault();
    try {
      const payload = { ...form, meeting_url: form.meeting_url || null };
      if (editing) await interviewApi.updateCalendarEvent(editing, payload);
      else await interviewApi.createCalendarEvent(payload);
      setForm(EMPTY);
      setEditing("");
      setShowForm(false);
      await load();
    } catch (requestError) {
      setError(requestError.message || "Could not save calendar event");
    }
  };

  const edit = (item) => {
    setEditing(item.id);
    setForm({
      title: item.title,
      description: item.description || "",
      start_at: item.start_at?.slice(0, 16) || "",
      end_at: item.end_at?.slice(0, 16) || "",
      timezone: item.timezone,
      meeting_url: item.meeting_url || "",
    });
    setShowForm(true);
  };

  const remove = async (id) => {
    try {
      await interviewApi.deleteCalendarEvent(id);
      await load();
    } catch (requestError) {
      setError(requestError.message || "Could not delete calendar event");
    }
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div><h1 className="admin-page-title">Calendar</h1><p className="admin-page-sub">Interview links and your personal events in one place</p></div>
        <button className="btn btn-primary" onClick={() => { setEditing(""); setForm(EMPTY); setShowForm((value) => !value); }}><Plus size={15} /> Add Event</button>
      </div>
      {error && <div className="verification-alert" role="alert">{error}</div>}
      {showForm && (
        <form className="chart-card" style={{ marginBottom: 18 }} onSubmit={save}>
          <div className="chart-card-title">{editing ? "Edit event" : "Add event"}</div>
          <div className="info-grid">
            <label className="item"><span className="k">Title</span><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
            <label className="item"><span className="k">Timezone</span><input required value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} /></label>
            <label className="item"><span className="k">Starts</span><input required type="datetime-local" value={form.start_at} onChange={(event) => setForm({ ...form, start_at: event.target.value })} /></label>
            <label className="item"><span className="k">Ends</span><input required type="datetime-local" value={form.end_at} onChange={(event) => setForm({ ...form, end_at: event.target.value })} /></label>
            <label className="item"><span className="k">Meeting link (optional)</span><input value={form.meeting_url} onChange={(event) => setForm({ ...form, meeting_url: event.target.value })} /></label>
          </div>
          <label className="item"><span className="k">Description</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          <button className="btn btn-primary" type="submit">{editing ? "Save Changes" : "Add Event"}</button>
        </form>
      )}
      <div className="chart-card">
        <div className="calendar-event-list">
          {events.length === 0 && <p className="admin-page-sub">No events in your calendar.</p>}
          {events.map((item) => (
            <div className="calendar-event-row" key={item.id}>
              <div className="calendar-event-icon"><CalendarDays size={14} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 650 }}>{item.title}</div>
                <div className="notification-time">{displayDate(item.start_at)} – {displayDate(item.end_at)} · {item.timezone}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{item.description}</div>
                <span className="admin-page-badge" style={{ marginTop: 6 }}>{item.status}</span>
              </div>
              {item.meeting_url && <a className="icon-btn" href={item.meeting_url} target="_blank" rel="noreferrer" title="Open meeting"><ExternalLink size={14} /></a>}
              {item.event_type === "custom" && <button className="icon-btn" onClick={() => edit(item)} title="Edit"><Pencil size={14} /></button>}
              {item.event_type === "custom" && <button className="icon-btn" onClick={() => remove(item.id)} title="Delete"><Trash2 size={14} /></button>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
