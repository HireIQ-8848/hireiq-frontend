import { ShieldCheck, ShieldX } from "lucide-react";

export default function FaceMatch({ data, registration, onNext }) {
  const result = data.biometricResult || {};
  const verified = registration?.verification_status === "verified"
    && result.face_match_passed === true
    && result.age_passed === true
    && result.liveness_passed === true;

  return (
    <>
      <h1 className="step-title">
        {verified ? "Identity verified" : "Identity not verified"}
      </h1>
      <p className="step-sub">
        {verified
          ? "Your identity verification is complete."
          : "Verification must be completed before you can continue."}
      </p>

      <div className="card">
        <div className="shield-wrap">
          <div className="shield-icon">
            {verified ? <ShieldCheck size={40} /> : <ShieldX size={40} />}
          </div>
          <div style={{ fontWeight: 700 }}>
            {verified ? "Verified" : "Not Verified"}
          </div>
        </div>

        {verified && (
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={onNext}>
            Continue
          </button>
        )}
      </div>
    </>
  );
}
