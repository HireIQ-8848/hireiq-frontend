import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Camera, LogOut } from "lucide-react";
import BrandLogo from "../BrandLogo.jsx";

const CAPTURE_MS = 3000;

export default function FaceLock({ onVerified, onLogout }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const animationRef = useRef(null);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState("preparing");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const stopCamera = useCallback(() => {
    window.clearTimeout(timerRef.current);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const capture = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      throw new Error("Camera frame is unavailable");
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob
          ? resolve(new File([blob], `login-face-${Date.now()}.jpg`, { type: "image/jpeg" }))
          : reject(new Error("Camera frame could not be captured")),
        "image/jpeg",
        0.9,
      );
    });
  }, []);

  const begin = useCallback(() => {
    if (!streamRef.current || status === "capturing" || status === "processing") return;
    setError("");
    setProgress(0);
    setStatus("capturing");
    const startedAt = performance.now();
    const animate = (now) => {
      const value = Math.min(100, ((now - startedAt) / CAPTURE_MS) * 100);
      if (mountedRef.current) setProgress(value);
      if (value < 100) animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    timerRef.current = window.setTimeout(async () => {
      setProgress(100);
      setStatus("processing");
      try {
        const frame = await capture();
        const result = await onVerified(frame);
        if (!mountedRef.current) return;
        if (result?.verified) {
          setStatus("success");
          stopCamera();
        } else {
          setStatus("failed");
          setError("Face not verified. Keep your face clearly inside the circle and try again.");
        }
      } catch (reason) {
        if (!mountedRef.current) return;
        setStatus("failed");
        setError(reason?.message || "Face verification could not be completed.");
      }
    }, CAPTURE_MS);
  }, [capture, onVerified, status, stopCamera]);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 720 }, height: { ideal: 720 }, facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus("ready");
      } catch {
        if (!cancelled) {
          setStatus("error");
          setError("Camera access is required to unlock this account.");
        }
      }
    })();
    return () => {
      cancelled = true;
      mountedRef.current = false;
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (status !== "ready") return undefined;
    const timer = window.setTimeout(begin, 700);
    return () => window.clearTimeout(timer);
  }, [begin, status]);

  const circumference = 2 * Math.PI * 94;
  const statusText = status === "preparing"
    ? "Preparing camera…"
    : status === "ready"
      ? "Place your face inside the circle"
      : status === "capturing"
        ? "Keep your head still and your face inside the circle"
        : status === "processing"
          ? "Verifying your identity…"
          : status === "success"
            ? "Verified"
            : "Not Verified";

  return (
    <div className="auth-shell">
      <div className="auth-form-panel face-lock-panel">
        <div className="auth-form-card face-lock-card">
          <div className="brand" style={{ marginBottom: 20 }}>
            <BrandLogo />
            <div className="brand-text"><div className="name">Hire IQ</div></div>
          </div>
          <h1 className="auth-title">Unlock your account</h1>
          <p className="auth-sub">Look at the camera to continue securely.</p>

          <div className={`active-camera-shell face-lock-camera ${status}`}>
            <video ref={videoRef} muted playsInline />
            {status === "preparing" && <div className="active-camera-placeholder"><Camera size={34} /></div>}
            <svg className="liveness-progress-overlay" viewBox="0 0 200 200" aria-hidden="true">
              <circle className="liveness-progress-track" cx="100" cy="100" r="94" />
              <circle
                className="liveness-progress-value"
                cx="100"
                cy="100"
                r="94"
                style={{ strokeDasharray: circumference, strokeDashoffset: circumference * (1 - progress / 100) }}
              />
            </svg>
          </div>

          <div className={`liveness-auto-status ${status}`} aria-live="polite">
            {status === "processing" && <span className="processing-spinner" />}
            {statusText}
          </div>

          {error && (
            <div className="field-warning face-lock-warning" role="alert">
              <AlertCircle size={14} /> <span>{error}</span>
            </div>
          )}
          {status === "failed" && (
            <button className="btn btn-primary" onClick={begin}>Try Again</button>
          )}
          <button className="btn-ghost face-lock-signout" onClick={onLogout}>
            <LogOut size={14} /> Sign out
          </button>
          <canvas ref={canvasRef} hidden />
        </div>
      </div>
    </div>
  );
}
