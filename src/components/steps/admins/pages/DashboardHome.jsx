import { useEffect, useState } from "react";
import {
  Activity,
  BriefcaseBusiness,
  Building2,
  CircleAlert,
  LoaderCircle,
  ShieldCheck,
  Users,
} from "lucide-react";
import { adminApi } from "../../../../lib/api.js";

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function Stat({ icon: Icon, label, value, tone = "" }) {
  return (
    <article className="admin-stat-card">
      <div className="admin-stat-top">
        <div>
          <div className="admin-stat-label">{label}</div>
          <div className="admin-stat-value">{value}</div>
        </div>
        <div className={`admin-stat-icon ${tone}`}><Icon size={19} /></div>
      </div>
    </article>
  );
}

export default function DashboardHome({ admin, onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      adminApi.dashboard(),
      adminApi.verifications(),
      adminApi.companies(),
      adminApi.jobs(),
      adminApi.health(),
    ])
      .then(([summary, verifications, companies, jobs, health]) => {
        if (active) setData({ summary, verifications, companies, jobs, health });
      })
      .catch((reason) => {
        if (active) setError(reason.message || "Could not load administration data");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  if (loading) return <div className="admin-loading"><LoaderCircle className="spin" /> Loading live HireIQ data…</div>;

  return (
    <>
      <h1 className="admin-page-title">Verification Administration</h1>
      <p className="admin-page-sub">
        Welcome, {admin?.fullName || admin?.email || "Administrator"}. Review real registrations,
        identity evidence, verification results, companies, and their job posts.
      </p>

      {error && <div className="verification-alert"><CircleAlert size={15} /> {error}</div>}
      {data && (
        <>
          <div className="admin-stat-row">
            <Stat icon={Users} label="Registered applicants" value={data.summary.users} />
            <Stat icon={ShieldCheck} label="Verified / exempt profiles" value={data.summary.verified_profiles} tone="success" />
            <Stat icon={CircleAlert} label="Failed verifications" value={data.summary.failed_verifications} tone="danger" />
            <Stat icon={Building2} label="Registered companies" value={data.summary.companies} />
            <Stat icon={BriefcaseBusiness} label="Active company posts" value={data.summary.active_jobs} />
          </div>

          <div className="admin-grid-3">
            <section className="chart-card" style={{ gridColumn: "span 2" }}>
              <div className="admin-section-heading">
                <div className="chart-card-title">Latest registration and verification activity</div>
                <button className="verification-profile-link" onClick={() => onNavigate("verifications")}>View all evidence</button>
              </div>
              <div className="admin-table-card admin-embedded-table">
                <table className="admin-full-table">
                  <thead><tr><th>Applicant</th><th>Document</th><th>Stage</th><th>Result</th><th>Submitted</th></tr></thead>
                  <tbody>
                    {data.verifications.slice(0, 8).map((item) => (
                      <tr key={item.id}>
                        <td><strong>{item.candidate?.full_name || item.candidate?.email || item.profile_id}</strong></td>
                        <td>{item.document_type || "—"}</td>
                        <td>{(item.current_stage || "pending").replaceAll("_", " ")}</td>
                        <td><span className={`pill ${item.verification_status === "verified" ? "success" : "danger"}`}>{item.verification_status === "verified" ? "Verified" : "Not Verified"}</span></td>
                        <td>{formatDate(item.created_at)}</td>
                      </tr>
                    ))}
                    {!data.verifications.length && <tr><td colSpan="5">No verification submissions yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="chart-card">
              <div className="chart-card-title"><Activity size={15} /> System services</div>
              <div className="system-summary">
                <span>Database <strong>{data.health.database}</strong></span>
                <span>Private storage <strong>{data.health.storage}</strong></span>
              </div>
              <div className="model-status-list">
                <div className="model-status-row"><div><strong>Verification service</strong><small>Identity operations</small></div><span className={`pill ${data.health.verification === "ready" ? "success" : "danger"}`}>{data.health.verification}</span></div>
                <div className="model-status-row"><div><strong>Database</strong><small>Registration data</small></div><span className="pill success">{data.health.database}</span></div>
                <div className="model-status-row"><div><strong>Private storage</strong><small>Documents and evidence</small></div><span className="pill success">{data.health.storage}</span></div>
              </div>
              <button className="btn btn-secondary admin-inline-button" onClick={() => onNavigate("system")}>Inspect system status</button>
            </section>
          </div>

          <section className="chart-card">
            <div className="admin-section-heading">
              <div className="chart-card-title">Latest company job posts</div>
              <button className="verification-profile-link" onClick={() => onNavigate("companies")}>View companies and posts</button>
            </div>
            <div className="admin-table-card admin-embedded-table">
              <table className="admin-full-table">
                <thead><tr><th>Job title</th><th>Company</th><th>Status</th><th>Created</th></tr></thead>
                <tbody>
                  {data.jobs.slice(0, 8).map((job) => {
                    const company = data.companies.find((item) => item.id === job.company_id);
                    return <tr key={job.id}><td><strong>{job.title}</strong></td><td>{company?.company_name || job.company_id}</td><td><span className={`pill ${job.status === "active" ? "success" : "neutral"}`}>{job.status}</span></td><td>{formatDate(job.created_at)}</td></tr>;
                  })}
                  {!data.jobs.length && <tr><td colSpan="4">No company job posts yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
