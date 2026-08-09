import { LayoutDashboard, ShieldAlert, ShieldCheck } from "lucide-react";

export default function FinalReport({ registration, onBackToDashboard }) {
  const gates = registration?.verification?.gates || {};
  const verified = registration?.verification_status === "verified"
    && registration?.status === "verified"
    && Object.values(gates).length === 5
    && Object.values(gates).every((value) => value === true)
    && (registration?.missing_fields || []).length === 0;
  const fields = registration?.fields || {};

  return (
    <>
      <h1 className="step-title">
        {verified ? "Verification completed successfully" : "Identity not verified"}
      </h1>
      <p className="step-sub">
        {verified
          ? "Your identity has been verified."
          : "You cannot complete verification while a required step is incomplete or rejected."}
      </p>

      <div className="card">
        <div className="info-grid" style={{ marginBottom: 20 }}>
          <div className="item">
            <div className="k">Document ID Type</div>
            <div className="v">{registration?.verification?.document_type || "—"}</div>
          </div>
          <div className="item">
            <div className="k">ID Number</div>
            <div className="v">{fields.document_number?.value || "—"}</div>
          </div>
          <div className="item">
            <div className="k">Name (English)</div>
            <div className="v">{fields.name_english?.value || `${fields.first_name?.value || ""} ${fields.last_name?.value || ""}`.trim() || "—"}</div>
          </div>
          <div className="item">
            <div className="k">Name (Nepali)</div>
            <div className="v">{fields.name_nepali?.value || "—"}</div>
          </div>
          <div className="item">
            <div className="k">Address (English or Nepali)</div>
            <div className="v">{fields.address_english?.value || fields.address_nepali?.value || fields.address?.value || "—"}</div>
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

        <div className="shield-wrap">
          <div className="shield-icon">
            {verified ? <ShieldCheck size={40} /> : <ShieldAlert size={40} />}
          </div>
          <div style={{ fontWeight: 700 }}>
            {verified ? "Verified" : "Not Verified"}
          </div>
        </div>

        <button className="btn btn-outline" style={{ marginTop: 20 }} onClick={onBackToDashboard}>
          <LayoutDashboard size={15} /> Back to Dashboard
        </button>
      </div>
    </>
  );
}
