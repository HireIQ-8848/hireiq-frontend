import { useEffect, useState } from "react";
import { CheckCircle2, Eye, RefreshCw, ShieldCheck, X } from "lucide-react";
import { adminApi, loadPrivateAsset } from "../../../../lib/api.js";

const APPROVAL_STEPS = [
  ["document", "Document Authenticity"],
  ["ocr", "Information Extraction"],
  ["liveness", "Liveness"],
  ["face_match", "Face Match"],
  ["age", "Age Check"],
];

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusTone(status) {
  if (status === "verified" || status === "passed") return "success";
  if (status === "failed" || status === "not_verified") return "danger";
  return "warn";
}

function displayScore(value) {
  return typeof value === "number" ? value.toFixed(4) : "—";
}

function PrivateAsset({ source, path, alt }) {
  const [asset, setAsset] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let loadedAsset = null;
    setAsset(null);
    setError("");
    if (!source) return () => {};
    loadPrivateAsset(source)
      .then((result) => {
        loadedAsset = result;
        if (active) setAsset(result);
        else if (result?.revoke) URL.revokeObjectURL(result.url);
      })
      .catch((reason) => {
        if (active) setError(reason.message || "Could not load this file");
      });
    return () => {
      active = false;
      if (loadedAsset?.revoke) URL.revokeObjectURL(loadedAsset.url);
    };
  }, [source]);

  if (!source) return <div className="verification-asset-empty">Not available</div>;
  if (error) return <div className="verification-asset-empty danger">{error}</div>;
  if (!asset) return <div className="verification-asset-empty">Loading private file…</div>;
  if (path?.toLowerCase().endsWith(".pdf")) {
    return <iframe className="verification-pdf" src={asset.url} title={alt} />;
  }
  return <img className="verification-image" src={asset.url} alt={alt} />;
}

function ResultCell({ label, value, passed }) {
  return (
    <div className="stat-cell">
      <div className="k">{label}</div>
      <div className="v" style={passed === true ? { color: "var(--success)" } : passed === false ? { color: "var(--danger)" } : undefined}>
        {value}
      </div>
    </div>
  );
}

function EventEvidence({ event }) {
  const evidence = event.evidence || {};
  const firstDocument = evidence.documents?.[0];
  const assets = [
    ["Submitted document", firstDocument?.url, firstDocument?.path],
    ["Document analysis heatmap", evidence.document_heatmap_url, evidence.document_heatmap_path],
    ["Liveness frame", evidence.liveness_frame_url, evidence.liveness_frame_path],
    ["Extracted document face", evidence.document_face_url, evidence.document_face_path],
    ["Extracted live face", evidence.live_face_url, evidence.live_face_path],
  ].filter(([, source]) => source);
  if (!assets.length) return null;
  return (
    <div className="verification-history-assets">
      {assets.map(([label, source, path]) => (
        <article className="verification-evidence-card" key={label}>
          <div className="verification-evidence-title">{label}</div>
          <PrivateAsset source={source} path={path} alt={`${label} for this attempt`} />
        </article>
      ))}
    </div>
  );
}

export default function VerificationsPage({ initialVerificationId = null }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [approvalSteps, setApprovalSteps] = useState(APPROVAL_STEPS.map(([value]) => value));
  const [approvalReason, setApprovalReason] = useState("Reviewed identity evidence");
  const [error, setError] = useState("");

  const loadItems = async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await adminApi.verifications());
    } catch (reason) {
      setError(reason.message || "Could not load verifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadItems(); }, []);

  useEffect(() => {
    if (initialVerificationId) void review(initialVerificationId);
  }, [initialVerificationId]);

  const review = async (verificationId) => {
    setDetailLoading(true);
    setError("");
    try {
      setSelected(await adminApi.verification(verificationId));
    } catch (reason) {
      setError(reason.message || "Could not load verification evidence");
    } finally {
      setDetailLoading(false);
    }
  };

  const approve = async () => {
    if (!selected || !approvalSteps.length) return;
    setApprovalBusy(true);
    setError("");
    try {
      await adminApi.approveVerification(selected.id, approvalSteps, approvalReason);
      await Promise.all([review(selected.id), loadItems()]);
    } catch (reason) {
      setError(reason.message || "Could not approve verification steps");
    } finally {
      setApprovalBusy(false);
    }
  };

  const documents = selected?.documents?.length
    ? selected.documents
    : selected?.document_url
      ? [{ side: "front", url: selected.document_url, path: selected.document_path }]
      : [];
  const gates = selected ? {
    document: selected.forgery?.passed,
    ocr: selected.ocr?.passed,
    liveness: selected.liveness?.passed,
    face_match: selected.face_match?.passed,
    age: selected.age?.passed,
  } : {};
  const ocrFields = selected?.ocr?.data?.fields || {};
  const fields = Object.keys(selected?.fields || {}).length ? selected.fields : ocrFields;
  const displayedName = fields.name_english?.value
    || fields.full_name?.value
    || [fields.first_name?.value, fields.last_name?.value].filter(Boolean).join(" ");
  const displayedAddress = fields.address_english?.value
    || fields.address_nepali?.value
    || fields.address?.value;

  return (
    <>
      <div className="verification-page-heading">
        <div>
          <h1 className="admin-page-title">Identity Verifications</h1>
          <p className="admin-page-sub">
            Open an applicant profile to review every document, liveness, face, age, and admin event.
          </p>
        </div>
        <button className="btn btn-secondary verification-refresh" onClick={loadItems}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {error && <div className="verification-alert">{error}</div>}

      <div className="admin-table-card">
        <table className="admin-full-table">
          <thead>
            <tr>
              <th>Applicant Profile</th>
              <th>Document</th>
              <th>Authenticity score</th>
              <th>Verification</th>
              <th>Submitted</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="6">Loading verifications…</td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan="6">No identity verifications are available.</td></tr>}
            {!loading && items.map((item) => (
              <tr key={item.id}>
                <td>
                  <button className="verification-profile-link" onClick={() => review(item.id)}>
                    {item.candidate?.full_name || item.profile_id}
                  </button>
                  <div className="verification-candidate-email">{item.candidate?.email || "No email"}</div>
                </td>
                <td>{item.document_type || "Identity document"}</td>
                <td>{displayScore(item.forgery?.score)}</td>
                <td>
                  <span className={`pill ${statusTone(item.verification_status)}`}>
                    {item.verification_status === "verified" ? "Verified" : "Not Verified"}
                  </span>
                </td>
                <td>{formatDate(item.created_at)}</td>
                <td>
                  <button className="btn btn-secondary verification-review-button" onClick={() => review(item.id)} disabled={detailLoading}>
                    <Eye size={14} /> Open Profile
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <section className="verification-review-panel" aria-label="Applicant verification profile">
          <div className="verification-review-header">
            <div>
              <h2>{selected.candidate?.full_name || "Applicant profile"}</h2>
              <p>{selected.candidate?.email} · {selected.document_type || "Identity document"}</p>
              <span className={`pill ${statusTone(selected.verification_status)}`}>
                {selected.verification_status === "verified" ? "Verified" : "Not Verified"}
              </span>
            </div>
            <button className="icon-btn" onClick={() => setSelected(null)} title="Close review"><X size={17} /></button>
          </div>

          <h3>Current document evidence</h3>
          <div className="verification-evidence-grid">
            {documents.map((document) => (
              <article className="verification-evidence-card" key={`${document.side}-${document.path}`}>
                <div className="verification-evidence-title">Original document · {document.side}</div>
                <PrivateAsset source={document.url} path={document.path} alt={`Original identity document ${document.side}`} />
              </article>
            ))}
            <article className="verification-evidence-card">
              <div className="verification-evidence-title">Document analysis heatmap</div>
              <PrivateAsset source={selected.forgery?.visualization_url} path={selected.forgery?.visualization_path} alt="Document analysis heatmap" />
            </article>
          </div>

          <h3>Current verification results</h3>
          <div className="stat-grid verification-results-grid">
            <ResultCell label="Document Authenticity" value={`${selected.forgery?.passed ? "Passed" : "Not passed"} · ${displayScore(selected.forgery?.score)}`} passed={selected.forgery?.passed} />
            <ResultCell label="Information Extraction" value={selected.ocr?.passed ? "Passed" : "Not passed"} passed={selected.ocr?.passed} />
            <ResultCell label="Liveness" value={`${selected.liveness?.passed ? "Passed" : "Not passed"} · ${displayScore(selected.liveness?.score)}`} passed={selected.liveness?.passed} />
            <ResultCell label="Face Match" value={`${selected.face_match?.passed ? "Passed" : "Not passed"} · ${displayScore(selected.face_match?.score)}`} passed={selected.face_match?.passed} />
            <ResultCell label="Age from DOB" value={selected.age?.chronological_age ?? "—"} passed={selected.age?.passed} />
            <ResultCell label="Estimated Age" value={selected.age?.estimated_age?.toFixed?.(1) ?? "—"} passed={selected.age?.passed} />
            <ResultCell label="Age Difference" value={`${selected.age?.difference ?? "—"} years · allowed ±10`} passed={selected.age?.passed} />
          </div>

          <div className="identity-field-summary">
            <div className="item">
              <div className="k">Document ID Type</div>
              <div className="v">{selected.document_type || "—"}</div>
            </div>
            <div className="item">
              <div className="k">ID Number</div>
              <div className="v">{fields.document_number?.value || "—"}</div>
            </div>
            <div className="item">
              <div className="k">Name (English)</div>
              <div className="v">{displayedName || "—"}</div>
            </div>
            <div className="item">
              <div className="k">Name (Nepali)</div>
              <div className="v">{fields.name_nepali?.value || "—"}</div>
            </div>
            <div className="item">
              <div className="k">Address (English or Nepali)</div>
              <div className="v">{displayedAddress || "—"}</div>
            </div>
            <div className="item">
              <div className="k">Date of Birth (AD)</div>
              <div className="v">{fields.date_of_birth?.value || "—"}</div>
            </div>
            <div className="item">
              <div className="k">Gender</div>
              <div className="v">{fields.gender?.value || "—"}</div>
            </div>
          </div>

          {selected.ocr?.data?.fields && (
            <>
              <h3>All extracted fields stored in the database</h3>
              <div className="info-grid verification-ocr-fields">
                {Object.entries(selected.ocr.data.fields).map(([name, field]) => (
                  <div className="item" key={name}>
                    <div className="k">{name.replaceAll("_", " ")}</div>
                    <div className="v">{field.value || "—"}</div>
                    {typeof field.confidence === "number" && (
                      <small>{(field.confidence * 100).toFixed(1)}% confidence</small>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="verification-approval-card">
            <div>
              <h3><ShieldCheck size={18} /> Manual approval</h3>
              <p>Approve any required gate after reviewing its evidence. Overall status stays Not Verified until every gate and required field is complete.</p>
            </div>
            <div className="verification-approval-steps">
              {APPROVAL_STEPS.map(([value, label]) => (
                <label key={value}>
                  <input
                    type="checkbox"
                    checked={approvalSteps.includes(value)}
                    onChange={(event) => setApprovalSteps((current) => event.target.checked
                      ? [...current, value]
                      : current.filter((step) => step !== value))}
                  />
                  {label} {gates[value] === true && <CheckCircle2 size={13} />}
                </label>
              ))}
            </div>
            <input value={approvalReason} onChange={(event) => setApprovalReason(event.target.value)} placeholder="Approval reason" />
            <button className="btn btn-primary" disabled={approvalBusy || !approvalSteps.length || approvalReason.trim().length < 2} onClick={approve}>
              {approvalBusy ? "Approving…" : "Approve Selected Steps"}
            </button>
          </div>

          <div className="verification-history-heading">
            <h3>Complete verification history</h3>
            <span>{selected.history?.length || 0} events</span>
          </div>
          <div className="verification-history-list">
            {(selected.history || []).map((event) => (
              <article className="verification-history-event" key={event.id}>
                <div className="verification-history-event-head">
                  <div>
                    <strong>{event.step.replaceAll("_", " ")}</strong>
                    <span className={`pill ${statusTone(event.status)}`}>{event.status}</span>
                  </div>
                  <time>{formatDate(event.created_at)}</time>
                </div>
                <div className="verification-history-summary">
                  {event.result?.reason && <p>{event.result.reason}</p>}
                  {typeof event.result?.forgery_score === "number" && <span>Authenticity {displayScore(event.result.forgery_score)}</span>}
                  {typeof event.result?.liveness_score === "number" && <span>Liveness {displayScore(event.result.liveness_score)}</span>}
                  {typeof event.result?.face_match_score === "number" && <span>Face {displayScore(event.result.face_match_score)}</span>}
                  {typeof event.result?.chronological_age === "number" && <span>DOB age {event.result.chronological_age}</span>}
                  {typeof event.result?.estimated_age === "number" && <span>Estimated age {event.result.estimated_age.toFixed(1)}</span>}
                  {typeof event.result?.age_difference === "number" && <span>Difference {event.result.age_difference.toFixed(1)} / ±{event.result.age_tolerance_years ?? 10}</span>}
                  {event.reviewed_by && <span>Approved by {event.reviewed_by}</span>}
                </div>
                {event.result?.ocr?.fields && (
                  <details className="verification-history-ocr">
                    <summary>All OCR fields for this document submission</summary>
                    <div className="info-grid verification-ocr-fields">
                      {Object.entries(event.result.ocr.fields).map(([name, field]) => (
                        <div className="item" key={name}>
                          <div className="k">{name.replaceAll("_", " ")}</div>
                          <div className="v">{field.value || "—"}</div>
                          {typeof field.confidence === "number" && (
                            <small>{(field.confidence * 100).toFixed(1)}% confidence</small>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                <EventEvidence event={event} />
              </article>
            ))}
            {!selected.history?.length && <div className="verification-asset-empty">No historical events were recorded for this legacy verification.</div>}
          </div>
        </section>
      )}
    </>
  );
}
