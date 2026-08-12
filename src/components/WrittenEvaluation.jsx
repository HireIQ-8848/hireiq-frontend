import { LoaderCircle } from "lucide-react";
import { evaluationPresentation } from "../lib/writtenEvaluation.js";


function marks(value) {
  return value == null ? "—" : value;
}


export default function WrittenEvaluation({ assessment, allowRetry = false, retrying = false, onRetry }) {
  const presentation = evaluationPresentation(assessment, allowRetry);
  const completed = presentation.status === "completed";
  const breakdown = completed ? assessment?.breakdown || [] : [];

  return <div className={`written-evaluation written-evaluation-${presentation.status}`} aria-live="polite" data-evaluation-status={presentation.status}>
    <div className="answer-score-total">
      <span>AI evaluation</span>
      {completed
        ? <><strong>{marks(assessment?.marks_awarded)} / {marks(assessment?.max_marks)} marks</strong>{assessment?.score_percent != null && <small>{assessment.score_percent}%</small>}</>
        : <strong>{presentation.title}</strong>}
      {presentation.status === "processing" && <LoaderCircle className="spin" size={17} aria-hidden="true" />}
      <p>{presentation.message}</p>
      {presentation.retryable && <button className="btn btn-outline admin-inline-button" disabled={retrying} onClick={onRetry}>{retrying ? "Retrying…" : "Retry Evaluation"}</button>}
    </div>
    {breakdown.map((item) => <article className="written-evaluation-question" key={item.question_id}>
      <div><strong>Q{item.question_number}. {item.title}</strong><span>{marks(item.marks_awarded)} / {marks(item.max_marks)}</span></div>
      <p>{item.feedback || "No feedback was provided."}</p>
      {item.strengths?.length > 0 && <small>Strengths: {item.strengths.join(" · ")}</small>}
      {item.improvements?.length > 0 && <small>Improve: {item.improvements.join(" · ")}</small>}
    </article>)}
  </div>;
}
