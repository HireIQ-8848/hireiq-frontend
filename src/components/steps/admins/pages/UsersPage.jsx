import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Eye, LoaderCircle, RefreshCw, ShieldCheck, Trash2, X } from "lucide-react";
import { adminApi, interviewApi } from "../../../../lib/api.js";

const FILTERS = ["all", "applicant", "company", "verified", "not_verified"];

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function label(value) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function UsersPage({ onOpenVerification }) {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await adminApi.users());
    } catch (reason) {
      setError(reason.message || "Could not load registered users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => items.filter((item) => {
    if (filter === "all") return true;
    if (filter === "applicant") return item.role === "user";
    if (filter === "company") return item.role === "company";
    return item.verification_status === filter;
  }), [filter, items]);

  const inspect = async (profileId) => {
    setDetailLoading(true);
    setError("");
    try {
      setSelected(await adminApi.user(profileId));
    } catch (reason) {
      setError(reason.message || "Could not load this registration");
    } finally {
      setDetailLoading(false);
    }
  };

  const openDeleteConfirmation = () => {
    setDeleteTarget(selected);
    setDeleteConfirmation("");
    setDeleteReason("");
    setError("");
  };

  const closeDeleteConfirmation = () => {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteConfirmation("");
    setDeleteReason("");
  };

  const deletePermanently = async () => {
    if (!deleteTarget) return;
    const payload = {
      confirmation_email: deleteConfirmation.trim(),
      reason: deleteReason.trim(),
    };
    setDeleting(true);
    setError("");
    setSuccess("");
    try {
      const interviewResult = await interviewApi.deleteUserRecords(deleteTarget.id, payload);
      const result = await adminApi.deleteUser(deleteTarget.id, payload);
      const databaseTotal = Object.values(result.database_records || {})
        .reduce((total, value) => total + Number(value || 0), 0)
        + Object.values(interviewResult.database_records || {})
          .reduce((total, value) => total + Number(value || 0), 0);
      const storageTotal = Object.values(result.storage_objects || {})
        .reduce((total, value) => total + Number(value || 0), 0)
        + Number(interviewResult.storage_objects || 0);
      setDeleteTarget(null);
      setSelected(null);
      setDeleteConfirmation("");
      setDeleteReason("");
      await load();
      setSuccess(`User permanently deleted: ${databaseTotal} database records and ${storageTotal} private files removed.`);
    } catch (reason) {
      setError(reason.message || "Could not permanently delete every user record");
    } finally {
      setDeleting(false);
    }
  };

  const fields = selected?.verification?.fields || {};
  const verification = selected?.verification;

  return (
    <>
      <div className="verification-page-heading">
        <div>
          <h1 className="admin-page-title">User Registrations</h1>
          <p className="admin-page-sub">Real candidate and company accounts stored by HireIQ. Click a profile to inspect its registration.</p>
        </div>
        <button className="btn btn-secondary verification-refresh" onClick={load}><RefreshCw size={15} /> Refresh</button>
      </div>

      {error && <div className="verification-alert">{error}</div>}
      {success && <div className="verification-alert success">{success}</div>}
      <div className="admin-tabs">
        {FILTERS.map((value) => (
          <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>
            {label(value)} ({items.filter((item) => {
              if (value === "all") return true;
              if (value === "applicant") return item.role === "user";
              if (value === "company") return item.role === "company";
              return item.verification_status === value;
            }).length})
          </button>
        ))}
      </div>

      <div className="admin-table-card">
        <table className="admin-full-table">
          <thead><tr><th>Registered user</th><th>Account type</th><th>Account status</th><th>Identity status</th><th>Registered</th><th>Details</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan="6"><LoaderCircle className="spin" size={17} /> Loading registrations…</td></tr>}
            {!loading && filtered.map((item) => (
              <tr key={item.id}>
                <td><button className="verification-profile-link" onClick={() => inspect(item.id)}>{item.full_name || item.email}</button><div className="verification-candidate-email">{item.email}</div></td>
                <td>{item.role === "user" ? "Applicant" : label(item.role)}</td>
                <td><span className={`pill ${item.status === "active" ? "success" : "danger"}`}>{item.status}</span></td>
                <td><span className={`pill ${item.verification_status === "verified" ? "success" : "danger"}`}>{item.verification_status === "verified" ? "Verified" : "Not Verified"}</span></td>
                <td>{formatDate(item.created_at)}</td>
                <td><button className="btn btn-secondary verification-review-button" disabled={detailLoading} onClick={() => inspect(item.id)}><Eye size={14} /> Open profile</button></td>
              </tr>
            ))}
            {!loading && !filtered.length && <tr><td colSpan="6">No registrations match this filter.</td></tr>}
          </tbody>
        </table>
      </div>

      {selected && (
        <section className="verification-review-panel">
          <div className="verification-review-header">
            <div><h2>{selected.full_name || selected.email}</h2><p>{selected.email} · {selected.role === "user" ? "Applicant" : label(selected.role)}</p></div>
            <button className="icon-btn" onClick={() => setSelected(null)} title="Close"><X size={17} /></button>
          </div>

          <div className="identity-field-summary admin-profile-summary">
            <div className="item"><div className="k">Account status</div><div className="v">{label(selected.status)}</div></div>
            <div className="item"><div className="k">Verification</div><div className="v">{selected.verification_status === "verified" ? "Verified" : "Not Verified"}</div></div>
            <div className="item"><div className="k">Registration date</div><div className="v">{formatDate(selected.created_at)}</div></div>
            <div className="item"><div className="k">Document type</div><div className="v">{verification?.document_type || "Not submitted"}</div></div>
            <div className="item"><div className="k">Document number</div><div className="v">{fields.document_number?.value || "—"}</div></div>
            <div className="item"><div className="k">Current stage</div><div className="v">{label(verification?.current_stage || "not started")}</div></div>
          </div>

          {verification ? (
            <>
              <h3>Stored identity and verification results</h3>
              <div className="stat-grid verification-results-grid">
                <div className="stat-cell"><div className="k">Document authenticity</div><div className="v">{verification.forgery?.passed ? "Passed" : "Not passed"} · {verification.forgery?.score ?? "—"}</div></div>
                <div className="stat-cell"><div className="k">Information extraction</div><div className="v">{verification.ocr?.passed ? "Passed" : "Not passed"}</div></div>
                <div className="stat-cell"><div className="k">Liveness</div><div className="v">{verification.liveness?.passed ? "Passed" : "Not passed"} · {verification.liveness?.score ?? "—"}</div></div>
                <div className="stat-cell"><div className="k">Face match</div><div className="v">{verification.face_match?.passed ? "Passed" : "Not passed"} · {verification.face_match?.score ?? "—"}</div></div>
                <div className="stat-cell"><div className="k">DOB age</div><div className="v">{verification.age?.chronological_age ?? "—"}</div></div>
                <div className="stat-cell"><div className="k">Estimated age</div><div className="v">{verification.age?.estimated_age ?? "—"} · difference {verification.age?.difference ?? "—"} / ±10</div></div>
              </div>
              <button className="btn btn-primary admin-inline-button" onClick={() => onOpenVerification(verification.id)}><ShieldCheck size={15} /> Open documents, heatmap, faces and complete history</button>
            </>
          ) : <div className="verification-asset-empty">This account has not submitted an identity document.</div>}

          {!!selected.verification_history?.length && (
            <>
              <div className="verification-history-heading"><h3>Registration history</h3><span>{selected.verification_history.length} events</span></div>
              <div className="verification-history-list">
                {selected.verification_history.slice(0, 12).map((event) => (
                  <article className="verification-history-event" key={event.id}>
                    <div className="verification-history-event-head"><div><strong>{label(event.step)}</strong><span className={`pill ${event.status === "passed" ? "success" : event.status === "failed" ? "danger" : "warn"}`}>{event.status}</span></div><time>{formatDate(event.created_at)}</time></div>
                  </article>
                ))}
              </div>
            </>
          )}

          {selected.role !== "admin" && (
            <div className="admin-danger-zone">
              <div>
                <h3><AlertTriangle size={16} /> Permanently delete this user</h3>
                <p>Removes the account, registrations, verification history, documents, accepted face evidence, CVs, applications, company data, interviews, reports, calendar entries, and private storage files.</p>
              </div>
              <button className="btn admin-delete-button" onClick={openDeleteConfirmation}>
                <Trash2 size={15} /> Delete all records
              </button>
            </div>
          )}
        </section>
      )}

      {deleteTarget && (
        <div className="modal-overlay admin-delete-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeDeleteConfirmation();
        }}>
          <section className="admin-delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-user-title">
            <div className="admin-delete-modal-heading">
              <div className="admin-delete-icon"><AlertTriangle size={20} /></div>
              <div>
                <h2 id="delete-user-title">Delete all user records?</h2>
                <p>This cannot be undone. HireIQ will permanently remove this user from both services, all private storage, and authentication.</p>
              </div>
              <button className="icon-btn" onClick={closeDeleteConfirmation} disabled={deleting} title="Close"><X size={17} /></button>
            </div>
            <div className="admin-delete-target">
              <strong>{deleteTarget.full_name || deleteTarget.email}</strong>
              <span>{deleteTarget.email}</span>
            </div>
            <label className="admin-delete-field">
              <span>Reason for deletion</span>
              <textarea value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} maxLength="1000" placeholder="Required for the administrator audit log" />
            </label>
            <label className="admin-delete-field">
              <span>Type <strong>{deleteTarget.email}</strong> to confirm</span>
              <input type="email" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" spellCheck="false" />
            </label>
            <div className="admin-delete-actions">
              <button className="btn btn-secondary" onClick={closeDeleteConfirmation} disabled={deleting}>Cancel</button>
              <button
                className="btn admin-delete-button"
                onClick={deletePermanently}
                disabled={deleting || deleteConfirmation.trim().toLowerCase() !== deleteTarget.email.toLowerCase() || deleteReason.trim().length < 3}
              >
                {deleting ? <LoaderCircle className="spin" size={15} /> : <Trash2 size={15} />}
                {deleting ? "Deleting every record…" : "Permanently delete"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
