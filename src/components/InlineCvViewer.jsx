import { useEffect, useState } from "react";
import { FileText, LoaderCircle, X } from "lucide-react";
import { loadPrivateAsset } from "../lib/api.js";


export default function InlineCvViewer({ applicant, onClose }) {
  const [asset, setAsset] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let loadedAsset = null;
    setAsset(null);
    setError("");
    if (!applicant?.cv_url) return () => {};

    loadPrivateAsset(applicant.cv_url)
      .then((result) => {
        loadedAsset = result;
        if (active) setAsset(result);
        else if (result?.revoke) URL.revokeObjectURL(result.url);
      })
      .catch((reason) => {
        if (active) setError(reason.message || "Could not load this CV");
      });

    return () => {
      active = false;
      if (loadedAsset?.revoke) URL.revokeObjectURL(loadedAsset.url);
    };
  }, [applicant?.applicant_record_id, applicant?.application_id, applicant?.cv_url]);

  if (!applicant) return null;

  return (
    <section className="chart-card cv-inline-viewer" aria-live="polite">
      <div className="admin-section-heading">
        <div>
          <div className="chart-card-title"><FileText size={16} /> CV · {applicant.name || applicant.email || "Applicant"}</div>
          <p className="admin-page-sub">Securely loaded from this application record.</p>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close CV viewer"><X size={16} /></button>
      </div>
      <div className="cv-inline-frame-shell">
        {!asset && !error && <div className="cv-inline-status"><LoaderCircle className="spin" size={20} /> Loading CV…</div>}
        {error && <div className="cv-inline-status danger">{error}</div>}
        {asset && (asset.contentType || "").startsWith("image/") && <img className="cv-inline-image" src={asset.url} alt={`CV for ${applicant.name || "applicant"}`} />}
        {asset && !(asset.contentType || "").startsWith("image/") && <iframe className="cv-inline-frame" src={asset.url} title={`CV for ${applicant.name || "applicant"}`} />}
      </div>
    </section>
  );
}
