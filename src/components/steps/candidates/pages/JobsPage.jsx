import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, LoaderCircle, MapPin, RefreshCw } from "lucide-react";
import { applicationsApi, jobsApi } from "../../../../lib/api.js";

function formatDate(value) {
  if (!value) return "No deadline";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));
}

function salary(job) {
  if (job.salary_min == null && job.salary_max == null) return "Salary not specified";
  if (job.salary_min != null && job.salary_max != null) return `${job.salary_min} – ${job.salary_max}`;
  return job.salary_min != null ? `From ${job.salary_min}` : `Up to ${job.salary_max}`;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [jobRows, applicationRows] = await Promise.all([jobsApi.list(), applicationsApi.mine()]);
      setJobs(jobRows);
      setApplications(applicationRows);
    } catch (reason) {
      setError(reason.message || "Could not load the job marketplace");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);
  const appliedIds = useMemo(() => new Set(applications.map((item) => item.job_id)), [applications]);
  const filtered = jobs.filter((job) => `${job.title} ${job.company_name} ${job.location} ${(job.skills || []).join(" ")}`.toLowerCase().includes(query.toLowerCase()));

  const apply = async (job) => {
    setBusy(job.id);
    setError("");
    setMessage("");
    try {
      await jobsApi.apply(job.id);
      setMessage(`Application submitted to ${job.company_name || "the company"}.`);
      await load();
    } catch (reason) {
      setError(reason.message || "Could not submit this application");
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      <div className="verification-page-heading"><div><h1 className="admin-page-title">Job Marketplace</h1><p className="admin-page-sub">Only active vacancies from active companies in the HireIQ database are shown.</p></div><button className="btn btn-secondary verification-refresh" onClick={load}><RefreshCw size={15} /> Refresh</button></div>
      <div className="admin-search-bar portal-search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search live jobs, companies, skills or locations…" /></div>
      {error && <div className="verification-alert">{error}</div>}
      {message && <div className="portal-success">{message}</div>}
      {loading ? <div className="admin-loading"><LoaderCircle className="spin" /> Loading vacancies…</div> : (
        <div className="portal-card-grid">
          {filtered.map((job) => (
            <article className="chart-card portal-job-card" key={job.id}>
              <div className="portal-job-heading"><div className="tile-icon"><BriefcaseBusiness size={17} /></div><div><h2>{job.title}</h2><p>{job.company_name || job.company_id}</p></div><span className="pill success">{job.status}</span></div>
              <p className="portal-job-description">{job.description}</p>
              <div className="portal-job-meta"><span><MapPin size={13} /> {job.location || "Location not specified"}</span><span>{job.employment_type?.replaceAll("_", " ")}</span><span>{job.remote_allowed ? "Remote allowed" : "On-site / employer specified"}</span><span>{salary(job)}</span><span>Deadline: {formatDate(job.deadline)}</span></div>
              <div className="portal-tags">{(job.skills || []).map((skill) => <span className="pill neutral" key={skill}>{skill}</span>)}</div>
              <button className="btn btn-primary admin-inline-button" disabled={appliedIds.has(job.id) || busy === job.id} onClick={() => apply(job)}>{appliedIds.has(job.id) ? "Already applied" : busy === job.id ? "Submitting…" : "Apply with active CV"}</button>
            </article>
          ))}
          {!filtered.length && <div className="verification-asset-empty">No active vacancies match your search.</div>}
        </div>
      )}
    </>
  );
}
