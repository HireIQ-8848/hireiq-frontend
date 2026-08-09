import { Building2, UserRound } from "lucide-react";

export default function RoleSelection({ user, busy, error, onSelect, onLogout }) {
  return (
    <div className="auth-shell">
      <div className="auth-form-panel">
        <div className="auth-form-card">
          <h1 className="auth-title">Welcome, {user?.firstName || "there"}</h1>
          <p className="auth-sub">
            Choose how you will use HireIQ. This selection is saved by the backend and
            cannot be changed during registration.
          </p>

          {error && (
            <p role="alert" style={{ color: "var(--danger, #dc2626)", marginBottom: 16 }}>
              {error}
            </p>
          )}

          <div style={{ display: "grid", gap: 12 }}>
            <button className="btn btn-outline" disabled={busy} onClick={() => onSelect("user")}>
              <UserRound size={18} /> Continue as Candidate
            </button>
            <button className="btn btn-outline" disabled={busy} onClick={() => onSelect("company")}>
              <Building2 size={18} /> Continue as Company
            </button>
          </div>

          <button
            className="btn-ghost"
            disabled={busy}
            onClick={onLogout}
            style={{ marginTop: 20, width: "100%" }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
