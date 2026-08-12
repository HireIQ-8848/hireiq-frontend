export const EVALUATION_IN_PROGRESS = new Set(["pending", "processing"]);
export const EVALUATION_TERMINAL = new Set(["completed", "failed", "configuration_required"]);


export function normalizedEvaluationStatus(status, workflowStatus = "") {
  const explicit = String(status || "").trim().toLowerCase();
  if (explicit) return explicit;
  const workflow = String(workflowStatus || "").trim().toLowerCase();
  if (workflow === "evaluated") return "completed";
  if (workflow === "evaluating") return "processing";
  if (workflow === "failed") return "failed";
  if (workflow === "configuration_required") return "configuration_required";
  return "pending";
}


export function normalizedCodingStatus(status) {
  if (["in_progress", "started"].includes(status)) return "active";
  if (["submitted", "evaluating", "evaluated", "failed", "configuration_required"].includes(status)) return "completed";
  if (status === "pending") return "not_started";
  return status;
}


export function normalizeWrittenEvaluation(payload) {
  if (!payload || typeof payload !== "object") return payload;
  const workflowStatus = payload.workflow_status || payload.status || "not_started";
  const evaluationStatus = normalizedEvaluationStatus(payload.evaluation_status, workflowStatus);
  const breakdown = (payload.question_breakdown || payload.breakdown || []).map((item, index) => {
    const feedback = item.feedback ?? item.evaluation?.feedback ?? "";
    const strengths = item.strengths ?? item.evaluation?.strengths ?? [];
    const improvements = item.improvements ?? item.evaluation?.improvements ?? [];
    return {
      ...item,
      question_number: item.question_number ?? index + 1,
      title: item.title || item.question || `Question ${index + 1}`,
      marks_awarded: item.marks_awarded ?? item.marks ?? null,
      max_marks: item.max_marks ?? item.maximum_marks ?? 5,
      feedback,
      strengths,
      improvements,
      evaluation: { feedback, strengths, improvements },
    };
  });
  const maximumMarks = payload.max_marks ?? payload.maximum_marks ?? null;
  const marksAwarded = payload.marks_awarded ?? payload.total_marks ?? null;
  const remainingSeconds = payload.remaining_seconds ?? (() => {
    const deadline = Date.parse(payload.deadline_at || "");
    return Number.isFinite(deadline) ? Math.max(0, Math.floor((deadline - Date.now()) / 1000)) : null;
  })();
  return {
    ...payload,
    workflow_status: workflowStatus,
    status: normalizedCodingStatus(workflowStatus),
    evaluation_status: evaluationStatus,
    marks_awarded: marksAwarded,
    max_marks: maximumMarks,
    maximum_marks: payload.maximum_marks ?? maximumMarks,
    score_percent: payload.score_percent ?? (maximumMarks > 0 && marksAwarded != null ? Math.round((marksAwarded / maximumMarks) * 10000) / 100 : null),
    remaining_seconds: remainingSeconds,
    question_breakdown: breakdown,
    breakdown,
    answer_pdf_ready: Boolean(payload.answer_pdf_ready && payload.answer_pdf_url),
    answer_pdf_url: payload.answer_pdf_url || null,
  };
}


export function shouldPollEvaluation(assessment) {
  return EVALUATION_IN_PROGRESS.has(normalizedEvaluationStatus(assessment?.evaluation_status, assessment?.workflow_status));
}


export function isEvaluationTerminal(assessment) {
  return EVALUATION_TERMINAL.has(normalizedEvaluationStatus(assessment?.evaluation_status, assessment?.workflow_status));
}


export function evaluationPresentation(assessment, authorized = false) {
  const status = normalizedEvaluationStatus(assessment?.evaluation_status, assessment?.workflow_status);
  if (status === "completed") {
    return {
      status,
      title: "Evaluation completed",
      message: assessment?.overall_feedback || "The written answers have been evaluated.",
      retryable: false,
    };
  }
  if (status === "failed") {
    return {
      status,
      title: "Evaluation failed",
      message: assessment?.evaluation_error || "The written answers could not be evaluated. Please try again.",
      retryable: authorized,
    };
  }
  if (status === "configuration_required") {
    return {
      status,
      title: "Evaluation unavailable",
      message: "Written-answer evaluation is not configured. Ask a HireIQ administrator to configure the evaluation service.",
      retryable: false,
    };
  }
  return {
    status,
    title: "Evaluation in progress",
    message: status === "pending" ? "Your written answers are waiting to be evaluated." : "Your written answers are being evaluated.",
    retryable: false,
  };
}


export function createSingleFlight(task) {
  let inFlight = null;
  return (...args) => {
    if (inFlight) return inFlight;
    const request = Promise.resolve().then(() => task(...args));
    inFlight = request;
    const clear = () => { if (inFlight === request) inFlight = null; };
    request.then(clear, clear);
    return request;
  };
}
