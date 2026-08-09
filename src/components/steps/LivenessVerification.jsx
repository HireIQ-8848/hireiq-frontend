import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Camera, Glasses, ScanLine, Sun } from "lucide-react";

const CAPTURE_MS = 3000;
const FRAME_INTERVAL_MS = 450;

const TIPS = [
  { icon: Sun, label: "Good lighting", sub: "Keep your face well lit" },
  { icon: Glasses, label: "Remove glasses", sub: "If possible" },
  { icon: ScanLine, label: "Keep face clear", sub: "No mask or obstruction" },
];

function recorderMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"]
    .find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

async function frameWithSha256(frames, expectedHash) {
  if (!expectedHash || !globalThis.crypto?.subtle) return frames[frames.length - 1];
  for (const frame of frames) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", await frame.arrayBuffer());
    const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    if (hash === expectedHash) return frame;
  }
  return frames[frames.length - 1];
}

function savedBiometricProgress(registration) {
  const gates = registration?.verification?.gates || {};
  return gates.liveness === true && registration?.verification_status !== "verified";
}

export default function LivenessVerification({
  onChange,
  onVerifyLiveness,
  onRetryBiometrics,
  registration,
  busy,
}) {
  const savedProgress = savedBiometricProgress(registration);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const captureTimerRef = useRef(null);
  const frameTimerRef = useRef(null);
  const animationRef = useRef(null);
  const mountedRef = useRef(true);
  const capturingRef = useRef(false);
  const retryCaptureRef = useRef(savedProgress);

  const [cameraReady, setCameraReady] = useState(false);
  const [status, setStatus] = useState(savedProgress ? "partial" : "preparing");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const clearCaptureWork = useCallback(() => {
    window.clearTimeout(captureTimerRef.current);
    window.clearInterval(frameTimerRef.current);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    captureTimerRef.current = null;
    frameTimerRef.current = null;
    animationRef.current = null;
  }, []);

  const stopCamera = useCallback(() => {
    clearCaptureWork();
    capturingRef.current = false;
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, [clearCaptureWork]);

  const captureFrame = useCallback(() => new Promise((resolve) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      resolve(null);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      resolve(blob
        ? new File([blob], `liveness-${Date.now()}.jpg`, { type: "image/jpeg" })
        : null);
    }, "image/jpeg", 0.9);
  }), []);

  const beginCapture = useCallback(async () => {
    if (!mountedRef.current || capturingRef.current || busy || !streamRef.current) return;
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    capturingRef.current = true;
    clearCaptureWork();
    setError("");
    setProgress(0);
    setStatus("capturing");
    const retryingBiometrics = retryCaptureRef.current;
    onChange?.({ selfieFile: null, livenessVerified: retryingBiometrics });

    const frames = [];
    const addFrame = async () => {
      const frame = await captureFrame();
      if (frame) frames.push(frame);
    };
    await addFrame();

    let recordedBytes = 0;
    let recorder = null;
    try {
      const mimeType = recorderMimeType();
      recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (event) => {
        recordedBytes += event.data?.size || 0;
      };
      recorder.start(250);
      recorderRef.current = recorder;
    } catch {
      capturingRef.current = false;
      setError("Video capture is unavailable in this browser. Use a current version of Chrome, Edge, Firefox, or Safari.");
      setStatus("error");
      return;
    }

    frameTimerRef.current = window.setInterval(() => void addFrame(), FRAME_INTERVAL_MS);
    const startedAt = performance.now();
    const animate = (now) => {
      const value = Math.min(100, ((now - startedAt) / CAPTURE_MS) * 100);
      if (mountedRef.current) setProgress(value);
      if (value < 100) animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);

    captureTimerRef.current = window.setTimeout(async () => {
      window.clearInterval(frameTimerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      await addFrame();

      if (recorder?.state === "recording") {
        await new Promise((resolve) => {
          recorder.addEventListener("stop", resolve, { once: true });
          recorder.stop();
        });
      }
      recorderRef.current = null;
      capturingRef.current = false;

      if (!mountedRef.current) return;
      if (!frames.length || !recordedBytes) {
        setError("The camera could not complete the recording. Trying again automatically…");
        setStatus("retry");
        return;
      }

      setProgress(100);
      setStatus("processing");

      const primaryFrame = frames[frames.length - 1];
      onChange?.({ selfieFile: primaryFrame, livenessVerified: retryingBiometrics });
      try {
        const result = retryingBiometrics
          ? await onRetryBiometrics?.({ frames })
          : await onVerifyLiveness?.({ frames });
        if (!mountedRef.current) return;
        if (result?.verification_status === "verified") {
          const acceptedFrame = await frameWithSha256(frames, result.frame_sha256);
          if (!mountedRef.current) return;
          onChange?.({ selfieFile: acceptedFrame, livenessVerified: true });
          setStatus("success");
          stopCamera();
        } else if (result?.liveness_passed === true) {
          const acceptedFrame = await frameWithSha256(frames, result.frame_sha256);
          if (!mountedRef.current) return;
          onChange?.({ selfieFile: acceptedFrame, livenessVerified: true });
          retryCaptureRef.current = true;
          setError("Verification is incomplete. Take another fresh camera capture.");
          setStatus("partial");
        } else {
          setError("The camera capture was not accepted. Keep your face still and try again.");
          setStatus(retryingBiometrics ? "partial" : "retry");
        }
      } catch (reason) {
        if (!mountedRef.current) return;
        setError(
          retryingBiometrics
            ? "The fresh camera capture could not be processed. Please capture again."
            : reason?.message || "Verification could not be completed. Trying again automatically…",
        );
        setStatus(retryingBiometrics ? "partial" : "retry");
      }
    }, CAPTURE_MS);
  }, [busy, captureFrame, clearCaptureWork, onChange, onRetryBiometrics, onVerifyLiveness, stopCamera]);

  const retryRemainingChecks = () => {
    retryCaptureRef.current = true;
    setError("");
    setProgress(0);
    setStatus("waiting");
  };

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
          throw new Error("Camera recording is unavailable");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 720 }, height: { ideal: 720 }, facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraReady(true);
        setStatus("waiting");
      } catch {
        if (!cancelled) {
          setError("Camera access is required. Allow camera permission, then reload this page.");
          setStatus("error");
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
    if ((status !== "waiting" && status !== "retry") || busy || !cameraReady) return undefined;
    const delay = status === "retry" ? 1800 : 900;
    const timer = window.setTimeout(() => void beginCapture(), delay);
    return () => window.clearTimeout(timer);
  }, [beginCapture, busy, cameraReady, status]);

  const circumference = 2 * Math.PI * 94;
  const statusText = status === "preparing"
    ? "Preparing camera…"
    : status === "waiting"
      ? "Place your face inside the circle"
      : status === "capturing"
        ? "Keep your head still and your face inside the circle"
        : status === "processing"
          ? "Processing your verification…"
          : status === "success"
            ? "Identity verification completed"
            : status === "partial"
              ? "A fresh camera capture is required for the remaining checks"
            : status === "retry"
              ? "Preparing another automatic attempt…"
              : "Camera unavailable";

  return (
    <>
      <h1 className="step-title">Liveness verification</h1>
      <p className="step-sub">Place your face in front of the camera. Capture starts automatically.</p>

      <div className="card active-liveness-card">
        <div className={`active-camera-shell ${status}`}>
          <video ref={videoRef} muted playsInline />
          {!cameraReady && <div className="active-camera-placeholder"><Camera size={34} /></div>}
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

        <div className="tips-row active-liveness-tips">
          {TIPS.map(({ icon: Icon, label, sub }) => (
            <div className="tip" key={label}>
              <div className="icon"><Icon size={14} /></div>
              <div style={{ fontWeight: 600, color: "var(--ink)" }}>{label}</div>
              <div>{sub}</div>
            </div>
          ))}
        </div>

        {(error || registration?.status === "verification_failed") && status !== "success" && (
          <div className="field-warning liveness-auto-warning" role="alert">
            <AlertCircle size={14} />
            <span>
              {status === "partial"
                ? "Verification is incomplete. Take another fresh camera capture."
                : error || "Verification was not accepted. Another capture will begin automatically."}
            </span>
          </div>
        )}

        {status === "partial" && (
          <button className="btn btn-primary" onClick={retryRemainingChecks} disabled={busy}>
            {busy ? "Processing…" : "Capture Again"}
          </button>
        )}

        <canvas ref={canvasRef} hidden />
      </div>
    </>
  );
}
