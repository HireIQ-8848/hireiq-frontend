import assert from "node:assert/strict";
import test from "node:test";
import { privateInterviewAssetRequest } from "../src/lib/privateInterviewAssets.js";
import {
  createSingleFlight,
  evaluationPresentation,
  isEvaluationTerminal,
  normalizeWrittenEvaluation,
  shouldPollEvaluation,
} from "../src/lib/writtenEvaluation.js";


test("pending and processing evaluations continue polling", () => {
  assert.equal(shouldPollEvaluation({ evaluation_status: "pending" }), true);
  assert.equal(shouldPollEvaluation({ evaluation_status: "processing" }), true);
  assert.equal(isEvaluationTerminal({ evaluation_status: "processing" }), false);
  assert.match(evaluationPresentation({ evaluation_status: "processing" }).message, /being evaluated/i);
});


test("completed evaluation normalizes marks, aliases, and question feedback", () => {
  const result = normalizeWrittenEvaluation({
    status: "completed",
    workflow_status: "evaluated",
    evaluation_status: "completed",
    marks_awarded: 8,
    maximum_marks: 10,
    overall_feedback: "Strong submission.",
    question_breakdown: [{
      question_id: "q1",
      question_number: 1,
      title: "Architecture",
      marks_awarded: 4,
      max_marks: 5,
      feedback: "Clear tradeoffs.",
      strengths: ["Specific"],
      improvements: ["Add metrics"],
    }],
    answer_pdf_ready: true,
    answer_pdf_url: "/interviews/i1/answer-pdf",
  });

  assert.equal(result.max_marks, 10);
  assert.equal(result.maximum_marks, 10);
  assert.equal(result.score_percent, 80);
  assert.equal(result.breakdown[0].feedback, "Clear tradeoffs.");
  assert.deepEqual(result.breakdown[0].strengths, ["Specific"]);
  assert.equal(result.answer_pdf_ready, true);
  assert.equal(shouldPollEvaluation(result), false);
  assert.equal(isEvaluationTerminal(result), true);
});


test("failed evaluation is terminal and retryable only for an authorized user", () => {
  const assessment = { evaluation_status: "failed", evaluation_error: "Provider timed out." };
  assert.equal(shouldPollEvaluation(assessment), false);
  assert.equal(evaluationPresentation(assessment, false).retryable, false);
  assert.equal(evaluationPresentation(assessment, true).retryable, true);
  assert.match(evaluationPresentation(assessment, true).message, /timed out/i);
});


test("configuration_required is terminal, safe, and never automatically retryable", () => {
  const presentation = evaluationPresentation({
    evaluation_status: "configuration_required",
    evaluation_error: "private provider configuration detail",
  }, true);
  assert.equal(shouldPollEvaluation({ evaluation_status: "configuration_required" }), false);
  assert.equal(presentation.retryable, false);
  assert.match(presentation.message, /administrator/i);
  assert.doesNotMatch(presentation.message, /private provider configuration detail/);
});


test("single-flight retry deduplicates concurrent clicks and permits a later retry", async () => {
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const retry = createSingleFlight(async () => {
    calls += 1;
    await gate;
    return calls;
  });

  const first = retry();
  const second = retry();
  assert.strictEqual(first, second);
  assert.equal(calls, 0);
  await Promise.resolve();
  assert.equal(calls, 1);
  release();
  await first;
  assert.equal(await retry(), 2);
});


test("private answer PDFs are fetched from the API with bearer authentication", () => {
  const request = privateInterviewAssetRequest(
    "/api/v1/interviews/i1/answer-pdf",
    "https://api.hireiqapp.me/api/v1",
    "https://hireiq-psi.vercel.app",
    "test-token",
  );
  assert.equal(request.url, "https://api.hireiqapp.me/api/v1/interviews/i1/answer-pdf");
  assert.equal(request.headers.Authorization, "Bearer test-token");
  assert.equal(request.headers.Accept, "application/pdf");
});


test("cross-origin answer PDF URLs cannot bypass authenticated API loading", () => {
  assert.throws(() => privateInterviewAssetRequest(
    "https://public-storage.example/answers.pdf",
    "https://api.hireiqapp.me/api/v1",
    "https://hireiq-psi.vercel.app",
    "test-token",
  ), /authenticated HireIQ API/);
});
