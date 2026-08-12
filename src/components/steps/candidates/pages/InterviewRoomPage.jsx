import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Clock3, FileCode2, LoaderCircle, MonitorUp, PhoneOff, Play, Save, ShieldCheck, TimerReset, Video } from "lucide-react";
import WrittenEvaluation from "../../../WrittenEvaluation.jsx";
import { interviewApi } from "../../../../lib/api.js";
import { DEFAULT_ORAL_TIMER_SECONDS, loadOralQuestionTimers } from "../../../../lib/interviewTimers.js";
import { createSingleFlight, evaluationPresentation, shouldPollEvaluation } from "../../../../lib/writtenEvaluation.js";


const DEFAULT_APP_ID = import.meta.env.VITE_JAAS_APP_ID || "vpaas-magic-cookie-1fe1890c22f1421fb11848cbf09f62e7";
let jitsiLoader;


function loadJitsi(appId) {
  if (window.JitsiMeetExternalAPI) return Promise.resolve();
  if (!jitsiLoader) {
    jitsiLoader = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://8x8.vc/${appId}/external_api.js`;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Could not load the live meeting"));
      document.head.appendChild(script);
    });
  }
  return jitsiLoader;
}


function invitation(interview, user) {
  try {
    const link = new URL(interview?.join_url || "", window.location.origin);
    return {
      role: link.searchParams.get("role") || (user?.role === "company" ? "interviewer" : "candidate"),
      token: link.searchParams.get("token") || "",
    };
  } catch {
    return { role: user?.role === "company" ? "interviewer" : "candidate", token: "" };
  }
}


function clock(seconds) {
  if (seconds == null) return "--:--";
  const safe = Math.max(0, Number(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}


function oralQuestionRemaining(durationSeconds, endsAt, timestamp = Date.now()) {
  if (!endsAt) return Math.max(0, Number(durationSeconds) || 0);
  return Math.max(0, Math.ceil((endsAt - timestamp) / 1000));
}


export default function InterviewRoomPage({ interview, user, onLeave }) {
  const credentials = useMemo(() => invitation(interview, user), [interview, user]);
  const companyView = credentials.role === "interviewer";
  const [current, setCurrent] = useState(interview);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [meetingJoined, setMeetingJoined] = useState(false);
  const [screenShared, setScreenShared] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [oral, setOral] = useState({ round: null, questions: [] });
  const [oralDrafts, setOralDrafts] = useState({});
  const [events, setEvents] = useState([]);
  const [coding, setCoding] = useState(null);
  const [notebook, setNotebook] = useState(null);
  const [answers, setAnswers] = useState({});
  const [activeCellId, setActiveCellId] = useState("");
  const [runResults, setRunResults] = useState({});
  const [examMinutes, setExamMinutes] = useState(30);
  const [actionBusy, setActionBusy] = useState(false);
  const [proctorReady, setProctorReady] = useState(false);
  const [meetingSharePending, setMeetingSharePending] = useState(false);
  const [timerNow, setTimerNow] = useState(Date.now());
  const [oralTimerDurations] = useState(() => loadOralQuestionTimers());
  const [oralTimer, setOralTimer] = useState({ questionId: "", endsAt: 0 });
  const [precheckStatus, setPrecheckStatus] = useState({
    camera: false,
    microphone: false,
    screenShare: false,
    fullscreen: false,
  });
  const meetNode = useRef(null);
  const meetingApi = useRef(null);
  const proctorStream = useRef(null);
  const screenStream = useRef(null);
  const saveTimers = useRef({});
  const eventCooldown = useRef({});
  const permissionPromptActive = useRef(false);
  const screenSharedRef = useRef(false);
  const meetingMediaReady = useRef(false);
  const meetingMediaState = useRef({ camera: null, microphone: null });
  const meetingShareTimeout = useRef(null);

  const retryEvaluation = useMemo(() => createSingleFlight(async () => {
    setActionBusy(true); setError(""); setMessage("");
    try {
      await interviewApi.retryEvaluation(interview.id);
      const nextCoding = await interviewApi.codingStatus(interview.id);
      setCoding(nextCoding);
      setMessage("Evaluation restarted.");
      return nextCoding;
    } catch (reason) {
      setError(reason.message || "Could not retry the written-answer evaluation");
      return null;
    } finally {
      setActionBusy(false);
    }
  }), [interview.id]);

  const logEvent = useCallback((type, severity = "MEDIUM", detail = "") => {
    if (companyView) return;
    const key = `${type}:${detail}`;
    const now = Date.now();
    if (eventCooldown.current[key] && now - eventCooldown.current[key] < 4000) return;
    eventCooldown.current[key] = now;
    void interviewApi.proctorEvent(interview.id, type, severity, { detail }).catch(() => {});
  }, [companyView, interview.id]);

  useEffect(() => () => {
    Object.values(saveTimers.current).forEach(window.clearTimeout);
    window.clearTimeout(meetingShareTimeout.current);
    meetingApi.current?.dispose?.();
    proctorStream.current?.getTracks().forEach((track) => track.stop());
    screenStream.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (!joined || !meetNode.current) return undefined;
    let cancelled = false;
    const appId = current?.meeting_app_id || DEFAULT_APP_ID;
    loadJitsi(appId).then(() => {
      if (cancelled || !meetNode.current) return;
      const options = {
        roomName: `${appId}/${current.room_name}`,
        parentNode: meetNode.current,
        userInfo: { displayName: companyView ? (user?.fullName || "Interviewer") : (user?.fullName || "Applicant") },
        configOverwrite: {
          prejoinPageEnabled: false,
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          desktopSharingSources: ["screen"],
          disableDeepLinking: true,
        },
        interfaceConfigOverwrite: { SHOW_JITSI_WATERMARK: false },
      };
      if (current?.meeting_jwt) options.jwt = current.meeting_jwt;
      const api = new window.JitsiMeetExternalAPI("8x8.vc", options);
      meetingApi.current = api;
      const updateMeetingMedia = (kind, muted, canFlag = false) => {
        const available = !Boolean(muted);
        const previous = meetingMediaState.current[kind];
        meetingMediaState.current[kind] = available;
        setPrecheckStatus((status) => ({ ...status, [kind]: available }));
        if (canFlag && previous === true && !available) {
          logEvent(kind === "camera" ? "CAMERA_OFF" : "MIC_OFF", "HIGH", `Applicant turned the ${kind} off in the interview call`);
        }
      };
      api.addListener("videoConferenceJoined", async () => {
        setMeetingJoined(true);
        meetingMediaReady.current = false;
        try {
          const [audioMuted, videoMuted] = await Promise.all([api.isAudioMuted(), api.isVideoMuted()]);
          updateMeetingMedia("microphone", audioMuted);
          updateMeetingMedia("camera", videoMuted);
        } catch { /* Jitsi will still publish mute-status events. */ }
        window.setTimeout(() => {
          meetingMediaReady.current = true;
          permissionPromptActive.current = false;
        }, 1500);
      });
      api.addListener("screenSharingStatusChanged", ({ on }) => {
        const sharing = Boolean(on);
        const previous = screenSharedRef.current;
        const shouldFlagStop = previous && !permissionPromptActive.current;
        screenSharedRef.current = sharing;
        setScreenShared(sharing);
        if (sharing || previous) {
          setMeetingSharePending(false);
          permissionPromptActive.current = false;
          window.clearTimeout(meetingShareTimeout.current);
        }
        setPrecheckStatus((status) => ({ ...status, screenShare: sharing }));
        setProctorReady(sharing && Boolean(document.fullscreenElement));
        if (sharing) {
          setMessage("Your Entire Screen is now visible to the interviewer.");
        } else if (shouldFlagStop) {
          logEvent("SCREEN_SHARE_STOPPED", "HIGH", "Applicant stopped sharing the screen with the interviewer");
        }
      });
      api.addListener("audioMuteStatusChanged", ({ muted }) => {
        updateMeetingMedia("microphone", muted, meetingMediaReady.current);
      });
      api.addListener("videoMuteStatusChanged", ({ muted }) => {
        updateMeetingMedia("camera", muted, meetingMediaReady.current);
      });
    }).catch((reason) => {
      permissionPromptActive.current = false;
      setError(reason.message);
    });
    return () => {
      cancelled = true;
      meetingApi.current?.dispose?.();
      meetingApi.current = null;
      meetingMediaReady.current = false;
    };
  }, [joined]);

  useEffect(() => {
    if (!joined || companyView) return undefined;
    const visibility = () => {
      if (document.hidden) logEvent("TAB_SWITCHED", "HIGH", "Applicant left the interview tab");
    };
    const blur = () => {
      window.setTimeout(() => {
        if (permissionPromptActive.current) return;
        if (document.hidden) {
          logEvent("TAB_SWITCHED", "HIGH", "Applicant left the interview tab");
        } else if (!document.hasFocus()) {
          logEvent("APP_SWITCHED", "HIGH", "Applicant switched to another window or application");
        }
      }, 150);
    };
    const pagehide = () => logEvent("TAB_SWITCHED", "HIGH", "Applicant navigated away from the interview page");
    const fullscreen = () => {
      const active = Boolean(document.fullscreenElement);
      setPrecheckStatus((status) => ({ ...status, fullscreen: active }));
      if (!active) {
        setProctorReady(false);
        logEvent("FULLSCREEN_EXIT", "MEDIUM", "Applicant exited full screen");
      } else if (screenSharedRef.current) {
        setProctorReady(true);
      }
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", blur);
    window.addEventListener("pagehide", pagehide);
    document.addEventListener("fullscreenchange", fullscreen);

    const cleanups = [];
    const stream = proctorStream.current;
    const watchMediaTrack = (track, kind) => {
      const stateKey = kind === "video" ? "camera" : "microphone";
      const label = kind === "video" ? "Camera" : "Microphone";
      const eventPrefix = kind === "video" ? "CAMERA" : "MIC";
      const update = (available) => setPrecheckStatus((status) => ({ ...status, [stateKey]: available }));
      const ended = () => {
        update(false);
        if (!permissionPromptActive.current) {
          logEvent(`${eventPrefix}_OFF`, "HIGH", `${label} permission or device was turned off`);
        }
      };
      track.addEventListener("ended", ended);
      cleanups.push(() => {
        track.removeEventListener("ended", ended);
      });
    };
    stream?.getVideoTracks().forEach((track) => watchMediaTrack(track, "video"));
    stream?.getAudioTracks().forEach((track) => watchMediaTrack(track, "audio"));

    if (stream && coding?.status === "active") {
      const video = document.createElement("video");
      video.srcObject = stream; video.muted = true; video.playsInline = true;
      void video.play();
      if ("FaceDetector" in window) {
        const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 5 });
        const timer = window.setInterval(async () => {
          try {
            const faces = await detector.detect(video);
            if (!faces.length) return logEvent("NO_FACE_DETECTED", "HIGH", "No face is visible");
            if (faces.length > 1) logEvent("MULTIPLE_FACES_DETECTED", "HIGH", "More than one face is visible");
            const box = faces[0].boundingBox;
            const center = (box.x + box.width / 2) / Math.max(video.videoWidth, 1);
            if (center < 0.22 || center > 0.78) logEvent("LOOKING_AWAY", "MEDIUM", "Applicant moved away from the screen-facing area");
          } catch { /* Browser face tracking is best effort. */ }
        }, 4000);
        cleanups.push(() => window.clearInterval(timer));
      }
    }
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", blur);
      window.removeEventListener("pagehide", pagehide);
      document.removeEventListener("fullscreenchange", fullscreen);
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [coding?.status, companyView, joined, logEvent]);

  const poll = useCallback(async () => {
    try {
      const updated = await interviewApi.get(interview.id);
      setCurrent(updated);
      if (companyView) {
        const [nextDashboard, nextOral, nextEvents, nextCoding] = await Promise.all([
          interviewApi.dashboard(interview.id),
          interviewApi.oralRound(interview.id),
          interviewApi.proctoringEvents(interview.id),
          interviewApi.codingStatus(interview.id),
        ]);
        setDashboard(nextDashboard); setOral(nextOral); setEvents(nextEvents); setCoding(nextCoding);
        setOralDrafts((drafts) => {
          const nextDrafts = { ...drafts };
          nextOral.questions.forEach((question) => {
            if (!nextDrafts[question.id]) {
              nextDrafts[question.id] = {
                rating_out_of_10: question.rating_out_of_10 ?? "",
                interviewer_notes: question.interviewer_notes || "",
              };
            }
          });
          return nextDrafts;
        });
      } else {
        const [nextCoding, nextOral] = await Promise.all([
          interviewApi.codingStatus(interview.id),
          interviewApi.oralRound(interview.id),
        ]);
        setCoding(nextCoding);
        setOral(nextOral);
        if (nextCoding.status === "active") {
          const nextNotebook = await interviewApi.notebook(interview.id, credentials.token);
          setNotebook(nextNotebook);
          setAnswers((currentAnswers) => {
            const next = { ...currentAnswers };
            nextNotebook.cells.forEach((cell) => { if (!(cell.cell_id in next)) next[cell.cell_id] = cell.latest_code || cell.starter_code || ""; });
            return next;
          });
          setActiveCellId((currentCell) => currentCell || nextNotebook.cells[0]?.cell_id || "");
        }
      }
    } catch (reason) {
      if (reason.status !== 409) setError(reason.message || "Could not refresh the interview");
    }
  }, [companyView, credentials.token, interview.id]);

  const roundFinished = ["completed", "skipped"].includes(coding?.status);
  const keepRoomPolling = !coding || !roundFinished
    || (coding.status === "completed" && shouldPollEvaluation(coding));

  useEffect(() => {
    if (!joined || !keepRoomPolling) return undefined;
    let cancelled = false;
    let timer;
    const refresh = async () => {
      await poll();
      if (!cancelled) timer = window.setTimeout(refresh, 1500);
    };
    void refresh();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [joined, keepRoomPolling, poll]);

  useEffect(() => {
    if (!joined || (oral.round?.status !== "active" && coding?.status !== "active")) return undefined;
    setTimerNow(Date.now());
    const timer = window.setInterval(() => setTimerNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [coding?.status, joined, oral.round?.status]);

  const companyEnter = async () => {
    setJoining(true); setError("");
    try {
      if (!credentials.token) throw new Error("Your participant invitation token is missing.");
      await interviewApi.verifyToken(interview.id, credentials.role, credentials.token);
      await interviewApi.join(interview.id, credentials.role, credentials.token);
      setCurrent(await interviewApi.get(interview.id));
      setJoined(true);
    } catch (reason) {
      setError(reason.message || "Could not join the interview");
    } finally { setJoining(false); }
  };

  const enableCameraAndMicrophone = async () => {
    setJoining(true); setError(""); setMessage("");
    try {
      if (!credentials.token) throw new Error("Your participant invitation token is missing.");
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser does not support the required camera and microphone.");
      await interviewApi.verifyToken(interview.id, credentials.role, credentials.token);
      permissionPromptActive.current = true;
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const camera = stream.getVideoTracks().some((track) => track.readyState === "live");
      const microphone = stream.getAudioTracks().some((track) => track.readyState === "live");
      if (!camera || !microphone) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("Both camera and microphone must be enabled to continue.");
      }
      proctorStream.current?.getTracks().forEach((track) => track.stop());
      proctorStream.current = stream;
      stream.getVideoTracks().forEach((track) => track.addEventListener("ended", () => {
        setPrecheckStatus((status) => ({ ...status, camera: false }));
      }, { once: true }));
      stream.getAudioTracks().forEach((track) => track.addEventListener("ended", () => {
        setPrecheckStatus((status) => ({ ...status, microphone: false }));
      }, { once: true }));
      setPrecheckStatus((status) => ({ ...status, camera, microphone }));
      setMessage("Camera and microphone are ready. Next, share your entire screen.");
    } catch (reason) {
      setError(reason.message || "Could not enable the camera and microphone");
    } finally {
      permissionPromptActive.current = false;
      setJoining(false);
    }
  };

  const captureEntireScreen = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) throw new Error("This browser does not support screen sharing.");
    permissionPromptActive.current = true;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: "monitor" }, audio: false });
      const screenTrack = stream.getVideoTracks()[0];
      const displaySurface = screenTrack?.getSettings?.().displaySurface;
      if (!screenTrack || screenTrack.readyState !== "live") {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("Screen sharing did not start. Please try again.");
      }
      if (displaySurface && displaySurface !== "monitor") {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("Choose Entire Screen, not a browser tab or window.");
      }
      screenStream.current?.getTracks().forEach((track) => track.stop());
      screenStream.current = stream;
      screenTrack.addEventListener("ended", () => {
        setProctorReady(false);
        setPrecheckStatus((status) => ({ ...status, screenShare: false }));
      }, { once: true });
      setPrecheckStatus((status) => ({ ...status, screenShare: true }));
      return stream;
    } finally {
      permissionPromptActive.current = false;
    }
  };

  const shareEntireScreen = async () => {
    setJoining(true); setError(""); setMessage("");
    try {
      if (!precheckStatus.camera || !precheckStatus.microphone) {
        throw new Error("Enable your camera and microphone first.");
      }
      await captureEntireScreen();
      setMessage("Entire Screen permission is verified. Enter full screen to finish the pre-check.");
    } catch (reason) {
      setError(reason.message || "Could not share the entire screen");
    } finally { setJoining(false); }
  };

  const candidateEnter = async () => {
    setJoining(true); setError(""); setMessage("");
    let joinedSuccessfully = false;
    try {
      const camera = proctorStream.current?.getVideoTracks().some((track) => track.readyState === "live") || false;
      const microphone = proctorStream.current?.getAudioTracks().some((track) => track.readyState === "live") || false;
      const screenShare = screenStream.current?.getVideoTracks().some((track) => track.readyState === "live") || false;
      if (!camera || !microphone || !screenShare) {
        throw new Error("Complete the camera, microphone, and Entire Screen checks before joining.");
      }
      if (!document.fullscreenElement) {
        permissionPromptActive.current = true;
        await document.documentElement.requestFullscreen();
      }
      const fullscreen = Boolean(document.fullscreenElement);
      setPrecheckStatus({ camera, microphone, screenShare, fullscreen });
      if (!fullscreen) throw new Error("Full screen is required to complete the applicant pre-check.");
      const result = await interviewApi.precheck(interview.id, {
        role: credentials.role,
        token: credentials.token,
        camera,
        microphone,
        screen_share: screenShare,
        fullscreen,
      });
      if (result?.status !== "passed") throw new Error("The applicant pre-check did not pass. Please confirm every permission and try again.");
      await interviewApi.join(interview.id, credentials.role, credentials.token);
      setCurrent(await interviewApi.get(interview.id));
      setProctorReady(false);
      setScreenShared(false);
      screenSharedRef.current = false;
      permissionPromptActive.current = true;
      joinedSuccessfully = true;
      setJoined(true);
    } catch (reason) {
      setError(reason.message || "Could not complete the applicant pre-check");
    } finally {
      if (!joinedSuccessfully) permissionPromptActive.current = false;
      setJoining(false);
    }
  };

  const perform = async (work, success) => {
    setActionBusy(true); setError(""); setMessage("");
    try { await work(); setMessage(success); await poll(); }
    catch (reason) { setError(reason.message || "The interview could not be updated"); }
    finally { setActionBusy(false); }
  };

  const startViva = () => perform(async () => {
    if (current.status !== "live") await interviewApi.start(interview.id);
    await interviewApi.startOral(interview.id);
  }, "Viva started.");

  const updateOralDraft = (questionId, field, value) => {
    setOralDrafts((drafts) => ({
      ...drafts,
      [questionId]: {
        rating_out_of_10: drafts[questionId]?.rating_out_of_10 ?? "",
        interviewer_notes: drafts[questionId]?.interviewer_notes || "",
        [field]: value,
      },
    }));
  };

  const saveQuestionMark = (question) => perform(() => {
    const draft = oralDrafts[question.id] || {};
    if (draft.rating_out_of_10 === "" || draft.rating_out_of_10 == null) {
      throw new Error(`Enter a mark for ${question.title}.`);
    }
    return interviewApi.rateOral(interview.id, question.id, {
      rating_out_of_10: Number(draft.rating_out_of_10),
      interviewer_notes: draft.interviewer_notes || null,
    });
  }, `${question.title} marked.`);

  const startQuestionTimer = (question) => {
    const duration = Number(oralTimerDurations[question.id] || DEFAULT_ORAL_TIMER_SECONDS);
    setTimerNow(Date.now());
    setOralTimer({ questionId: question.id, endsAt: Date.now() + duration * 1000 });
    setMessage(`${question.title} countdown started.`);
    setError("");
  };

  const endViva = () => perform(async () => {
    const missing = oral.questions.filter((question) => {
      const draft = oralDrafts[question.id];
      return question.rating_out_of_10 == null && (draft?.rating_out_of_10 === "" || draft?.rating_out_of_10 == null);
    });
    if (missing.length) throw new Error(`Enter a mark for every oral question first (${missing.length} remaining).`);
    await Promise.all(oral.questions.map((question) => {
      const draft = oralDrafts[question.id];
      if (!draft || draft.rating_out_of_10 === "" || draft.rating_out_of_10 == null) return Promise.resolve();
      const unchanged = Number(draft.rating_out_of_10) === Number(question.rating_out_of_10)
        && (draft.interviewer_notes || "") === (question.interviewer_notes || "");
      return unchanged ? Promise.resolve() : interviewApi.rateOral(interview.id, question.id, {
        rating_out_of_10: Number(draft.rating_out_of_10),
        interviewer_notes: draft.interviewer_notes || null,
      });
    }));
    await interviewApi.endOral(interview.id);
  }, "Viva completed. The proctored round is ready.");
  const startExam = () => perform(() => interviewApi.startCoding(interview.id, examMinutes), "Proctored answer round started.");
  const skipExam = () => perform(() => interviewApi.skipCoding(interview.id), "Proctored round skipped. The interview is complete.");

  const shareScreenWithInterviewer = async () => {
    setActionBusy(true); setError(""); setMessage("");
    try {
      if (!meetingJoined || !meetingApi.current) throw new Error("Wait for the interview call to connect before sharing your screen.");
      if (screenSharedRef.current) return;
      permissionPromptActive.current = true;
      setMeetingSharePending(true);
      screenStream.current?.getTracks().forEach((track) => track.stop());
      screenStream.current = null;
      setPrecheckStatus((status) => ({ ...status, screenShare: false }));
      meetingApi.current.executeCommand("toggleShareScreen");
      setMessage("In the browser prompt, choose Entire Screen to make it visible to the interviewer.");
      window.clearTimeout(meetingShareTimeout.current);
      meetingShareTimeout.current = window.setTimeout(() => {
        if (!screenSharedRef.current) {
          setMeetingSharePending(false);
          permissionPromptActive.current = false;
          setError("Screen sharing did not start. Click Share Entire Screen and approve the browser prompt.");
        }
      }, 12000);
    } catch (reason) {
      setMeetingSharePending(false);
      permissionPromptActive.current = false;
      setError(reason.message || "Could not share the screen with the interviewer");
    } finally {
      setActionBusy(false);
    }
  };

  const enterProctoredWorkspace = async () => {
    setActionBusy(true); setError("");
    try {
      if (!screenSharedRef.current) throw new Error("Share your Entire Screen with the interviewer first.");
      if (!document.fullscreenElement) {
        permissionPromptActive.current = true;
        await document.documentElement.requestFullscreen();
      }
      setProctorReady(true);
      setPrecheckStatus((status) => ({ ...status, screenShare: true, fullscreen: true }));
      logEvent("PROCTORED_WORKSPACE_ENTERED", "LOW", "In-call Entire Screen sharing and full screen enabled");
    } catch (reason) {
      setError(reason.message || "Could not enter the proctored workspace");
    } finally {
      permissionPromptActive.current = false;
      setActionBusy(false);
    }
  };

  const updateAnswer = (cellId, value) => {
    setAnswers((items) => ({ ...items, [cellId]: value }));
    window.clearTimeout(saveTimers.current[cellId]);
    saveTimers.current[cellId] = window.setTimeout(() => {
      void interviewApi.saveAnswer(interview.id, cellId, credentials.token, value).catch((reason) => setError(reason.message));
    }, 350);
  };

  const submitExam = () => perform(async () => {
    await Promise.all((notebook?.cells || []).map((cell) => interviewApi.saveAnswer(interview.id, cell.cell_id, credentials.token, answers[cell.cell_id] || "")));
    setCoding(await interviewApi.submitAll(interview.id, credentials.token));
  }, "Your answers were submitted.");

  const runAnswer = async (cell) => {
    setActionBusy(true); setError("");
    try {
      const result = await interviewApi.runAnswer(interview.id, cell.cell_id, credentials.token, answers[cell.cell_id] || "");
      setRunResults((items) => ({ ...items, [cell.cell_id]: result }));
    } catch (reason) { setError(reason.message || "Could not run this answer"); }
    finally { setActionBusy(false); }
  };

  const leave = () => {
    permissionPromptActive.current = true;
    window.clearTimeout(meetingShareTimeout.current);
    meetingApi.current?.dispose?.();
    proctorStream.current?.getTracks().forEach((track) => track.stop());
    screenStream.current?.getTracks().forEach((track) => track.stop());
    if (document.fullscreenElement) void document.exitFullscreen();
    onLeave();
  };

  const examActive = coding?.status === "active";
  const activeCell = notebook?.cells.find((cell) => cell.cell_id === activeCellId) || notebook?.cells[0];
  const monitoringActive = precheckStatus.camera && precheckStatus.microphone && screenShared;
  const evaluation = evaluationPresentation(coding, companyView);

  return <div className={`video-room ${examActive && !companyView ? "proctored-mode" : ""}`}>
    <div className="video-room-header">
      <span className="video-room-title">{current.candidate_name && companyView ? `${current.candidate_name} · ` : ""}{current.job_id || "HireIQ Interview"}{joined && !companyView && <small className={monitoringActive ? "monitoring-active" : "monitoring-warning"}>{monitoringActive ? "Monitoring active" : "Monitoring interrupted"}</small>}</span>
      <span className="video-room-timer">{examActive ? clock(coding.remaining_seconds) : (meetingJoined ? "Connected" : current.scheduling_status)}</span>
    </div>
    {error && <div className="interview-room-alert" role="alert">{error}</div>}
    {message && <div className="interview-room-message">{message}</div>}

    {!joined ? <div className="interview-prejoin-card">
      <Video size={32} color="var(--primary)" /><h2>{companyView ? "Ready to join?" : "Applicant device pre-check"}</h2>
      <p>{companyView ? "Your company invitation will be verified before entry." : "Complete all three checks. The screen check verifies Entire Screen permission; after the call connects, one final prompt publishes it to the interviewer."}</p>
      {!companyView && <div className="precheck-list" aria-label="Applicant pre-check status">
        <div className={precheckStatus.camera ? "passed" : ""}><CheckCircle2 size={17} /><span>Camera</span><strong>{precheckStatus.camera ? "Ready" : "Required"}</strong></div>
        <div className={precheckStatus.microphone ? "passed" : ""}><CheckCircle2 size={17} /><span>Microphone</span><strong>{precheckStatus.microphone ? "Ready" : "Required"}</strong></div>
        <div className={precheckStatus.screenShare ? "passed" : ""}><CheckCircle2 size={17} /><span>Entire Screen</span><strong>{precheckStatus.screenShare ? "Verified" : "Required"}</strong></div>
      </div>}
      {companyView ? <div className="portal-heading-actions"><button className="btn btn-primary" onClick={companyEnter} disabled={joining}>{joining ? <LoaderCircle className="spin" size={15} /> : <ShieldCheck size={15} />} Verify & Join</button><button className="btn btn-outline" onClick={leave}>Cancel</button></div> : <div className="precheck-actions">
        <button className="btn btn-outline" onClick={enableCameraAndMicrophone} disabled={joining}>{precheckStatus.camera && precheckStatus.microphone ? <CheckCircle2 size={15} /> : <Video size={15} />} 1. Enable camera & microphone</button>
        <button className="btn btn-outline" onClick={shareEntireScreen} disabled={joining || !precheckStatus.camera || !precheckStatus.microphone}>{precheckStatus.screenShare ? <CheckCircle2 size={15} /> : <MonitorUp size={15} />} 2. Verify Entire Screen</button>
        <button className="btn btn-primary" onClick={candidateEnter} disabled={joining || !precheckStatus.camera || !precheckStatus.microphone || !precheckStatus.screenShare}>{joining ? <LoaderCircle className="spin" size={15} /> : <ShieldCheck size={15} />} 3. Enter full screen & join</button>
        <button className="btn btn-outline" onClick={leave}>Cancel</button>
      </div>}
    </div> : <>
      <div className={`react-interview-layout ${companyView ? "interviewer" : "candidate"}`}>
        <main className={`react-meeting-stage ${examActive && !companyView ? "meeting-background" : ""}`}>
          <div ref={meetNode} className="react-jitsi-meeting" />
        </main>

        {companyView && <aside className="interviewer-control-panel">
          <div className="interview-state-row"><span>Applicant</span><strong>{dashboard?.interview?.candidate_joined ? "Joined" : "Waiting"}</strong></div>
          <div className="interview-state-row"><span>Stage</span><strong>{coding?.status === "active" ? "Proctored exam" : coding?.status === "skipped" ? "Proctoring skipped" : coding?.status === "completed" ? "Evaluation" : oral.round?.status === "active" ? "Oral round" : oral.round?.status === "completed" ? "Oral completed" : "Waiting"}</strong></div>

          {oral.round?.status === "not_started" && <button className="btn btn-primary" disabled={actionBusy} onClick={startViva}><Play size={14} /> Start oral round</button>}
          {oral.round?.status === "active" && <div className="oral-question-controls">
            <div className="oral-round-progress"><strong>Oral questions</strong><span>{oral.round.rated_questions || 0} / {oral.round.total_questions || oral.questions.length} marked</span></div>
            {oral.questions.map((question, index) => {
              const draft = oralDrafts[question.id] || { rating_out_of_10: question.rating_out_of_10 ?? "", interviewer_notes: question.interviewer_notes || "" };
              const duration = Number(oralTimerDurations[question.id] || DEFAULT_ORAL_TIMER_SECONDS);
              const timerStarted = oralTimer.questionId === question.id;
              const remaining = oralQuestionRemaining(duration, timerStarted ? oralTimer.endsAt : 0, timerNow);
              return <section className={`viva-score-card ${question.status === "rated" ? "rated" : ""}`} key={question.id}>
                <div className="viva-question-heading"><strong>Q{index + 1}. {question.title}</strong><span className={timerStarted && remaining === 0 ? "expired" : ""}><Clock3 size={12} /> {clock(remaining)}</span></div>
                <p>{question.question_text}</p>
                {question.expected_points && <details><summary>Expected points</summary><small>{question.expected_points}</small></details>}
                <button className="btn btn-outline oral-timer-button" disabled={actionBusy} onClick={() => startQuestionTimer(question)}><TimerReset size={13} /> {timerStarted ? "Restart" : "Start"} {clock(duration)} timer</button>
                <label>Applicant mark out of 10<input type="number" min="0" max="10" step="0.5" value={draft.rating_out_of_10} onChange={(event) => updateOralDraft(question.id, "rating_out_of_10", event.target.value)} /></label>
                <label>Interviewer notes<textarea value={draft.interviewer_notes} onChange={(event) => updateOralDraft(question.id, "interviewer_notes", event.target.value)} /></label>
                <button className="btn btn-outline" disabled={actionBusy || draft.rating_out_of_10 === ""} onClick={() => saveQuestionMark(question)}><Save size={13} /> {question.status === "rated" ? "Update mark" : "Save mark"}</button>
              </section>;
            })}
          </div>}
          {oral.round?.status === "active" && <button className="btn btn-primary" disabled={actionBusy} onClick={endViva}><CheckCircle2 size={14} /> Complete oral round</button>}
          {oral.round?.status === "completed" && coding?.status === "not_started" && <div className="start-proctored-box">
            <strong>Choose the next step</strong>
            <p>Set the paper duration before starting, or finish the interview without showing an answer page to the applicant.</p>
            <label>Paper time (minutes)<input type="number" min="1" max="180" value={examMinutes} onChange={(event) => setExamMinutes(event.target.value)} /></label>
            <button className="btn btn-primary" disabled={actionBusy || !dashboard?.coding?.total_questions} onClick={startExam}><MonitorUp size={14} /> Start proctored round</button>
            <button className="btn btn-outline" disabled={actionBusy} onClick={skipExam}><PhoneOff size={14} /> Skip proctored round</button>
            {!dashboard?.coding?.total_questions && <small>Add at least one paper question before starting proctoring.</small>}
          </div>}
          {coding?.status === "completed" && <div className="start-proctored-box assessment-summary">
            <strong>Paper evaluation</strong>
            <WrittenEvaluation assessment={coding} allowRetry retrying={actionBusy} onRetry={retryEvaluation} />
          </div>}
          {!!events.length && <div className="proctor-event-list"><h3>Recent flags</h3>{events.slice(0, 6).map((event) => <div key={event.id}><strong>{event.event_type.replaceAll("_", " ")}</strong><span>{event.severity}</span></div>)}</div>}
        </aside>}
      </div>

      {!companyView && meetingJoined && !screenShared && <section className="meeting-share-overlay" role="dialog" aria-modal="true" aria-labelledby="meeting-share-title">
        <div className="meeting-share-card">
          <MonitorUp size={38} />
          <h2 id="meeting-share-title">Share your screen with the interviewer</h2>
          <p>The pre-check verified screen permission. One final browser prompt connects your Entire Screen to the live interview so the interviewer can actually see it.</p>
          <button className="btn btn-primary" disabled={actionBusy || meetingSharePending} onClick={shareScreenWithInterviewer}>{meetingSharePending ? <LoaderCircle className="spin" size={15} /> : <MonitorUp size={15} />} {meetingSharePending ? "Waiting for browser approval…" : "Share Entire Screen"}</button>
        </div>
      </section>}

      {!companyView && examActive && <section className="proctored-answer-page">
        {!proctorReady ? <div className="proctor-permission-card"><ShieldCheck size={36} /><h2>Enter the secure answer workspace</h2><p>The timer is running. Keep your Entire Screen shared with the interviewer and enter full screen to open the paper. The video call will continue securely in the background.</p>{screenShared ? <button className="btn btn-primary" disabled={actionBusy} onClick={enterProctoredWorkspace}><MonitorUp size={15} /> Enter full screen & continue</button> : <button className="btn btn-primary" disabled={actionBusy || meetingSharePending} onClick={shareScreenWithInterviewer}><MonitorUp size={15} /> Share Entire Screen</button>}</div> : <>
          <header><div><h1><FileCode2 size={20} /> HireIQ Paper</h1><p>Autosaved · each question carries 5 marks · AI evaluates the submitted written answers.</p></div><div className="proctored-header-actions"><span>{clock(coding.remaining_seconds)}</span>{!screenShared && <button className="btn btn-outline" onClick={enterProctoredWorkspace}><MonitorUp size={14} /> Resume screen share</button>}<button className="btn btn-primary" disabled={actionBusy || !notebook} onClick={submitExam}>Submit paper</button></div></header>
          <div className="proctored-workbench">
            <aside className="paper-explorer"><strong>EXPLORER</strong><span>QUESTIONS</span>{notebook?.cells.map((cell, index) => <button className={cell.cell_id === activeCell?.cell_id ? "active" : ""} key={cell.cell_id} onClick={() => setActiveCellId(cell.cell_id)}><FileCode2 size={13} /> Q{index + 1} · {cell.title}</button>)}</aside>
            {activeCell && <article className="proctored-question" key={activeCell.cell_id}>
              <div className="editor-tab"><FileCode2 size={13} /> {activeCell.title}<span>5 marks</span></div>
              <div className="proctored-question-prompt">{activeCell.description}</div>
              <div className="editor-breadcrumb">paper › {activeCell.language === "text" ? "answer.md" : `answer.${activeCell.language === "python" ? "py" : "txt"}`}</div>
              <textarea spellCheck="false" aria-label={`Answer for ${activeCell.title}`} value={answers[activeCell.cell_id] || ""} onChange={(event) => updateAnswer(activeCell.cell_id, event.target.value)} />
              {activeCell.language !== "text" && <div className="proctored-question-actions"><button className="btn btn-outline" disabled={actionBusy} onClick={() => runAnswer(activeCell)}>Run visible tests</button>{runResults[activeCell.cell_id] && <span>{runResults[activeCell.cell_id].status === "disabled" ? "Execution is disabled until a secure runner is configured." : `${runResults[activeCell.cell_id].passed_tests}/${runResults[activeCell.cell_id].total_tests} visible tests passed`}</span>}</div>}
            </article>}
          </div>
          <footer className="editor-status-bar"><span>HireIQ Proctored</span><span>{screenShared ? "Entire screen shared" : "Screen share stopped"} · UTF-8 · Autosave on</span></footer>
        </>}
      </section>}

      {!companyView && ["completed", "skipped"].includes(coding?.status) && <div className="interview-complete-overlay">
        {coding.status === "skipped" || evaluation.status === "completed" ? <CheckCircle2 size={42} /> : shouldPollEvaluation(coding) ? <LoaderCircle className="spin" size={42} /> : <FileCode2 size={42} />}
        <h2>{coding.status === "skipped" ? "Interview completed" : evaluation.title}</h2>
        <p>{coding.status === "skipped" ? "The interviewer skipped the proctored round, so no question page was opened." : evaluation.message}</p>
        <button className="btn btn-primary" onClick={leave}>Return to HireIQ</button>
      </div>}

      <div className="video-room-controls"><button className="video-control-btn leave" onClick={leave}><PhoneOff size={18} /><span>Leave HireIQ</span></button></div>
    </>}
  </div>;
}
