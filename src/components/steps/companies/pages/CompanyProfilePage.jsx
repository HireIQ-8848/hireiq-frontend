import { useEffect, useState } from "react";
import { ExternalLink, FileCheck2, LoaderCircle, RefreshCw } from "lucide-react";
import InlineAnswerPdf from "../../../InlineAnswerPdf.jsx";
import { companyApi, interviewApi, registrationApi } from "../../../../lib/api.js";

function value(fields, ...names) {
  for (const name of names) if (fields?.[name]?.value) return fields[name].value;
  return "—";
}

export default function CompanyProfilePage({ user }) {
  const [company, setCompany] = useState(null);
  const [registration, setRegistration] = useState(null);
  const [interviews, setInterviews] = useState([]);
  const [answerPdfInterview, setAnswerPdfInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async () => { setLoading(true); setError(""); try { const [companyResult, registrationResult] = await Promise.all([companyApi.profile(), registrationApi.status()]); await interviewApi.syncMe(); const interviewRows = await interviewApi.list(); const assessments = await Promise.all(interviewRows.map((item) => interviewApi.codingStatus(item.id).catch(() => null))); setCompany(companyResult); setRegistration(registrationResult); setInterviews(interviewRows.map((item, index) => ({ ...item, assessment: assessments[index] }))); } catch (reason) { setError(reason.message || "Could not load company profile"); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  if (loading) return <div className="admin-loading"><LoaderCircle className="spin" /> Loading stored company information…</div>;
  const fields = registration?.fields || {};
  return (
    <>
      <div className="verification-page-heading"><div><h1 className="admin-page-title">Company Profile</h1><p className="admin-page-sub">Company and identity fields shown here are read from the database.</p></div><button className="btn btn-secondary verification-refresh" onClick={load}><RefreshCw size={15} /> Refresh</button></div>
      {error && <div className="verification-alert">{error}</div>}
      {company && <div className="admin-grid-3"><section className="chart-card"><div className="chart-card-title">Company account</div><div className="identity-field-summary portal-single-column"><div className="item"><div className="k">Company name</div><div className="v">{company.company_name}</div></div><div className="item"><div className="k">Status</div><div className="v">{company.status}</div></div><div className="item"><div className="k">Google account</div><div className="v">{user?.email}</div></div><div className="item"><div className="k">Identity verification</div><div className="v">{registration?.verification_status === "verified" ? "Verified" : "Not Verified"}</div></div></div></section><section className="chart-card" style={{ gridColumn: "span 2" }}><div className="chart-card-title">Registered business information</div><div className="identity-field-summary"><div className="item"><div className="k">Registration number</div><div className="v">{company.registration_number || value(fields, "registration_number")}</div></div><div className="item"><div className="k">Address</div><div className="v">{company.address || value(fields, "company_address", "address_english", "address_nepali", "address")}</div></div><div className="item"><div className="k">Phone</div><div className="v">{company.phone || value(fields, "phone")}</div></div><div className="item"><div className="k">Website</div><div className="v">{company.website || "—"}</div></div><div className="item"><div className="k">Representative name</div><div className="v">{value(fields, "name_english", "full_name")}</div></div><div className="item"><div className="k">Representative document</div><div className="v">{value(fields, "document_number")}</div></div></div></section></div>}
      <div className="admin-section-heading" style={{ marginTop: 22 }}><div><div className="chart-card-title">Applicant interview status</div><p className="admin-page-sub">Open an applicant interview or inspect the submitted PDF and marks from the same row.</p></div></div>
      <div className="admin-table-card"><table className="admin-full-table"><thead><tr><th>Applicant</th><th>Application ID</th><th>Interview status</th><th>Scores</th><th>Links</th></tr></thead><tbody>{interviews.map((item) => <tr key={item.id}><td><strong>{item.candidate_name || "Applicant"}</strong><br /><small>{item.candidate_email || ""}</small></td><td><code className="applicant-record-id">{item.application_id || "—"}</code></td><td><span className={`pill ${item.display_status === "completed" ? "success" : item.display_status === "accepted" ? "neutral" : "warn"}`}>{item.display_status}</span></td><td><div className="application-interview-cell"><span>{item.oral_score == null ? "Oral — / 10" : `Oral ${item.oral_score} / ${item.oral_max_score}`}</span><small>{item.assessment?.evaluation_status === "completed" ? `Paper ${item.assessment.marks_awarded} / ${item.assessment.max_marks}` : item.assessment?.status === "skipped" ? "Paper skipped" : "Paper —"}</small></div></td><td className="admin-row-actions"><button className="btn btn-outline admin-inline-button" onClick={() => { const url = new URL(window.location.href); url.searchParams.set("interview_id", item.id); window.location.assign(url.toString()); }}><ExternalLink size={14} /> Interview</button>{item.assessment?.answer_pdf_ready && <button className="btn btn-outline admin-inline-button" onClick={() => setAnswerPdfInterview(item)}><FileCheck2 size={14} /> PDF & breakdown</button>}</td></tr>)}{!interviews.length && <tr><td colSpan="5">No applicant interviews yet.</td></tr>}</tbody></table></div>
      <InlineAnswerPdf interview={answerPdfInterview} onClose={() => setAnswerPdfInterview(null)} />
    </>
  );
}
