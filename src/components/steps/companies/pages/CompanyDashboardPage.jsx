import { useEffect, useState } from "react";
import { BriefcaseBusiness, ExternalLink, FileCheck2, FileText, LoaderCircle, Users } from "lucide-react";
import InlineCvViewer from "../../../InlineCvViewer.jsx";
import InlineAnswerPdf from "../../../InlineAnswerPdf.jsx";
import { companyApi, interviewApi } from "../../../../lib/api.js";


export default function CompanyDashboardPage({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cvApplicant, setCvApplicant] = useState(null);
  const [answerPdfInterview, setAnswerPdfInterview] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [profile, jobs] = await Promise.all([companyApi.profile(), companyApi.jobs()]);
        const results = await Promise.allSettled(jobs.map((job) => companyApi.applicants(job.id)));
        await interviewApi.syncMe();
        const interviews = await interviewApi.list();
        const assessments = await Promise.all(interviews.map((item) => interviewApi.codingStatus(item.id).catch(() => null)));
        if (active) setData({ profile, jobs, applicants: results.flatMap((result) => result.status === "fulfilled" ? result.value : []), interviews: interviews.map((item, index) => ({ ...item, assessment: assessments[index] })) });
      } catch (reason) {
        if (active) setError(reason.message || "Could not load company data");
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  const viewCv = (item) => { setError(""); setCvApplicant(item); };
  const openInterview = (interview) => { const url = new URL(window.location.href); url.searchParams.set("interview_id", interview.id); window.location.assign(url.toString()); };

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
    <div className="admin-table-card"><table className="admin-full-table"><thead><tr><th>Applicant ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Interview</th><th>Actions</th></tr></thead><tbody>
      {data.applicants.slice(0, 8).map((item) => { const applicationId = item.applicant_record_id || item.application_id; const interview = data.interviews.find((row) => row.application_id === applicationId && !["cancelled", "rejected"].includes(row.scheduling_status)); return <tr key={applicationId}><td><code className="applicant-record-id">{applicationId}</code></td><td><strong>{item.name || "Applicant"}</strong></td><td>{item.email || "—"}</td><td>{item.phone || "—"}</td><td><div className="application-interview-cell"><span className={`pill ${interview?.display_status === "completed" ? "success" : interview?.display_status === "accepted" ? "neutral" : "warn"}`}>{interview?.display_status || "pending"}</span>{interview?.oral_score != null && <small>Oral {interview.oral_score} / {interview.oral_max_score}</small>}{interview?.assessment?.evaluation_status === "completed" && <small>Paper {interview.assessment.marks_awarded} / {interview.assessment.max_marks}</small>}</div></td><td className="admin-row-actions"><button className="btn btn-outline admin-inline-button" onClick={() => viewCv(item)}><FileText size={14} /> CV</button>{interview && <button className="btn btn-outline admin-inline-button" onClick={() => openInterview(interview)}><ExternalLink size={14} /> Interview</button>}{interview?.assessment?.answer_pdf_ready && <button className="btn btn-outline admin-inline-button" onClick={() => setAnswerPdfInterview(interview)}><FileCheck2 size={14} /> PDF & marks</button>}</td></tr>; })}
      {!data.applicants.length && <tr><td colSpan="6">No applicants yet.</td></tr>}
    </tbody></table></div>
    <InlineCvViewer applicant={cvApplicant} onClose={() => setCvApplicant(null)} />
    <InlineAnswerPdf interview={answerPdfInterview} onClose={() => setAnswerPdfInterview(null)} />
  </>;
}
