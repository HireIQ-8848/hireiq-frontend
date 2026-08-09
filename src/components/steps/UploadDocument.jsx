import { useEffect, useRef, useState } from "react";
import { Check, CheckCircle2, LoaderCircle, XCircle } from "lucide-react";

function Slot({ label, file, onPick }) {
  const inputRef = useRef(null);
  const url = file ? URL.createObjectURL(file) : null;

  return (
    <div className="upload-slot">
      <div className="slot-label">{label}</div>
      <div className="upload-preview" onClick={() => inputRef.current?.click()}>
        {url ? (
          <>
            <img src={url} alt={label} />
            <div className="check-flag">
              <Check size={14} />
            </div>
          </>
        ) : (
          <span>Click to upload {label.toLowerCase()}</span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => onPick(e.target.files?.[0] || null)}
      />
    </div>
  );
}

export default function UploadDocument({
  data,
  onChange,
  onSubmitDocument,
  registration,
  busy,
}) {
  const front = data.frontFile;
  const back = data.backFile;
  const canContinue = Boolean(front) && Boolean(data.documentType);
  const isCitizenship = data.documentType === "citizenship";
  const rejected = registration?.status === "document_failed";
  const result = data.documentResult;
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!busy) {
      setElapsedSeconds(0);
      return undefined;
    }
    const started = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [busy]);

  const forgeryPassed = result?.forged === false
    || result?.verification?.gates?.document === true;
  const forgeryFailed = result?.forged === true
    || result?.verification?.gates?.document === false;
  const ocrRan = result?.ocr_ran === true
    || (
      result?.verification?.gates?.ocr !== null
      && result?.verification?.gates?.ocr !== undefined
    );
  const ocrPassed = result?.verification?.gates?.ocr === true;
  const extractedCount = Object.values(result?.fields || {})
    .filter((field) => field?.value).length;

  return (
    <>
      <h1 className="step-title">Upload your document</h1>
      <p className="step-sub">
        Take or upload a clear {data.documentType?.replaceAll("_", " ") || "identity document"} image.
        The back side is optional when the document has only one identity page.
      </p>

      <div className="card">
        <div className="upload-grid">
          <Slot label="Front Side" file={front} onPick={(f) => onChange({ frontFile: f })} />
          <Slot label="Back Side (Optional)" file={back} onPick={(f) => onChange({ backFile: f })} />
        </div>

        <div className="hint-text">Keep every corner and printed field visible. Avoid glare and blur. Supported formats: JPG, PNG, PDF (Max. 10MB).</div>

        {busy && (
          <div className="document-processing-status" role="status" aria-live="polite">
            <LoaderCircle className="spin" size={22} />
            <div>
              <strong>Processing document…</strong>
              <p>
                {isCitizenship
                  ? "Checking authenticity, then reading the Nepali citizenship fields. This can take up to a minute."
                  : "Checking authenticity and extracting document information. This can take up to a minute."}
              </p>
              <small>{elapsedSeconds} seconds elapsed</small>
            </div>
          </div>
        )}

        {!busy && result && (forgeryPassed || forgeryFailed) && (
          <div className="document-result-panel" aria-live="polite">
            <div className="document-result-row">
              {forgeryPassed
                ? <CheckCircle2 size={20} color="var(--success)" />
                : <XCircle size={20} color="var(--danger)" />}
              <div>
                <strong>Document authenticity</strong>
                <p>{forgeryPassed ? "Genuine — authenticity check passed" : "Not accepted — possible manipulation detected"}</p>
              </div>
            </div>
            <div className="document-result-row">
              {ocrPassed
                ? <CheckCircle2 size={20} color="var(--success)" />
                : <XCircle size={20} color={ocrRan ? "var(--danger)" : "var(--muted)"} />}
              <div>
                <strong>Document information</strong>
                <p>
                  {ocrPassed
                    ? `Extraction completed${extractedCount ? ` · ${extractedCount} fields found` : ""}`
                    : ocrRan
                      ? result.reason || "Some required information could not be verified"
                      : "Not processed because authenticity did not pass"}
                </p>
              </div>
            </div>
          </div>
        )}

        {rejected && !busy && (
          <div className="field-warning" role="alert" style={{ marginBottom: 14 }}>
            {registration.reason || "The document did not pass verification."}
            Take or select a new image before trying again.
          </div>
        )}

        <button
          className="btn btn-primary"
          disabled={!canContinue || busy}
          onClick={async () => {
            try {
              await onSubmitDocument?.();
            } catch {
              // The wizard keeps this step open and displays the API error.
            }
          }}
        >
          {busy ? "Processing document…" : rejected ? "Retry Document Verification" : "Verify Document"}
        </button>
      </div>
    </>
  );
}
