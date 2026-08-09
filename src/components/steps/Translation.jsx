import { Award, Globe2 } from "lucide-react";

export default function Translation({ data, onNext }) {
  const fields = data.extracted || {};
  const fullName = data.fullName || "—";

  return (
    <>
      <h1 className="step-title">Translation completed</h1>
      <p className="step-sub">Document has been translated successfully</p>

      <div className="card">
        <div className="translate-grid">
          <div className="translate-col">
            <div className="head">ORIGINAL</div>
            <div className="body">
              <div>
                <div className="k">Full Name</div>
                <div className="v">{fullName}</div>
              </div>
              <div>
                <div className="k">Date of Birth</div>
                <div className="v">{fields.dateOfBirth || "—"}</div>
              </div>
              <div>
                <div className="k">Nationality</div>
                <div className="v">{fields.nationality || "—"}</div>
              </div>
              <div>
                <div className="k">Address</div>
                <div className="v">{fields.address || "—"}</div>
              </div>
              <div>
                <div className="k">Gender</div>
                <div className="v">{fields.gender || "—"}</div>
              </div>
            </div>
          </div>
          <div className="translate-col target">
            <div className="head">TRANSLATED (ENGLISH)</div>
            <div className="body">
              <div>
                <div className="k">Full Name</div>
                <div className="v">{fullName}</div>
              </div>
              <div>
                <div className="k">Date of Birth</div>
                <div className="v">{fields.dateOfBirth || "—"}</div>
              </div>
              <div>
                <div className="k">Nationality</div>
                <div className="v">{fields.nationality || "—"}</div>
              </div>
              <div>
                <div className="k">Address</div>
                <div className="v">{fields.address || "—"}</div>
              </div>
              <div>
                <div className="k">Gender</div>
                <div className="v">{fields.gender || "—"}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="confidence-row" style={{ marginBottom: 20 }}>
          <div className="confidence-chip">
            <div className="icon">
              <Award size={14} />
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: "var(--muted-soft)" }}>Translation Confidence</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>96.80%</div>
            </div>
          </div>
          <div className="confidence-chip">
            <div className="icon">
              <Globe2 size={14} />
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: "var(--muted-soft)" }}>Language Detected</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{fields.nationality || "Nepalese"}</div>
            </div>
          </div>
        </div>

        <button className="btn btn-primary" onClick={onNext}>
          Continue
        </button>
      </div>
    </>
  );
}
