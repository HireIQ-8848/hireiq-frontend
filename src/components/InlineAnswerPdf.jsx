import { useEffect, useState } from "react";
import { FileCheck2, LoaderCircle, RefreshCw, X } from "lucide-react";
import { interviewApi, loadPrivateInterviewAsset } from "../lib/api.js";


export default function InlineAnswerPdf({ interview, onClose }) {
  const [assessment, setAssessment] = useState(interview?.assessment || null);
  const [asset, setAsset] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true); setError("");
    try {
      const status = await interviewApi.codingStatus(interview.id);
      setAssessment(status);
      if (!status.answer_pdf_url) throw new Error("The applicant answer PDF is not ready yet.");
      const loaded = await loadPrivateInterviewAsset(status.answer_pdf_url);
      setAsset((current) => {
        if (current?.revoke) URL.revokeObjectURL(current.url);
        return loaded;
      });
    } catch (reason) {
      setError(reason.message || "Could not load the applicant answer PDF");
    } finally { setBusy(false); }
  };

  const retryEvaluation = async () => {
    setBusy(true); setError("");
    try {
      await interviewApi.retryEvaluation(interview.id);
      await load();
    } catch (reason) {
      setError(reason.message || "Could not run Grok evaluation");
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!interview?.id) return () => {};
    void load();
    return () => {};
  }, [interview?.id]);

  useEffect(() => () => {
    if (asset?.revoke) URL.revokeObjectURL(asset.url);
  }, [asset]);

  if (!interview) return null;
  return <section className="chart-card cv-inline-viewer answer-pdf-viewer" aria-live="polite">
    <div className="admin-section-heading">
      <div><div className="chart-card-title"><FileCheck2 size={16} /> Submitted paper · {interview.candidate_name || interview.candidate_email || "Applicant"}</div><p className="admin-page-sub">Private PDF and Grok evaluation breakdown. Each question carries 5 marks.</p></div>
      <div className="admin-row-actions"><button className="icon-btn" onClick={load} disabled={busy} aria-label="Refresh evaluation"><RefreshCw className={busy ? "spin" : ""} size={15} /></button><button className="icon-btn" onClick={onClose} aria-label="Close answer PDF"><X size={16} /></button></div>
    </div>
    {error && <div className="verification-alert">{error}</div>}
    <div className="answer-pdf-layout">
      <div className="cv-inline-frame-shell">{busy && !asset && <div className="cv-inline-status"><LoaderCircle className="spin" size={20} /> Loading submitted paper…</div>}{asset && <iframe className="cv-inline-frame" src={asset.url} title="Applicant submitted answer sheet" />}</div>
      <aside className="answer-evaluation-panel">
        <div className="answer-score-total"><span>Grok result</span><strong>{assessment?.evaluation_status === "completed" ? `${assessment.marks_awarded} / ${assessment.max_marks}` : "Pending"}</strong><small>{assessment?.score_percent == null ? assessment?.evaluation_error || "Evaluation is processing." : `${assessment.score_percent}%`}</small>{assessment?.overall_feedback && <p>{assessment.overall_feedback}</p>}{["failed", "configuration_required", "pending"].includes(assessment?.evaluation_status) && <button className="btn btn-outline admin-inline-button" disabled={busy} onClick={retryEvaluation}>Retry evaluation</button>}</div>
        {(assessment?.breakdown || []).map((item) => <article key={item.question_id}><div><strong>Q{item.question_number}. {item.title}</strong><span>{item.marks_awarded ?? "—"} / 5</span></div><p>{item.evaluation?.feedback || "Awaiting Grok evaluation."}</p>{item.evaluation?.strengths?.length > 0 && <small>Strengths: {item.evaluation.strengths.join(" · ")}</small>}{item.evaluation?.improvements?.length > 0 && <small>Improve: {item.evaluation.improvements.join(" · ")}</small>}</article>)}
      </aside>
    </div>
  </section>;
}
