import { PartyPopper, Lock } from "lucide-react";

export default function Welcome({ data, onNext }) {
  return (
    <>
      <h1 className="step-title">Welcome{data.fullName ? `, ${data.fullName.split(" ")[0]}` : ""}!</h1>
      <p className="step-sub">Your account has been created successfully</p>

      <div className="card center-col">
        <div className="confetti-wrap">
          <PartyPopper size={64} color="var(--primary)" />
        </div>

        <div className="secure-banner">
          <div className="icon">
            <Lock size={16} />
          </div>
          <div>
            <div className="title">Your account is secure</div>
            <div className="sub">We use bank-level security to protect your data</div>
          </div>
        </div>

        <button className="btn btn-primary" onClick={onNext}>
          Continue to Next Step
        </button>
      </div>
    </>
  );
}
