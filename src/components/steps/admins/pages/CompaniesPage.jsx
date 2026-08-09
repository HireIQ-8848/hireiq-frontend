import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Building2, ChevronDown, ChevronUp, Eye, EyeOff, Flag, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { adminApi } from "../../../../lib/api.js";

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function displayList(value) {
  if (!Array.isArray(value) || !value.length) return "—";
  return value.map((item) => typeof item === "string" ? item : item?.name || item?.label || JSON.stringify(item)).join(", ");
}

function displaySalary(job) {
  if (job.salary_min == null && job.salary_max == null) return "Not specified";
  if (job.salary_min != null && job.salary_max != null) return `${job.salary_min} – ${job.salary_max}`;
  return job.salary_min != null ? `From ${job.salary_min}` : `Up to ${job.salary_max}`;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState("");
  const [moderationReason, setModerationReason] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [companyRows, jobRows] = await Promise.all([adminApi.companies(), adminApi.jobs()]);
      setCompanies(companyRows);
      setJobs(jobRows);
    } catch (reason) {
      setError(reason.message || "Could not load company records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);
  const posts = useMemo(() => jobs.reduce((result, job) => {
    result[job.company_id] = [...(result[job.company_id] || []), job];
    return result;
  }, {}), [jobs]);

  const moderateCompany = async (company) => {
    const action = company.status === "blocked" ? "unblock" : "block";
    if (moderationReason.trim().length < 3) {
      setError("Enter a moderation reason before flagging or restoring a company.");
      return;
    }
    setActionBusy(`company-${company.id}`);
    setError("");
    try {
      await adminApi.moderateCompany(company.id, action, moderationReason.trim());
      await load();
    } catch (reason) {
      setError(reason.message || "Could not moderate this company");
    } finally {
      setActionBusy("");
    }
  };

  const moderateJob = async (job) => {
    const action = job.status === "hidden" ? "restore" : "hide";
    if (moderationReason.trim().length < 3) {
      setError("Enter a moderation reason before hiding or restoring a vacancy announcement.");
      return;
    }
    setActionBusy(`job-${job.id}`);
    setError("");
    try {
      await adminApi.moderateJob(job.id, action, moderationReason.trim());
      await load();
    } catch (reason) {
      setError(reason.message || "Could not moderate this vacancy announcement");
    } finally {
      setActionBusy("");
    }
  };

  return (
    <>
      <div className="verification-page-heading">
        <div>
          <h1 className="admin-page-title">Company Oversight</h1>
          <p className="admin-page-sub">Inspect registered companies and every job post stored in the HireIQ database.</p>
        </div>
        <button className="btn btn-secondary verification-refresh" onClick={load}><RefreshCw size={15} /> Refresh</button>
      </div>
      {error && <div className="verification-alert">{error}</div>}

      <div className="admin-stat-row admin-stat-row-compact">
        <article className="admin-stat-card"><div className="admin-stat-top"><div><div className="admin-stat-label">Registered companies</div><div className="admin-stat-value">{companies.length}</div></div><div className="admin-stat-icon"><Building2 size={19} /></div></div></article>
        <article className="admin-stat-card"><div className="admin-stat-top"><div><div className="admin-stat-label">All job posts</div><div className="admin-stat-value">{jobs.length}</div></div><div className="admin-stat-icon"><BriefcaseBusiness size={19} /></div></div></article>
        <article className="admin-stat-card"><div className="admin-stat-top"><div><div className="admin-stat-label">Active posts</div><div className="admin-stat-value">{jobs.filter((job) => job.status === "active").length}</div></div><div className="admin-stat-icon success"><BriefcaseBusiness size={19} /></div></div></article>
      </div>

      <section className="admin-moderation-bar">
        <div><ShieldCheck size={17} /><div><strong>Moderation reason</strong><span>Required for every company flag, vacancy hide, or restore action. It is saved in the audit log.</span></div></div>
        <input value={moderationReason} onChange={(event) => setModerationReason(event.target.value)} placeholder="Example: Misleading vacancy details reported and confirmed" />
      </section>

      <div className="admin-table-card">
        <table className="admin-full-table">
          <thead><tr><th>Company</th><th>Registered owner</th><th>Registration number</th><th>Address</th><th>Contact</th><th>Status</th><th>Job posts</th><th>Inspect</th><th>Moderate</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan="9"><LoaderCircle className="spin" size={17} /> Loading companies…</td></tr>}
            {!loading && companies.map((company) => (
              <tr key={company.id}>
                <td><strong>{company.company_name}</strong><div className="verification-candidate-email">{company.website || company.id}</div></td>
                <td><strong>{company.owner?.full_name || "—"}</strong><div className="verification-candidate-email">{company.owner?.email || "No owner email"}</div><span className={`pill ${company.owner?.verification_status === "verified" ? "success" : "danger"}`}>{company.owner?.verification_status === "verified" ? "Verified identity" : "Not verified"}</span></td>
                <td>{company.registration_number || "—"}</td>
                <td>{company.address || "—"}</td>
                <td>{company.phone || "—"}</td>
                <td><span className={`pill ${company.status === "active" ? "success" : "danger"}`}>{company.status}</span></td>
                <td>{posts[company.id]?.length || 0}</td>
                <td><button className="btn btn-secondary verification-review-button" onClick={() => setExpanded(expanded === company.id ? null : company.id)}>{expanded === company.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Job posts</button></td>
                <td><button className={`btn ${company.status === "blocked" ? "btn-secondary" : "admin-danger-button"} verification-review-button`} disabled={!!actionBusy} onClick={() => moderateCompany(company)}>{company.status === "blocked" ? <><Eye size={14} /> Restore</> : <><Flag size={14} /> Flag company</>}</button></td>
              </tr>
            ))}
            {!loading && !companies.length && <tr><td colSpan="9">No companies have registered yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {expanded && (() => {
        const company = companies.find((item) => item.id === expanded);
        const companyJobs = posts[expanded] || [];
        return (
          <section className="verification-review-panel">
            <div className="verification-review-header"><div><h2>{company?.company_name}</h2><p>All job posts created by this company</p></div><span className={`pill ${company?.status === "active" ? "success" : "danger"}`}>{company?.status}</span></div>
            <div className="admin-table-card" style={{ marginTop: 18 }}>
              <table className="admin-full-table">
                <thead><tr><th>Vacancy title</th><th>Announcement</th><th>Requirements and skills</th><th>Location / type</th><th>Salary</th><th>Deadline</th><th>Status</th><th>Created</th><th>Moderate</th></tr></thead>
                <tbody>
                  {companyJobs.map((job) => <tr key={job.id}><td><strong>{job.title}</strong><div className="verification-candidate-email">{job.id}</div></td><td className="admin-wrapped-cell">{job.description || "—"}</td><td className="admin-wrapped-cell">Requirements: {displayList(job.requirements)}<br />Skills: {displayList(job.skills)}<br />Education: {job.education_requirement || "—"}<br />Experience: {job.experience_requirement || "—"}</td><td>{job.location || "—"}<br />{job.employment_type || "—"}{job.remote_allowed ? " · Remote allowed" : ""}</td><td>{displaySalary(job)}</td><td>{formatDate(job.deadline)}</td><td><span className={`pill ${job.status === "active" ? "success" : job.status === "hidden" ? "danger" : "neutral"}`}>{job.status}</span></td><td>{formatDate(job.created_at)}</td><td><button className={`btn ${job.status === "hidden" ? "btn-secondary" : "admin-danger-button"} verification-review-button`} disabled={!!actionBusy} onClick={() => moderateJob(job)}>{job.status === "hidden" ? <><Eye size={14} /> Restore post</> : <><EyeOff size={14} /> Hide post</>}</button></td></tr>)}
                  {!companyJobs.length && <tr><td colSpan="9">This company has not created any job posts.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        );
      })()}
    </>
  );
}
