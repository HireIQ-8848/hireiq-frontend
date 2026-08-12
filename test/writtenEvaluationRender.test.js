import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import react from "@vitejs/plugin-react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "vite";


let buildDirectory;
let WrittenEvaluation;

before(async () => {
  buildDirectory = await mkdtemp(join(tmpdir(), "hireiq-evaluation-test-"));
  const outfile = join(buildDirectory, "WrittenEvaluation.mjs");
  const result = await build({
    configFile: false,
    logLevel: "silent",
    plugins: [react()],
    build: {
      ssr: "src/components/WrittenEvaluation.jsx",
      write: false,
      rollupOptions: { output: { format: "esm" } },
    },
    ssr: { noExternal: true },
  });
  const output = (Array.isArray(result) ? result[0].output : result.output).find((item) => item.type === "chunk");
  await writeFile(outfile, output.code);
  ({ default: WrittenEvaluation } = await import(pathToFileURL(outfile)));
});

after(async () => {
  await rm(buildDirectory, { force: true, recursive: true });
});


function render(assessment, allowRetry = true) {
  return renderToStaticMarkup(WrittenEvaluation({ assessment, allowRetry, retrying: false, onRetry: () => {} }));
}


test("processing renders progress without marks or retry", () => {
  const html = render({ evaluation_status: "processing" });
  assert.match(html, /data-evaluation-status="processing"/);
  assert.match(html, /being evaluated/i);
  assert.doesNotMatch(html, /Retry Evaluation/);
  assert.doesNotMatch(html, /marks<\/strong>/);
});


test("completed renders score, feedback, and normalized breakdown", () => {
  const html = render({
    evaluation_status: "completed",
    marks_awarded: 9,
    max_marks: 10,
    score_percent: 90,
    overall_feedback: "Well structured.",
    breakdown: [{
      question_id: "q1",
      question_number: 1,
      title: "System design",
      marks_awarded: 4.5,
      max_marks: 5,
      feedback: "Good explanation.",
      strengths: ["Clarity"],
      improvements: ["More examples"],
    }],
  });
  assert.match(html, /9 \/ 10 marks/);
  assert.match(html, /90%/);
  assert.match(html, /Well structured/);
  assert.match(html, /Q1\. System design/);
  assert.match(html, /4\.5 \/ 5/);
  assert.match(html, /Good explanation/);
  assert.match(html, /Strengths: Clarity/);
  assert.match(html, /Improve: More examples/);
});


test("failed renders the safe backend error and authorized retry", () => {
  const html = render({ evaluation_status: "failed", evaluation_error: "Evaluation timed out." });
  assert.match(html, /Evaluation timed out/);
  assert.match(html, /Retry Evaluation/);
  assert.doesNotMatch(html, /marks<\/strong>/);
});


test("configuration_required renders a safe message without retry", () => {
  const html = render({ evaluation_status: "configuration_required", evaluation_error: "private configuration detail" });
  assert.match(html, /Ask a HireIQ administrator/);
  assert.doesNotMatch(html, /private configuration detail/);
  assert.doesNotMatch(html, /Retry Evaluation/);
});
