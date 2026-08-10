import { useEffect, useMemo, useState } from "react";
import { CalendarClock, ExternalLink, FileCheck2, FileText, LoaderCircle, Plus, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import InlineCvViewer from "../../../InlineCvViewer.jsx";
import InlineAnswerPdf from "../../../InlineAnswerPdf.jsx";
import { companyApi, interviewApi } from "../../../../lib/api.js";


const INITIAL_SCHEDULE = {
  scheduled_at: "",
  duration_minutes: 60,
  gap_minutes: 15,
  timezone: "Asia/Kathmandu",
  note: "",
};


function questionOrder(items) {
  return Math.max(0, ...items.map((item) => Number(item.order_index) || 0)) + 1;
}

function applicantRecordId(item) {
  return item?.applicant_record_id || item?.application_id;
}

function applicantProfileId(item) {
  return item?.applicant_profile_id || item?.applicant_id;
}


export default function CompanyApplicantsPage() {
  const [jobs, setJobs] = useState([]);
  const [jobId, setJobId] = useState("");
  const [applicants, setApplicants] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [topN, setTopN] = useState(3);
  const [schedule, setSchedule] = useState(INITIAL_SCHEDULE);
  const [showSchedule, setShowSchedule] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [cvApplicant, setCvApplicant] = useState(null);
  const [answerPdfInterview, setAnswerPdfInterview] = useState(null);
  const [setupInterview, setSetupInterview] = useState(null);
  const [examQuestions, setExamQuestions] = useState([]);
  const [examForm, setExamForm] = useState({ title: "", description: "", language: "text", starter_code: "", visible_tests: "[]", hidden_tests: "[]" });

  const rankedApplicants = useMemo(
    () => ranking.map((rank) => ({ ...rank, applicant: applicants.find((item) => applicantRecordId(item) === applicantRecordId(rank)) })).filter((item) => item.applicant),
    [ranking, applicants],
  );

  const loadInterviews = async () => {
    try {
      await interviewApi.syncMe();
      const rows = await interviewApi.list();
      const assessments = await Promise.all(rows.map((item) => interviewApi.codingStatus(item.id).catch(() => null)));
      setInterviews(rows.map((item, index) => ({ ...item, assessment: assessments[index] })));
    } catch {
      setInterviews([]);
    }
  };

  useEffect(() => {
    Promise.all([companyApi.jobs(), loadInterviews()])
      .then(([rows]) => { setJobs(rows); setJobId(rows[0]?.id || ""); })
      .catch((reason) => setError(reason.message || "Could not load company records"))
      .finally(() => setLoading(false));
  }, []);

  const loadApplicants = async (selectedId = jobId) => {
    if (!selectedId) { setApplicants([]); return; }
    setLoading(true); setError(""); setMessage(""); setRanking([]); setSetupInterview(null);
    try { setApplicants(await companyApi.applicants(selectedId)); }
    catch (reason) { setError(reason.message || "Could not load applicants"); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (jobId) void loadApplicants(jobId); }, [jobId]);

  const rank = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const rows = await companyApi.ranking(jobId, Math.min(Number(topN), applicants.length));
      setRanking(rows);
      setMessage(`${rows.length} top candidate${rows.length === 1 ? "" : "s"} ranked and ready for scheduling.`);
    } catch (reason) { setError(reason.message || "Could not rank applicants"); }
    finally { setBusy(false); }
  };

  const scheduleTopCandidates = async (event) => {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const selections = rankedApplicants.map(({ applicant }) => ({
        candidate_id: applicantProfileId(applicant),
        application_id: applicantRecordId(applicant),
      }));
      if (!selections.length || selections.some((item) => !item.candidate_id || !item.application_id)) {
        throw new Error("The ranked applicant records are incomplete. Refresh and rank the candidates again.");
      }
      await Promise.all(selections.map((item) => companyApi.updateApplication(item.application_id, "shortlisted")));
      const result = await interviewApi.bulkSchedule({
        job_id: jobId,
        candidates: selections,
        ...schedule,
        duration_minutes: Number(schedule.duration_minutes),
        gap_minutes: Number(schedule.gap_minutes),
      });
      await Promise.all([loadApplicants(jobId), loadInterviews()]);
      setShowSchedule(false);
      setMessage(`${result.created.length} separate interview invitation${result.created.length === 1 ? "" : "s"} sent${result.skipped.length ? `; ${result.skipped.length} existing interview${result.skipped.length === 1 ? " was" : "s were"} kept` : ""}.`);
    } catch (reason) { setError(reason.message || "Could not schedule the selected candidates"); }
    finally { setBusy(false); }
  };

  const viewCv = (item) => { setError(""); setCvApplicant(item); };

  const interviewFor = (applicationId) => interviews.find((item) => item.application_id === applicationId && !["cancelled", "rejected"].includes(item.scheduling_status));

  const openSetup = async (item, applicant) => {
    setSetupInterview({ ...item, candidate_name: applicant.name || applicant.email });
    setError("");
    try {
      setExamQuestions(await interviewApi.codingQuestions(item.id));
    } catch (reason) { setError(reason.message || "Could not load the interview questions"); }
  };

  const addExam = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const visible = JSON.parse(examForm.visible_tests || "[]");
      const hidden = JSON.parse(examForm.hidden_tests || "[]");
      if (!Array.isArray(visible) || !Array.isArray(hidden)) throw new Error("Test cases must be JSON arrays.");
      await interviewApi.createCodingQuestion(setupInterview.id, {
        title: examForm.title,
        description: examForm.description,
        difficulty: "Medium",
        language: examForm.language,
        starter_code: examForm.starter_code,
        visible_test_cases: visible,
        hidden_test_cases: hidden,
        default_time_limit_minutes: 30,
        time_limit_minutes: 30,
        order_index: questionOrder(examQuestions),
      });
      setExamForm({ title: "", description: "", language: "text", starter_code: "", visible_tests: "[]", hidden_tests: "[]" });
      setExamQuestions(await interviewApi.codingQuestions(setupInterview.id));
    } catch (reason) { setError(reason.message || "Could not add the proctored question"); }
    finally { setBusy(false); }
  };

  const deleteQuestion = async (id) => {
    setBusy(true); setError("");
    try {
      await interviewApi.deleteCodingQuestion(setupInterview.id, id);
      setExamQuestions(await interviewApi.codingQuestions(setupInterview.id));
    } catch (reason) { setError(reason.message || "Could not remove the question"); }
    finally { setBusy(false); }
  };

  const openInterview = (item) => {
    const url = new URL(window.location.href);
    url.searchParams.set("interview_id", item.id);
    window.location.assign(url.toString());
  };

  return (
    <>
      <div className="verification-page-heading">
        <div><h1 className="admin-page-title">Applicants</h1><p className="admin-page-sub">Contact applicants, view their submitted CV, rank the Top N, and schedule separate interviews.</p></div>
        <button className="btn btn-secondary verification-refresh" onClick={() => loadApplicants()}><RefreshCw size={15} /> Refresh</button>
      </div>
      {error && <div className="verification-alert" role="alert">{error}</div>}
      {message && <div className="portal-success">{message}</div>}

      <section className="chart-card portal-compact-workflow">
        <label className="field"><span>Vacancy</span><select value={jobId} onChange={(event) => setJobId(event.target.value)}>{jobs.map((job) => <option key={job.id} value={job.id}>{job.title} · {job.status}</option>)}</select></label>
        <label className="field"><span>Number of candidates</span><input type="number" min="1" max={Math.max(1, applicants.length)} value={topN} onChange={(event) => setTopN(event.target.value)} /></label>
        <button className="btn btn-primary" disabled={!jobId || !applicants.length || busy} onClick={rank}><Sparkles size={15} /> {busy ? "Working…" : "Rank Top N"}</button>
        <button className="btn btn-outline" disabled={!rankedApplicants.length || busy} onClick={() => setShowSchedule(true)}><CalendarClock size={15} /> Schedule Top N</button>
      </section>

      {showSchedule && <form className="chart-card portal-form" onSubmit={scheduleTopCandidates}>
        <div className="admin-section-heading"><div className="chart-card-title">Automatic interview schedule</div><button type="button" className="icon-btn" onClick={() => setShowSchedule(false)}><X size={15} /></button></div>
        <p className="admin-page-sub">Each selected candidate receives a different meeting link and the next available time slot.</p>
        <div className="info-grid">
          <label className="item"><span className="k">First interview</span><input required type="datetime-local" value={schedule.scheduled_at} onChange={(e) => setSchedule({ ...schedule, scheduled_at: e.target.value })} /></label>
          <label className="item"><span className="k">Interview minutes</span><input type="number" min="15" value={schedule.duration_minutes} onChange={(e) => setSchedule({ ...schedule, duration_minutes: e.target.value })} /></label>
          <label className="item"><span className="k">Gap between interviews</span><input type="number" min="0" value={schedule.gap_minutes} onChange={(e) => setSchedule({ ...schedule, gap_minutes: e.target.value })} /></label>
          <label className="item"><span className="k">Timezone</span><input required value={schedule.timezone} onChange={(e) => setSchedule({ ...schedule, timezone: e.target.value })} /></label>
        </div>
        <label className="item"><span className="k">Message to candidates</span><textarea value={schedule.note} onChange={(e) => setSchedule({ ...schedule, note: e.target.value })} /></label>
        <button className="btn btn-primary" disabled={busy}>Send {rankedApplicants.length} invitations</button>
      </form>}

      <div className="admin-table-card"><table className="admin-full-table"><thead><tr><th>Applicant ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Rank</th><th>Application</th><th>Interview status</th><th>CV and interview</th></tr></thead><tbody>
        {loading && <tr><td colSpan="8"><LoaderCircle className="spin" size={17} /> Loading applicants…</td></tr>}
        {!loading && applicants.map((item) => {
          const recordId = applicantRecordId(item);
          const ranked = ranking.find((rankedItem) => applicantRecordId(rankedItem) === recordId);
          const scheduled = interviewFor(recordId);
          return <tr key={recordId}>
            <td><code className="applicant-record-id">{recordId}</code></td><td><strong>{item.name || "Applicant"}</strong></td><td>{item.email || "—"}</td><td>{item.phone || "—"}</td>
            <td>{ranked ? <strong>#{ranked.rank}</strong> : "—"}</td>
            <td><span className={`pill ${item.application_status === "rejected" ? "danger" : item.application_status === "interview_scheduled" ? "success" : "warn"}`}>{item.application_status.replaceAll("_", " ")}</span></td>
            <td><div className="application-interview-cell"><span className={`pill ${scheduled?.display_status === "completed" ? "success" : scheduled?.display_status === "accepted" ? "neutral" : "warn"}`}>{scheduled?.display_status || "pending"}</span>{scheduled?.oral_score != null && <small>Oral {scheduled.oral_score} / {scheduled.oral_max_score}</small>}{scheduled?.assessment?.evaluation_status === "completed" && <small>Paper {scheduled.assessment.marks_awarded} / {scheduled.assessment.max_marks}</small>}{scheduled?.assessment?.status === "skipped" && <small>Proctoring skipped</small>}</div></td>
            <td className="admin-row-actions"><button className="btn btn-outline admin-inline-button" onClick={() => viewCv(item)}><FileText size={14} /> View CV</button>{scheduled && <><button className="btn btn-outline admin-inline-button" onClick={() => openInterview(scheduled)}><ExternalLink size={14} /> Open interview</button>{scheduled.assessment?.status === "not_started" && <button className="btn btn-outline admin-inline-button" onClick={() => openSetup(scheduled, item)}><Plus size={14} /> Set paper</button>}{scheduled.assessment?.answer_pdf_ready && <button className="btn btn-outline admin-inline-button" onClick={() => setAnswerPdfInterview(scheduled)}><FileCheck2 size={14} /> PDF & marks</button>}</>}</td>
          </tr>;
        })}
        {!loading && !applicants.length && <tr><td colSpan="8">No applicants for this vacancy.</td></tr>}
      </tbody></table></div>

      <InlineCvViewer applicant={cvApplicant} onClose={() => setCvApplicant(null)} />
      <InlineAnswerPdf interview={answerPdfInterview} onClose={() => setAnswerPdfInterview(null)} />

      {setupInterview && <section className="chart-card interview-question-setup">
        <div className="admin-section-heading"><div><div className="chart-card-title">Proctored paper · {setupInterview.candidate_name}</div><p className="admin-page-sub">The oral round has no stored questions; the interviewer gives one overall mark out of 10. Add paper questions here, each worth 5 marks.</p></div><button className="icon-btn" onClick={() => setSetupInterview(null)}><X size={15} /></button></div>
        <div className="interview-setup-grid paper-only">
          <div>
            <h3>Paper questions · 5 marks each</h3>
            <form onSubmit={addExam}><input required placeholder="Question title" value={examForm.title} onChange={(e) => setExamForm({ ...examForm, title: e.target.value })} /><textarea required placeholder="Full question or task" value={examForm.description} onChange={(e) => setExamForm({ ...examForm, description: e.target.value })} /><select value={examForm.language} onChange={(e) => setExamForm({ ...examForm, language: e.target.value })}><option value="text">Written answer</option><option value="python">Python coding</option></select><textarea placeholder="Starter answer or starter code (optional)" value={examForm.starter_code} onChange={(e) => setExamForm({ ...examForm, starter_code: e.target.value })} />{examForm.language === "python" && <><textarea placeholder={'Visible tests JSON, e.g. [{"input":"solve(2)","expected_output":"4"}]'} value={examForm.visible_tests} onChange={(e) => setExamForm({ ...examForm, visible_tests: e.target.value })} /><textarea placeholder="Hidden tests JSON" value={examForm.hidden_tests} onChange={(e) => setExamForm({ ...examForm, hidden_tests: e.target.value })} /></>}<button className="btn btn-primary" disabled={busy}><Plus size={14} /> Add proctored question</button></form>
            {examQuestions.map((question) => <div className="interview-question-row" key={question.id}><span>{question.order_index}. {question.title} · 5 marks</span><button className="icon-btn" onClick={() => deleteQuestion(question.id)}><Trash2 size={13} /></button></div>)}
          </div>
        </div>
      </section>}
    </>
  );
}
