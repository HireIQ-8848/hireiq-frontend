import { useEffect, useState } from "react";
import { FileText, LoaderCircle, RefreshCw, Trash2, Upload } from "lucide-react";
import { cvApi, registrationApi } from "../../../../lib/api.js";

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function fieldValue(fields, ...names) {
  for (const name of names) if (fields?.[name]?.value) return fields[name].value;
  return "—";
}

export default function ProfilePage({ user }) {
  const [registration, setRegistration] = useState(null);
  const [cv, setCv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    const [registrationResult, cvResult] = await Promise.allSettled([registrationApi.status(), cvApi.get()]);
    if (registrationResult.status === "fulfilled") setRegistration(registrationResult.value);
    else setError(registrationResult.reason?.message || "Could not load profile data");
    setCv(cvResult.status === "fulfilled" ? cvResult.value : null);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setError(""); setMessage("");
    try {
      setCv(await cvApi.upload(file, Boolean(cv)));
      setMessage("CV uploaded, parsed, and stored successfully.");
    } catch (reason) { setError(reason.message || "Could not upload CV"); }
    finally { setBusy(false); event.target.value = ""; }
  };

  const remove = async () => {
    setBusy(true); setError("");
    try { await cvApi.remove(); setCv(null); setMessage("CV removed."); }
    catch (reason) { setError(reason.message || "Could not remove CV"); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="admin-loading"><LoaderCircle className="spin" /> Loading stored profile and CV…</div>;
  const fields = registration?.fields || {};
  const parsed = cv?.parsed_data || {};

  return (
    <>
      <div className="verification-page-heading"><div><h1 className="admin-page-title">Profile and CV</h1><p className="admin-page-sub">Identity values come from your locked registration fields; CV values come from the parsed document stored by HireIQ.</p></div><button className="btn btn-secondary verification-refresh" onClick={load}><RefreshCw size={15} /> Refresh</button></div>
      {error && <div className="verification-alert">{error}</div>}{message && <div className="portal-success">{message}</div>}
      <div className="admin-grid-3">
        <section className="chart-card">
          <div className="chart-card-title">Account</div>
          <div className="identity-field-summary portal-single-column">
            <div className="item"><div className="k">Google account</div><div className="v">{user?.email}</div></div>
            <div className="item"><div className="k">Verification status</div><div className="v">{registration?.verification_status === "verified" ? "Verified" : "Not Verified"}</div></div>
            <div className="item"><div className="k">Registration stage</div><div className="v">{registration?.status?.replaceAll("_", " ")}</div></div>
          </div>
        </section>
        <section className="chart-card" style={{ gridColumn: "span 2" }}>
          <div className="chart-card-title">Stored identity information</div>
          <div className="identity-field-summary">
            <div className="item"><div className="k">Name (English)</div><div className="v">{fieldValue(fields, "name_english", "full_name")}</div></div>
            <div className="item"><div className="k">Name (Nepali)</div><div className="v">{fieldValue(fields, "name_nepali")}</div></div>
            <div className="item"><div className="k">Address</div><div className="v">{fieldValue(fields, "address_english", "address_nepali", "address")}</div></div>
            <div className="item"><div className="k">Date of birth (AD)</div><div className="v">{fieldValue(fields, "date_of_birth")}</div></div>
            <div className="item"><div className="k">Gender</div><div className="v">{fieldValue(fields, "gender")}</div></div>
            <div className="item"><div className="k">Document number</div><div className="v">{fieldValue(fields, "document_number")}</div></div>
          </div>
        </section>
      </div>

      <section className="chart-card">
        <div className="admin-section-heading"><div className="chart-card-title">Active CV stored in HireIQ</div><label className={`btn btn-primary admin-inline-button ${busy ? "disabled" : ""}`} style={{ marginTop: 0 }}><Upload size={15} /> {cv ? "Replace CV" : "Upload CV"}<input hidden type="file" accept="application/pdf" disabled={busy} onChange={upload} /></label></div>
        {cv ? <><div className="info-grid"><div className="item"><div className="k">Stored filename</div><div className="v">{cv.filename || "CV.pdf"}</div></div><div className="item"><div className="k">Parsed profile ID</div><div className="v">{parsed.profile_id || "—"}</div></div><div className="item"><div className="k">Last updated</div><div className="v">{formatDate(cv.updated_at)}</div></div></div><details className="verification-history-ocr"><summary>View all parsed CV information stored in the database</summary><pre className="portal-json-view">{JSON.stringify(parsed, null, 2)}</pre></details><button className="btn admin-danger-button admin-inline-button" disabled={busy} onClick={remove}><Trash2 size={15} /> Remove CV</button></> : <div className="verification-asset-empty"><FileText size={28} /><span>No active CV is stored. Upload a PDF before applying to jobs.</span></div>}
      </section>
    </>
  );
}
