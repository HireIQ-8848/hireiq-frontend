import { useEffect, useRef, useState } from "react";
import { ChevronLeft, LoaderCircle } from "lucide-react";
import BrandLogo from "./components/BrandLogo.jsx";
import AuthScreen from "./components/auth/AuthScreen.jsx";
import FaceLock from "./components/auth/FaceLock.jsx";
import RoleSelection from "./components/auth/RoleSelection.jsx";
import Dashboard from "./components/Dashboard.jsx";
import CandidatePortal from "./components/steps/candidates/CandidatePortal.jsx";
import CompanyPortal from "./components/steps/companies/CompanyPortal.jsx";
import AdminDashboard from "./components/steps/admins/AdminDashboard.jsx";
import Welcome from "./components/steps/Welcome.jsx";
import SelectDocument from "./components/steps/SelectDocument.jsx";
import UploadDocument from "./components/steps/UploadDocument.jsx";
import ExtractedInfo from "./components/steps/ExtractedInfo.jsx";
import LivenessVerification from "./components/steps/LivenessVerification.jsx";
import FaceMatch from "./components/steps/FaceMatch.jsx";
import FinalReport from "./components/steps/FinalReport.jsx";
import { authApi, registrationApi } from "./lib/api.js";
import { signOut, supabase, supabaseConfigError } from "./lib/supabase.js";

const STEPS = [
  { key: "welcome", label: "Welcome", Component: Welcome },
  { key: "document", label: "Select Document", Component: SelectDocument },
  { key: "upload", label: "Upload Document", Component: UploadDocument },
  { key: "extracted", label: "Extracted Information", Component: ExtractedInfo },
  { key: "liveness", label: "Liveness Verification", Component: LivenessVerification },
  { key: "facematch", label: "Verification Result", Component: FaceMatch },
  { key: "final", label: "Final Verification", Component: FinalReport },
];

function verificationFromRegistration(registration) {
  const gates = Object.values(registration?.verification?.gates || {});
  const verified = registration?.status === "verified"
    && registration?.verification_status === "verified"
    && gates.length === 5
    && gates.every((value) => value === true)
    && (registration?.missing_fields || []).length === 0;
  if (verified) {
    return {
      status: "verified",
      id: registration.attempt_id,
    };
  }
  return {
    status: "not_verified",
    reason: "Every required identity check must be completed and accepted.",
  };
}

function stepForRegistration(registration) {
  const stage = registration?.status;
  if (stage === "information_required") return 3;
  if (["liveness_required", "biometric_retry_required", "biometric_processing", "verification_failed"].includes(stage)) return 4;
  if (stage === "verified") return 6;
  if (["document_required", "document_failed", "document_processing"].includes(stage)) return 1;
  return 0;
}

function LoadingScreen() {
  return (
    <div className="auth-shell">
      <div className="auth-form-panel">
        <div className="auth-form-card" style={{ textAlign: "center" }}>
          <LoaderCircle className="spin" size={32} color="var(--primary)" />
          <h1 className="auth-title" style={{ marginTop: 18 }}>Restoring your session</h1>
          <p className="auth-sub">Checking Google authentication and registration status…</p>
        </div>
      </div>
    </div>
  );
}

function ConnectionErrorScreen({ error, onRetry, onLogout }) {
  return (
    <div className="auth-shell">
      <div className="auth-form-panel">
        <div className="auth-form-card">
          <div className="brand" style={{ marginBottom: 24 }}>
            <BrandLogo />
            <div className="brand-text"><div className="name">Hire IQ</div></div>
          </div>
          <h1 className="auth-title">Google sign-in completed</h1>
          <p className="auth-sub">
            Your Supabase session exists, but HireIQ could not finish loading your backend profile.
          </p>
          <p role="alert" style={{ color: "var(--danger)", margin: "18px 0" }}>
            {error || "The backend is unavailable."}
          </p>
          <button className="btn btn-primary" onClick={onRetry}>Retry backend connection</button>
          <button className="btn-ghost" onClick={onLogout} style={{ width: "100%", marginTop: 14 }}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [phase, setPhase] = useState("loading");
  const [stepIndex, setStepIndex] = useState(0);
  const [formData, setFormData] = useState({});
  const [registration, setRegistration] = useState(null);
  const [verification, setVerification] = useState({ status: "not_verified" });
  const [authError, setAuthError] = useState("");
  const [roleBusy, setRoleBusy] = useState(false);
  const [wizardBusy, setWizardBusy] = useState(false);
  const [wizardError, setWizardError] = useState("");
  const syncSequence = useRef(0);
  const afterFaceLockPhase = useRef("dashboard");

  const updateData = (patch) => setFormData((previous) => ({ ...previous, ...patch }));

  useEffect(() => {
    if (!supabase) {
      setAuthError(supabaseConfigError);
      setPhase("auth");
      return undefined;
    }
    let active = true;

    const clearAuthenticatedState = () => {
      setFormData({});
      setRegistration(null);
      setVerification({ status: "not_verified" });
      setStepIndex(0);
      setPhase("auth");
    };

    const synchronize = async (session) => {
      const sequence = ++syncSequence.current;
      if (!session) {
        if (active) clearAuthenticatedState();
        return;
      }
      setPhase("loading");
      setAuthError("");
      try {
        const [googleProfile, registrationStatus] = await Promise.all([
          authApi.me(),
          registrationApi.status(),
        ]);
        if (!active || sequence !== syncSequence.current) return;
        const role = registrationStatus.role === "admin"
          ? "admin"
          : registrationStatus.role === "company" ? "company" : "candidate";
        setFormData({
          id: googleProfile.user_id,
          email: googleProfile.email || "",
          firstName: googleProfile.first_name || "",
          lastName: googleProfile.last_name || "",
          fullName: googleProfile.full_name || "Google User",
          role,
          provider: "google",
        });
        setRegistration(registrationStatus);
        const registrationVerification = verificationFromRegistration(registrationStatus);
        setVerification(registrationVerification);
        const destination = (
          role === "admin"
            ? "admin"
            : registrationStatus.next_step === "select_role"
              ? "role"
              : registrationVerification.status === "verified"
                ? "portal"
                : "dashboard"
        );
        if (
          role !== "admin"
          && registrationVerification.status === "verified"
        ) {
          afterFaceLockPhase.current = destination;
          setPhase("face_lock");
        } else {
          setPhase(destination);
        }
      } catch (error) {
        if (!active || sequence !== syncSequence.current) return;
        setAuthError(error?.message || "Could not initialize your HireIQ account");
        setPhase("connection_error");
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") void synchronize(null);
      else if (event === "SIGNED_IN" || event === "INITIAL_SESSION") void synchronize(session);
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        if (active) {
          setAuthError(error.message);
          setPhase("auth");
        }
        return;
      }
      void synchronize(data.session);
    });
    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleRoleSelection = async (role) => {
    setRoleBusy(true);
    setAuthError("");
    try {
      const status = await registrationApi.selectRole(role);
      setRegistration(status);
      setVerification(verificationFromRegistration(status));
      updateData({ role: role === "company" ? "company" : "candidate" });
      setPhase("dashboard");
    } catch (error) {
      setAuthError(error?.message || "Role selection failed");
    } finally {
      setRoleBusy(false);
    }
  };

  const handleLogout = async () => {
    setAuthError("");
    try {
      await signOut();
    } catch (error) {
      setAuthError(error?.message || "Sign out failed");
    } finally {
      setPhase("auth");
      setFormData({});
      setRegistration(null);
      setStepIndex(0);
      setVerification({ status: "not_verified" });
    }
  };

  const handleFaceLock = async (frame) => {
    const result = await authApi.verifyFaceLock(frame);
    if (result?.verified) setPhase(afterFaceLockPhase.current);
    return result;
  };

  const refreshRegistration = async () => {
    const latest = await registrationApi.status();
    setRegistration(latest);
    setVerification(verificationFromRegistration(latest));
    return latest;
  };

  const handleStartVerification = async () => {
    setWizardError("");
    try {
      const latest = await refreshRegistration();
      if (verificationFromRegistration(latest).status === "verified") {
        setPhase("portal");
        return;
      }
      setStepIndex(stepForRegistration(latest));
      setPhase("wizard");
    } catch (error) {
      setAuthError(error?.message || "Could not load verification status");
    }
  };

  const handleBackToDashboard = async () => {
    let latest = registration;
    try {
      latest = await refreshRegistration();
    } catch {
      // Retain the last server-confirmed state during a temporary outage.
    }
    setPhase(verificationFromRegistration(latest).status === "verified" ? "portal" : "dashboard");
  };

  const submitDocument = async () => {
    setWizardBusy(true);
    setWizardError("");
    try {
      const result = await registrationApi.uploadDocument(
        formData.documentType,
        formData.frontFile,
        formData.backFile,
      );
      setRegistration(result);
      setVerification(verificationFromRegistration(result));
      updateData({ documentResult: result });
      if (result.forged || result.status === "document_failed") {
        updateData({ frontFile: null, backFile: null });
        setWizardError(result.reason || "This document was rejected. Upload a new copy to retry.");
      } else {
        setStepIndex(stepForRegistration(result));
      }
      return result;
    } catch (error) {
      // The server may have completed analysis even if the upload response
      // was interrupted. Recover the persisted result so the screen never
      // remains on an unexplained spinner or hides a completed failure.
      try {
        const latest = await refreshRegistration();
        updateData({ documentResult: latest });
        if (!["document_required", "document_failed", "document_processing"].includes(latest.status)) {
          setStepIndex(stepForRegistration(latest));
        }
      } catch {
        // Preserve the original upload error when status recovery also fails.
      }
      setWizardError(error?.message || "Document verification failed");
      throw error;
    } finally {
      setWizardBusy(false);
    }
  };

  const submitInformation = async (fields) => {
    setWizardBusy(true);
    setWizardError("");
    try {
      const result = await registrationApi.completeInformation(fields);
      setRegistration(result);
      setVerification(verificationFromRegistration(result));
      setStepIndex(stepForRegistration(result));
      return result;
    } catch (error) {
      setWizardError(error?.message || "Required information is incomplete");
      throw error;
    } finally {
      setWizardBusy(false);
    }
  };

  const submitLiveness = async (capture) => {
    setWizardBusy(true);
    setWizardError("");
    try {
      if (registration?.status === "verification_failed") {
        setRegistration(await registrationApi.retry());
      }
      const result = await registrationApi.activeLiveness(capture);
      setRegistration(result);
      setVerification(verificationFromRegistration(result));
      updateData({ biometricResult: result });
      if (result.verification_status === "verified") {
        setPhase("portal");
      } else if (result.status === "document_failed") {
        setStepIndex(1);
        setWizardError(
          result.reason
          || "This document is already registered to another account. Upload a different document.",
        );
      } else {
        setWizardError("Verification is incomplete. A fresh camera capture is required.");
      }
      return result;
    } catch (error) {
      setWizardError(error?.message || "Liveness verification failed");
      throw error;
    } finally {
      setWizardBusy(false);
    }
  };

  const retryFailedBiometrics = async (capture) => {
    setWizardBusy(true);
    setWizardError("");
    try {
      const result = await registrationApi.retryBiometrics(capture);
      setRegistration(result);
      setVerification(verificationFromRegistration(result));
      updateData({ biometricResult: result });
      if (result.verification_status === "verified") {
        setPhase("portal");
      } else {
        setWizardError("Verification is incomplete. Take another fresh camera capture.");
      }
      return result;
    } catch (error) {
      setWizardError(error?.message || "The remaining verification checks could not be completed");
      throw error;
    } finally {
      setWizardBusy(false);
    }
  };

  if (phase === "loading") return <LoadingScreen />;
  if (phase === "auth") return <AuthScreen error={authError} />;
  if (phase === "face_lock") {
    return <FaceLock onVerified={handleFaceLock} onLogout={handleLogout} />;
  }
  if (phase === "connection_error") {
    return <ConnectionErrorScreen error={authError} onRetry={() => window.location.reload()} onLogout={handleLogout} />;
  }
  if (phase === "role") {
    return <RoleSelection user={formData} busy={roleBusy} error={authError} onSelect={handleRoleSelection} onLogout={handleLogout} />;
  }
  if (phase === "admin") return <AdminDashboard admin={formData} onLogout={handleLogout} />;
  if (phase === "portal") {
    return formData.role === "company"
      ? <CompanyPortal user={formData} onLogout={handleLogout} />
      : <CandidatePortal user={formData} onLogout={handleLogout} onBackToStatus={handleBackToDashboard} />;
  }
  if (phase === "dashboard") {
    return (
      <Dashboard
        user={formData}
        registration={registration}
        verification={verification}
        onStartVerification={handleStartVerification}
        onLogout={handleLogout}
      />
    );
  }

  const { Component, key } = STEPS[stepIndex];
  const progressPct = ((stepIndex + 1) / STEPS.length) * 100;
  return (
    <div className="wizard-shell">
      <header className="wizard-topbar">
        <div className="wizard-topbar-inner">
          <div className="brand">
            <BrandLogo style={{ width: 34, height: 34 }} />
            <div className="brand-text"><div className="name" style={{ fontSize: 14 }}>Hire IQ</div></div>
          </div>
          <div className="wizard-topbar-progress">
            <span>Step {stepIndex + 1} of {STEPS.length} · {STEPS[stepIndex].label}</span>
            <div className="progress-bar-track"><div className="progress-bar-fill" style={{ width: `${progressPct}%` }} /></div>
          </div>
          <button className="btn-ghost" style={{ fontSize: 13 }} onClick={handleBackToDashboard}>Exit to Dashboard</button>
        </div>
      </header>
      <main className="main">
        <div className="step-panel">
          {stepIndex > 0 && stepIndex <= 2 && (
            <button
              onClick={() => setStepIndex((current) => Math.max(current - 1, 0))}
              className="btn-ghost"
              style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 10, padding: 0 }}
            >
              <ChevronLeft size={16} /> Back
            </button>
          )}
          {wizardError && <div className="verification-alert" role="alert">{wizardError}</div>}
          <Component
            data={formData}
            registration={registration}
            busy={wizardBusy}
            error={wizardError}
            onChange={updateData}
            onNext={() => setStepIndex((current) => Math.min(current + 1, STEPS.length - 1))}
            onSubmitDocument={submitDocument}
            onSubmitInformation={submitInformation}
            onVerifyLiveness={submitLiveness}
            onRetryBiometrics={retryFailedBiometrics}
            onBackToDashboard={handleBackToDashboard}
          />
          {key === "final" && registration?.verification_status !== "verified" && (
            <div className="verification-alert">Not verified: every check must pass before completion.</div>
          )}
        </div>
      </main>
    </div>
  );
}
