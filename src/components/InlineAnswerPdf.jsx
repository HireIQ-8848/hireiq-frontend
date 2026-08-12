import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileCheck2, LoaderCircle, RefreshCw, X } from "lucide-react";
import WrittenEvaluation from "./WrittenEvaluation.jsx";
import { interviewApi, loadPrivateInterviewAsset } from "../lib/api.js";
import { createSingleFlight, shouldPollEvaluation } from "../lib/writtenEvaluation.js";


export default function InlineAnswerPdf({ interview, onClose }) {
  const [assessment, setAssessment] = useState(interview?.assessment || null);
  const [asset, setAsset] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const status = await interviewApi.codingStatus(interview.id);
      setAssessment(status);
      if (!status.answer_pdf_ready || !status.answer_pdf_url) throw new Error("The applicant answer PDF is not ready yet.");
      const loaded = await loadPrivateInterviewAsset(status.answer_pdf_url);
      setAsset((current) => {
        if (current?.revoke) URL.revokeObjectURL(current.url);
        return loaded;
      });
    } catch (reason) {
      setError(reason.message || "Could not load the applicant answer PDF");
    } finally { setBusy(false); }
  }, [interview?.id]);

  const retryEvaluation = useMemo(() => createSingleFlight(async () => {
    setBusy(true); setError("");
    try {
      await interviewApi.retryEvaluation(interview.id);
      setAssessment(await interviewApi.codingStatus(interview.id));
    } catch (reason) {
      setError(reason.message || "Could not retry the written-answer evaluation");
      return null;
    } finally { setBusy(false); }
  }), [interview?.id]);

  useEffect(() => {
    setAssessment(interview?.assessment || null);
    setError("");
    setAsset((current) => {
      if (current?.revoke) URL.revokeObjectURL(current.url);
      return null;
    });
    if (!interview?.id) return undefined;
    void load();
    return undefined;
  }, [interview?.id, load]);

  useEffect(() => {
    if (!interview?.id || !shouldPollEvaluation(assessment)) return undefined;
    let cancelled = false;
    let timer;
    const refresh = async () => {
      try {
        const status = await interviewApi.codingStatus(interview.id);
        if (!cancelled) setAssessment(status);
        if (!cancelled && shouldPollEvaluation(status)) timer = window.setTimeout(refresh, 1500);
      } catch (reason) {
        if (!cancelled) {
          setError(reason.message || "Could not refresh the written-answer evaluation");
          timer = window.setTimeout(refresh, 1500);
        }
      }
    };
    timer = window.setTimeout(refresh, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [assessment?.evaluation_status, interview?.id]);

  useEffect(() => () => {
    if (asset?.revoke) URL.revokeObjectURL(asset.url);
  }, [asset]);

  if (!interview) return null;
  return <section className="chart-card cv-inline-viewer answer-pdf-viewer" aria-live="polite">
    <div className="admin-section-heading">
      <div><div className="chart-card-title"><FileCheck2 size={16} /> Submitted paper · {interview.candidate_name || interview.candidate_email || "Applicant"}</div><p className="admin-page-sub">Private PDF and AI evaluation breakdown. Each question carries 5 marks.</p></div>
      <div className="admin-row-actions">{asset && <a className="icon-btn" href={asset.url} download={`HireIQ-${interview.id}-answers.pdf`} aria-label="Download answer PDF"><Download size={15} /></a>}<button className="icon-btn" onClick={load} disabled={busy} aria-label="Refresh evaluation"><RefreshCw className={busy ? "spin" : ""} size={15} /></button><button className="icon-btn" onClick={onClose} aria-label="Close answer PDF"><X size={16} /></button></div>
    </div>
    {error && <div className="verification-alert">{error}</div>}
    <div className="answer-pdf-layout">
      <div className="cv-inline-frame-shell">{busy && !asset && <div className="cv-inline-status"><LoaderCircle className="spin" size={20} /> Loading submitted paper…</div>}{asset && <iframe className="cv-inline-frame" src={asset.url} title="Applicant submitted answer sheet" />}</div>
      <aside className="answer-evaluation-panel">
        <WrittenEvaluation assessment={assessment} allowRetry retrying={busy} onRetry={retryEvaluation} />
      </aside>
    </div>
  </section>;
}
