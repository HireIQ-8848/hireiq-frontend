import { useEffect, useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { adminApi } from "../../../../lib/api.js";

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function AuditLogPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try { setItems(await adminApi.logs()); }
    catch (reason) { setError(reason.message || "Could not load the audit log"); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  return (
    <>
      <div className="verification-page-heading">
        <div><h1 className="admin-page-title">Administration Audit Log</h1><p className="admin-page-sub">Immutable history of manual verification approvals and moderation actions.</p></div>
        <button className="btn btn-secondary verification-refresh" onClick={load}><RefreshCw size={15} /> Refresh</button>
      </div>
      {error && <div className="verification-alert">{error}</div>}
      <div className="admin-table-card">
        <table className="admin-full-table">
          <thead><tr><th>Date</th><th>Administrator</th><th>Action</th><th>Target</th><th>Reason</th><th>Recorded details</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan="6"><LoaderCircle className="spin" size={17} /> Loading audit records…</td></tr>}
            {!loading && items.map((item) => <tr key={item.id}><td>{formatDate(item.created_at)}</td><td className="admin-code-cell">{item.admin_id}</td><td>{item.action.replaceAll("_", " ")}</td><td>{item.target_type} · {item.target_id}</td><td className="admin-wrapped-cell">{item.reason}</td><td className="admin-wrapped-cell admin-code-cell">{Object.keys(item.metadata || {}).length ? JSON.stringify(item.metadata) : "—"}</td></tr>)}
            {!loading && !items.length && <tr><td colSpan="6">No administration actions have been recorded.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
