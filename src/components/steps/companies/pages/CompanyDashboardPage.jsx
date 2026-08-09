import { useEffect, useState } from "react";
import { BriefcaseBusiness, FileText, LoaderCircle, Users } from "lucide-react";
import InlineCvViewer from "../../../InlineCvViewer.jsx";
import { companyApi } from "../../../../lib/api.js";


export default function CompanyDashboardPage({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cvApplicant, setCvApplicant] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [profile, jobs] = await Promise.all([companyApi.profile(), companyApi.jobs()]);
        const results = await Promise.allSettled(jobs.map((job) => companyApi.applicants(job.id)));
        if (active) setData({ profile, jobs, applicants: results.flatMap((result) => result.status === "fulfilled" ? result.value : []) });
      } catch (reason) {
        if (active) setError(reason.message || "Could not load company data");
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  const viewCv = (item) => { setError(""); setCvApplicant(item); };

  if (loading) return <div className="admin-loading"><LoaderCircle className="spin" /> Loading company records…</div>;
  if (!data) return <div className="verification-alert">{error || "Company data is unavailable."}</div>;

  return <>
    <div className="verification-page-heading"><div><h1 className="admin-page-title">{data.profile.company_name}</h1><p className="admin-page-sub">Vacancies and applicants</p></div></div>
    {error && <div className="verification-alert">{error}</div>}
    <div className="company-simple-actions">
      <button className="chart-card company-simple-action" onClick={() => onNavigate("jobs")}><BriefcaseBusiness size={20} /><span><strong>{data.jobs.filter((job) => job.status === "active").length} active vacancies</strong><small>Create, edit, or end a vacancy</small></span></button>
      <button className="chart-card company-simple-action" onClick={() => onNavigate("applicants")}><Users size={20} /><span><strong>{data.applicants.length} applicants</strong><small>View CVs, rank, and schedule</small></span></button>
    </div>
    <div className="admin-section-heading"><div className="chart-card-title">Applicants</div><button className="verification-profile-link" onClick={() => onNavigate("applicants")}>View all</button></div>
    <div className="admin-table-card"><table className="admin-full-table"><thead><tr><th>Applicant ID</th><th>Name</th><th>Email</th><th>Phone</th><th>CV</th></tr></thead><tbody>
      {data.applicants.slice(0, 8).map((item) => <tr key={item.applicant_record_id || item.application_id}><td><code className="applicant-record-id">{item.applicant_record_id || item.application_id}</code></td><td><strong>{item.name || "Applicant"}</strong></td><td>{item.email || "—"}</td><td>{item.phone || "—"}</td><td><button className="btn btn-outline admin-inline-button" onClick={() => viewCv(item)}><FileText size={14} /> View CV</button></td></tr>)}
      {!data.applicants.length && <tr><td colSpan="5">No applicants yet.</td></tr>}
    </tbody></table></div>
    <InlineCvViewer applicant={cvApplicant} onClose={() => setCvApplicant(null)} />
  </>;
}
