import {
  ArrowRight,
  Clock,
  FileCheck2,
  LogOut,
  ShieldCheck,
  ShieldQuestion,
  User,
} from "lucide-react";
import BrandLogo from "./BrandLogo.jsx";

export default function Dashboard({
  user,
  registration,
  verification,
  onStartVerification,
  onLogout,
}) {
  const status = verification?.status === "verified" ? "verified" : "not_verified";
  const statusConfig = {
    not_verified: {
      icon: ShieldQuestion,
      title: "Identity not verified",
      sub: verification?.reason || "Every document and biometric check must be accepted before you can continue.",
      cta: "Complete Verification",
      color: "var(--danger)",
    },
    verified: {
      icon: ShieldCheck,
      title: "Identity verified",
      sub: `All required identity gates passed · Verification ID ${verification?.id || "—"}`,
      cta: "View Verification Report",
      color: "var(--success)",
    },
  }[status];
  const StatusIcon = statusConfig.icon;

  return (
    <div className="dashboard-shell">
      <header className="dashboard-topbar">
        <div className="brand">
          <BrandLogo style={{ width: 38, height: 38 }} />
          <div className="brand-text">
            <div className="name" style={{ fontSize: 15 }}>Hire IQ</div>
          </div>
        </div>
        <div className="dashboard-user">
          <div className="dashboard-user-avatar"><User size={15} /></div>
          <span>{user?.fullName || "Account"}</span>
          <button className="btn-ghost" onClick={onLogout} title="Log out"><LogOut size={15} /></button>
        </div>
      </header>

      <main className="dashboard-main">
        <h1 className="dashboard-greeting">
          Welcome{user?.fullName ? `, ${user.fullName.split(" ")[0]}` : ""} 👋
        </h1>
        <p className="dashboard-sub">Here&apos;s where things stand with your account.</p>

        <div className="status-card" style={{ borderColor: statusConfig.color }}>
          <div className="status-icon" style={{ background: `${statusConfig.color}1a`, color: statusConfig.color }}>
            <StatusIcon size={26} />
          </div>
          <div className="status-body">
            <div className="status-title">{statusConfig.title}</div>
            <div className="status-sub">{statusConfig.sub}</div>
          </div>
          <button className="btn btn-primary status-cta" onClick={onStartVerification}>
            {statusConfig.cta} <ArrowRight size={15} />
          </button>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-tile">
            <div className="tile-icon"><FileCheck2 size={16} /></div>
            <div className="tile-label">Document type</div>
            <div className="tile-value">{registration?.verification?.document_type || "Not submitted"}</div>
          </div>
          <div className="dashboard-tile">
            <div className="tile-icon"><Clock size={16} /></div>
            <div className="tile-label">Account role</div>
            <div className="tile-value">{registration?.role === "company" ? "Company" : "Candidate"}</div>
          </div>
          <div className="dashboard-tile">
            <div className="tile-icon"><ShieldCheck size={16} /></div>
            <div className="tile-label">Verification status</div>
            <div className="tile-value" style={{ color: statusConfig.color, textTransform: "capitalize" }}>
              {status.replace("_", " ")}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
