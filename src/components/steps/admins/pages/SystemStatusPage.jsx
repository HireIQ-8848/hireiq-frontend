import { useEffect, useState } from "react";
import { Activity, Database, HardDrive, LoaderCircle, RefreshCw } from "lucide-react";
import { adminApi } from "../../../../lib/api.js";

export default function SystemStatusPage() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setHealth(await adminApi.health());
    } catch (reason) {
      setError(reason.message || "Could not read backend status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return (
    <>
      <div className="verification-page-heading">
        <div><h1 className="admin-page-title">System Status</h1><p className="admin-page-sub">Live readiness of the database, private storage, and verification service.</p></div>
        <button className="btn btn-secondary verification-refresh" onClick={load}><RefreshCw size={15} /> Refresh</button>
      </div>
      {error && <div className="verification-alert">{error}</div>}
      {loading && <div className="admin-loading"><LoaderCircle className="spin" /> Reading backend state…</div>}
      {health && (
        <>
          <div className="admin-stat-row admin-stat-row-compact">
            <article className="admin-stat-card"><div className="admin-stat-top"><div><div className="admin-stat-label">Database</div><div className="admin-stat-value admin-status-value">{health.database}</div></div><div className="admin-stat-icon"><Database size={19} /></div></div></article>
            <article className="admin-stat-card"><div className="admin-stat-top"><div><div className="admin-stat-label">Private storage</div><div className="admin-stat-value admin-status-value">{health.storage}</div></div><div className="admin-stat-icon"><HardDrive size={19} /></div></div></article>
            <article className="admin-stat-card"><div className="admin-stat-top"><div><div className="admin-stat-label">Verification service</div><div className="admin-stat-value admin-status-value">{health.verification}</div></div><div className="admin-stat-icon"><Activity size={19} /></div></div></article>
          </div>

          <section className="chart-card" style={{ marginTop: 18 }}>
            <div className="chart-card-title"><Activity size={15} /> Verification pipeline</div>
            <p className="admin-page-sub" style={{ marginBottom: 0 }}>Document authenticity → information extraction → liveness check → identity comparison and age estimation. Individual results, evidence, failures, retries, and manual approvals are shown under Verification Evidence.</p>
          </section>
        </>
      )}
    </>
  );
}
