import { useState } from "react";
import { Globe2, ScanFace, ShieldCheck } from "lucide-react";
import BrandLogo from "../BrandLogo.jsx";
import {
  oauthCallbackError,
  signInWithGoogle,
  supabaseConfigError,
} from "../../lib/supabase.js";

const FEATURES = [
  { icon: ShieldCheck, text: "Private document verification and encrypted storage" },
  { icon: ScanFace, text: "Automatic liveness, age verification, and face matching" },
  { icon: Globe2, text: "Google-authenticated identity and role-protected access" },
];

export default function AuthScreen({ error: initialError = "" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    initialError || oauthCallbackError || supabaseConfigError,
  );

  const handleGoogle = async () => {
    setBusy(true);
    setError("");
    try {
      await signInWithGoogle();
    } catch (authError) {
      setError(authError?.message || "Google sign-in could not be started");
      setBusy(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-form-panel">
        <div className="auth-form-card">
          <div className="brand" style={{ marginBottom: 24 }}>
            <BrandLogo />
            <div className="brand-text"><div className="name">Hire IQ</div></div>
          </div>

          <h1 className="auth-title">Verify your identity securely</h1>
          <p className="auth-sub">
            Sign in with Google to begin or resume your HireIQ registration.
          </p>

          <div style={{ display: "grid", gap: 12, margin: "22px 0" }}>
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon size={17} color="var(--primary)" />
                <span style={{ fontSize: 13 }}>{text}</span>
              </div>
            ))}
          </div>

          {error && (
            <p role="alert" style={{ color: "var(--danger, #dc2626)", marginBottom: 14 }}>
              {error}
            </p>
          )}

          <button
            className="btn btn-outline"
            disabled={busy || Boolean(supabaseConfigError)}
            onClick={handleGoogle}
          >
            <span className="g-mark-sm">G</span>
            {busy ? "Redirecting to Google…" : "Continue with Google"}
          </button>

          <p className="foot-note" style={{ marginTop: 18 }}>
            HireIQ receives your verified name and email from Google through Supabase.
          </p>
        </div>
      </div>
    </div>
  );
}
