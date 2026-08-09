import { useEffect, useState } from "react";
import { CircleStop, EyeOff, LoaderCircle, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { companyApi } from "../../../../lib/api.js";

const EMPTY = { title: "", description: "", requirements: "", skills: "", education_requirement: "", experience_requirement: "0", salary_min: "", salary_max: "", location: "", remote_allowed: false, employment_type: "full_time", deadline: "", status: "active" };

function toForm(job) {
  return { ...EMPTY, ...job, requirements: (job.requirements || []).join(", "), skills: (job.skills || []).join(", "), salary_min: job.salary_min ?? "", salary_max: job.salary_max ?? "", deadline: job.deadline || "" };
}

function payload(form, includeStatus) {
  const result = {
    title: form.title.trim(), description: form.description.trim(),
    requirements: form.requirements.split(",").map((item) => item.trim()).filter(Boolean),
    skills: form.skills.split(",").map((item) => item.trim()).filter(Boolean),
    education_requirement: form.education_requirement.trim(),
    experience_requirement: Number(form.experience_requirement || 0),
    salary_min: form.salary_min === "" ? null : Number(form.salary_min),
    salary_max: form.salary_max === "" ? null : Number(form.salary_max),
    location: form.location.trim(), remote_allowed: form.remote_allowed,
    employment_type: form.employment_type, deadline: form.deadline || null,
  };
  if (includeStatus) result.status = form.status;
  return result;
}

export default function CompanyJobsPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => { setLoading(true); setError(""); try { setItems(await companyApi.jobs()); } catch (reason) { setError(reason.message || "Could not load vacancy posts"); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);

  const save = async (event) => {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      if (editing) await companyApi.updateJob(editing, payload(form, true));
      else await companyApi.createJob(payload(form, false));
      setMessage(editing ? "Vacancy updated." : "Vacancy published.");
      setForm(EMPTY); setEditing(""); setShowForm(false); await load();
    } catch (reason) { setError(reason.message || "Could not save vacancy"); }
    finally { setBusy(false); }
  };

  const edit = (job) => { setEditing(job.id); setForm(toForm(job)); setShowForm(true); };
  const remove = async (job) => {
    if (!window.confirm(`Delete the vacancy “${job.title}”?`)) return;
    setBusy(true); setError("");
    try { await companyApi.deleteJob(job.id); setMessage("Vacancy deleted."); await load(); }
    catch (reason) { setError(reason.message || "Could not delete vacancy"); }
    finally { setBusy(false); }
  };
  const closeVacancy = async (job) => {
    if (!window.confirm(`End the vacancy “${job.title}”? Existing applications and interview history will remain available.`)) return;
    setBusy(true); setError(""); setMessage("");
    try { await companyApi.closeJob(job.id); setMessage("Vacancy ended. New applications are now closed."); await load(); }
    catch (reason) { setError(reason.message || "Could not end vacancy"); }
    finally { setBusy(false); }
  };

  const update = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  return (
    <>
      <div className="verification-page-heading"><div><h1 className="admin-page-title">Vacancy Posts</h1><p className="admin-page-sub">Create and maintain real job announcements stored in HireIQ.</p></div><div className="portal-heading-actions"><button className="btn btn-secondary verification-refresh" onClick={load}><RefreshCw size={15} /> Refresh</button><button className="btn btn-primary verification-refresh" onClick={() => { setEditing(""); setForm(EMPTY); setShowForm((value) => !value); }}>{showForm ? <X size={15} /> : <Plus size={15} />} {showForm ? "Close" : "New vacancy"}</button></div></div>
      {error && <div className="verification-alert">{error}</div>}{message && <div className="portal-success">{message}</div>}
      {showForm && <form className="chart-card portal-form" onSubmit={save}><div className="chart-card-title">{editing ? "Edit vacancy" : "Publish vacancy"}</div><div className="info-grid">
        <label className="item"><span className="k">Job title</span><input required minLength="2" value={form.title} onChange={(e) => update("title", e.target.value)} /></label>
        <label className="item"><span className="k">Location</span><input value={form.location} onChange={(e) => update("location", e.target.value)} /></label>
        <label className="item"><span className="k">Employment type</span><select value={form.employment_type} onChange={(e) => update("employment_type", e.target.value)}><option value="full_time">Full time</option><option value="part_time">Part time</option><option value="contract">Contract</option><option value="internship">Internship</option></select></label>
        <label className="item"><span className="k">Deadline</span><input type="date" value={form.deadline} onChange={(e) => update("deadline", e.target.value)} /></label>
        <label className="item"><span className="k">Skills (comma separated)</span><input value={form.skills} onChange={(e) => update("skills", e.target.value)} /></label>
        <label className="item"><span className="k">Requirements (comma separated)</span><input value={form.requirements} onChange={(e) => update("requirements", e.target.value)} /></label>
        <label className="item"><span className="k">Education requirement</span><input value={form.education_requirement} onChange={(e) => update("education_requirement", e.target.value)} /></label>
        <label className="item"><span className="k">Experience years</span><input type="number" min="0" max="80" step="0.5" value={form.experience_requirement} onChange={(e) => update("experience_requirement", e.target.value)} /></label>
        <label className="item"><span className="k">Minimum salary</span><input type="number" min="0" value={form.salary_min} onChange={(e) => update("salary_min", e.target.value)} /></label>
        <label className="item"><span className="k">Maximum salary</span><input type="number" min="0" value={form.salary_max} onChange={(e) => update("salary_max", e.target.value)} /></label>
        {editing && <label className="item"><span className="k">Publication status</span><select value={form.status} onChange={(e) => update("status", e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option><option value="closed">Closed</option></select></label>}
        <label className="item portal-checkbox"><input type="checkbox" checked={form.remote_allowed} onChange={(e) => update("remote_allowed", e.target.checked)} /> Remote work allowed</label>
      </div><label className="item"><span className="k">Full vacancy announcement</span><textarea required minLength="10" rows="6" value={form.description} onChange={(e) => update("description", e.target.value)} /></label><button className="btn btn-primary admin-inline-button" disabled={busy}>{busy ? "Saving…" : editing ? "Save vacancy" : "Publish vacancy"}</button></form>}

      <div className="admin-table-card"><table className="admin-full-table"><thead><tr><th>Vacancy</th><th>Location</th><th>Deadline</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead><tbody>{loading && <tr><td colSpan="6"><LoaderCircle className="spin" size={17} /> Loading vacancies…</td></tr>}{!loading && items.map((job) => <tr key={job.id}><td><strong>{job.title}</strong><div className="verification-candidate-email">{job.description.slice(0, 110)}{job.description.length > 110 ? "…" : ""}</div></td><td>{job.location || "—"}</td><td>{job.deadline || "—"}</td><td><span className={`pill ${job.status === "active" ? "success" : job.status === "hidden" ? "danger" : "neutral"}`}>{job.status}</span>{job.status === "hidden" && <div className="verification-candidate-email"><EyeOff size={11} /> Hidden by administrator</div>}</td><td>{new Date(job.updated_at).toLocaleString()}</td><td className="admin-row-actions"><button className="icon-btn" disabled={job.status === "hidden" || busy} onClick={() => edit(job)} title="Edit"><Pencil size={14} /></button>{job.status === "active" && <button className="icon-btn" disabled={busy} onClick={() => closeVacancy(job)} title="End vacancy"><CircleStop size={14} /></button>}<button className="icon-btn" disabled={job.status === "hidden" || busy} onClick={() => remove(job)} title="Delete"><Trash2 size={14} /></button></td></tr>)}{!loading && !items.length && <tr><td colSpan="6">No vacancy posts.</td></tr>}</tbody></table></div>
    </>
  );
}
