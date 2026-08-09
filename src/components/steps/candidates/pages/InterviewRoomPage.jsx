import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle, MonitorUp, PhoneOff, Play, Save, ShieldCheck, Video } from "lucide-react";
import { interviewApi } from "../../../../lib/api.js";


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
  const [runResults, setRunResults] = useState({});
  const [examMinutes, setExamMinutes] = useState(30);
  const [actionBusy, setActionBusy] = useState(false);
  const meetNode = useRef(null);
  const meetingApi = useRef(null);
  const proctorStream = useRef(null);
  const screenStream = useRef(null);
  const saveTimers = useRef({});
  const eventCooldown = useRef({});

  const logEvent = useCallback((type, severity = "MEDIUM", detail = "") => {
    if (companyView) return;
    const key = `${type}:${detail}`;
    const now = Date.now();
    if (eventCooldown.current[key] && now - eventCooldown.current[key] < 4000) return;
    eventCooldown.current[key] = now;
    void interviewApi.proctorEvent(interview.id, type, severity, { detail }).catch(() => {
      // Monitoring is best effort and must not interrupt the live interview UI.
    });
  }, [companyView, interview.id]);

  useEffect(() => () => {
    Object.values(saveTimers.current).forEach(window.clearTimeout);
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
      api.addListener("videoConferenceJoined", () => {
        setMeetingJoined(true);
        if (!companyView) window.setTimeout(() => api.executeCommand("toggleShareScreen"), 700);
      });
      api.addListener("screenSharingStatusChanged", ({ on }) => {
        setScreenShared(Boolean(on));
        if (!on && !companyView) logEvent("SCREEN_SHARE_STOPPED", "HIGH", "Applicant stopped meeting screen sharing");
      });
      api.addListener("audioMuteStatusChanged", ({ muted }) => { if (muted) logEvent("MIC_OFF", "HIGH", "Applicant muted the microphone"); });
      api.addListener("videoMuteStatusChanged", ({ muted }) => { if (muted) logEvent("CAMERA_OFF", "HIGH", "Applicant turned the camera off"); });
    }).catch((reason) => setError(reason.message));
    return () => {
      cancelled = true;
      meetingApi.current?.dispose?.();
      meetingApi.current = null;
    };
  }, [joined]);

  useEffect(() => {
    if (!joined || companyView) return undefined;
    const visibility = () => { if (document.hidden) logEvent("TAB_SWITCHED", "HIGH", "Applicant left the interview tab"); };
    const blur = () => logEvent("WINDOW_BLUR", "MEDIUM", "Interview window lost focus");
    const fullscreen = () => { if (!document.fullscreenElement) logEvent("FULLSCREEN_EXIT", "MEDIUM", "Applicant exited full screen"); };
    const screenTrack = screenStream.current?.getVideoTracks()[0];
    const stopped = () => { setScreenShared(false); logEvent("SCREEN_SHARE_STOPPED", "HIGH", "Applicant stopped entire-screen sharing"); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", blur);
    document.addEventListener("fullscreenchange", fullscreen);
    screenTrack?.addEventListener("ended", stopped);

    const cleanups = [];
    const stream = proctorStream.current;
    if (stream) {
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
      document.removeEventListener("fullscreenchange", fullscreen);
      screenTrack?.removeEventListener("ended", stopped);
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [companyView, joined, logEvent]);

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
          const next = { ...drafts };
          nextOral.questions.forEach((question) => {
            if (!next[question.id]) next[question.id] = { rating_out_of_10: question.rating_out_of_10 ?? "", interviewer_notes: question.interviewer_notes || "" };
          });
          return next;
        });
      } else {
        const nextCoding = await interviewApi.codingStatus(interview.id);
        setCoding(nextCoding);
        if (["active", "completed"].includes(nextCoding.status)) {
          const nextNotebook = await interviewApi.notebook(interview.id, credentials.token);
          setNotebook(nextNotebook);
          setAnswers((currentAnswers) => {
            const next = { ...currentAnswers };
            nextNotebook.cells.forEach((cell) => { if (!(cell.cell_id in next)) next[cell.cell_id] = cell.latest_code || cell.starter_code || ""; });
            return next;
          });
        }
      }
    } catch (reason) {
      if (reason.status !== 409) setError(reason.message || "Could not refresh the interview");
    }
  }, [companyView, credentials.token, interview.id]);

  useEffect(() => {
    if (!joined) return undefined;
    void poll();
    const timer = window.setInterval(poll, 1500);
    return () => window.clearInterval(timer);
  }, [joined, poll]);

  const enter = async () => {
    setJoining(true); setError("");
    try {
      if (!credentials.token) throw new Error("Your participant invitation token is missing.");
      await interviewApi.verifyToken(interview.id, credentials.role, credentials.token);
      if (!companyView) {
        if (!navigator.mediaDevices?.getUserMedia || !navigator.mediaDevices?.getDisplayMedia) throw new Error("This browser does not support the required camera and screen sharing.");
        proctorStream.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        screenStream.current = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: "monitor" }, audio: false });
        const displaySurface = screenStream.current.getVideoTracks()[0]?.getSettings?.().displaySurface;
        if (displaySurface && displaySurface !== "monitor") throw new Error("Choose Entire Screen, not a tab or window.");
        setScreenShared(true);
        if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
        await interviewApi.precheck(interview.id, {
          role: credentials.role,
          token: credentials.token,
          camera: proctorStream.current.getVideoTracks().some((track) => track.readyState === "live"),
          microphone: proctorStream.current.getAudioTracks().some((track) => track.readyState === "live"),
          screen_share: screenStream.current.active,
          fullscreen: Boolean(document.fullscreenElement),
        });
      }
      await interviewApi.join(interview.id, credentials.role, credentials.token);
      setCurrent(await interviewApi.get(interview.id));
      setJoined(true);
    } catch (reason) {
      setError(reason.message || "Could not join the interview");
      proctorStream.current?.getTracks().forEach((track) => track.stop());
      screenStream.current?.getTracks().forEach((track) => track.stop());
      proctorStream.current = null; screenStream.current = null;
    } finally { setJoining(false); }
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

  const saveMark = (question) => perform(() => interviewApi.rateOral(interview.id, question.id, {
    rating_out_of_10: Number(oralDrafts[question.id]?.rating_out_of_10),
    interviewer_notes: oralDrafts[question.id]?.interviewer_notes || null,
  }), "Mark saved.");

  const endViva = () => perform(() => interviewApi.endOral(interview.id), "Viva completed. The proctored round is ready.");
  const startExam = () => perform(() => interviewApi.startCoding(interview.id, examMinutes), "Proctored answer round started.");
  const generateReport = () => perform(
    () => interviewApi.generateReport(interview.id),
    "Final report and PDF generated.",
  );

  const updateAnswer = (cellId, value) => {
    setAnswers((items) => ({ ...items, [cellId]: value }));
    window.clearTimeout(saveTimers.current[cellId]);
    saveTimers.current[cellId] = window.setTimeout(() => {
      void interviewApi.saveAnswer(interview.id, cellId, credentials.token, value).catch((reason) => setError(reason.message));
    }, 350);
  };

  const submitExam = () => perform(async () => {
    await Promise.all((notebook?.cells || []).map((cell) => interviewApi.saveAnswer(interview.id, cell.cell_id, credentials.token, answers[cell.cell_id] || "")));
    await interviewApi.submitAll(interview.id, credentials.token);
  }, "Your answers were submitted.");

  const runAnswer = async (cell) => {
    setActionBusy(true); setError("");
    try {
      const result = await interviewApi.runAnswer(interview.id, cell.cell_id, credentials.token, answers[cell.cell_id] || "");
      setRunResults((items) => ({ ...items, [cell.cell_id]: result }));
    } catch (reason) { setError(reason.message || "Could not run this answer"); }
    finally { setActionBusy(false); }
  };

  const requestMeetingShare = () => meetingApi.current?.executeCommand("toggleShareScreen");

  const leave = () => {
    meetingApi.current?.dispose?.();
    proctorStream.current?.getTracks().forEach((track) => track.stop());
    screenStream.current?.getTracks().forEach((track) => track.stop());
    if (document.fullscreenElement) void document.exitFullscreen();
    onLeave();
  };

  const examActive = coding?.status === "active";
  const allMarked = oral.questions.length > 0 && oral.questions.every((question) => question.rating_out_of_10 != null);

  return <div className={`video-room ${examActive && !companyView ? "proctored-mode" : ""}`}>
    <div className="video-room-header">
      <span>{current.candidate_name && companyView ? `${current.candidate_name} · ` : ""}{current.job_id || "HireIQ Interview"}</span>
      <span className="video-room-timer">{examActive ? clock(coding.remaining_seconds) : (meetingJoined ? "Connected" : current.scheduling_status)}</span>
    </div>
    {error && <div className="interview-room-alert" role="alert">{error}</div>}
    {message && <div className="interview-room-message">{message}</div>}

    {!joined ? <div className="interview-prejoin-card">
      <Video size={32} color="var(--primary)" /><h2>Ready to join?</h2>
      <p>{companyView ? "Your company invitation will be verified before entry." : "Allow camera and microphone, select Entire Screen, and stay in full screen during the proctored interview."}</p>
      <div className="portal-heading-actions"><button className="btn btn-primary" onClick={enter} disabled={joining}>{joining ? <LoaderCircle className="spin" size={15} /> : <ShieldCheck size={15} />} Verify & Join</button><button className="btn btn-outline" onClick={leave}>Cancel</button></div>
    </div> : <>
      <div className={`react-interview-layout ${companyView ? "interviewer" : "candidate"}`}>
        <main className={`react-meeting-stage ${examActive && !companyView ? "meeting-background" : ""}`}>
          <div ref={meetNode} className="react-jitsi-meeting" />
        </main>

        {companyView && <aside className="interviewer-control-panel">
          <div className="interview-state-row"><span>Applicant</span><strong>{dashboard?.interview?.candidate_joined ? "Joined" : "Waiting"}</strong></div>
          <div className="interview-state-row"><span>Stage</span><strong>{coding?.status === "active" ? "Proctored exam" : oral.round?.status === "active" ? "Viva" : oral.round?.status === "completed" ? "Viva completed" : "Waiting"}</strong></div>

          {oral.round?.status !== "completed" && <button className="btn btn-primary" disabled={actionBusy || oral.round?.status === "active"} onClick={startViva}><Play size={14} /> Start viva</button>}
          {oral.questions.map((question, index) => <section className="viva-score-card" key={question.id}>
            <strong>{index + 1}. {question.question_text}</strong>
            {question.expected_points && <small>Expected: {question.expected_points}</small>}
            <label>Mark out of 10<input type="number" min="0" max="10" step="0.5" value={oralDrafts[question.id]?.rating_out_of_10 ?? ""} onChange={(event) => setOralDrafts({ ...oralDrafts, [question.id]: { ...oralDrafts[question.id], rating_out_of_10: event.target.value } })} /></label>
            <label>Notes<textarea value={oralDrafts[question.id]?.interviewer_notes || ""} onChange={(event) => setOralDrafts({ ...oralDrafts, [question.id]: { ...oralDrafts[question.id], interviewer_notes: event.target.value } })} /></label>
            <button className="btn btn-outline" disabled={actionBusy || oralDrafts[question.id]?.rating_out_of_10 === ""} onClick={() => saveMark(question)}><Save size={13} /> Save mark</button>
          </section>)}
          {oral.round?.status === "active" && <button className="btn btn-primary" disabled={!allMarked || actionBusy} onClick={endViva}><CheckCircle2 size={14} /> Complete viva</button>}
          {oral.round?.status === "completed" && coding?.status === "not_started" && <div className="start-proctored-box"><label>Exam minutes<input type="number" min="1" max="180" value={examMinutes} onChange={(event) => setExamMinutes(event.target.value)} /></label><button className="btn btn-primary" disabled={actionBusy} onClick={startExam}><MonitorUp size={14} /> Start proctored exam</button></div>}
          {coding?.status === "completed" && !dashboard?.recommendation && <button className="btn btn-primary" disabled={actionBusy} onClick={generateReport}><Save size={14} /> Generate final report</button>}
          {dashboard?.recommendation && <div className="start-proctored-box"><strong>Final recommendation</strong><p>{dashboard.recommendation}</p></div>}
          {!!events.length && <div className="proctor-event-list"><h3>Recent flags</h3>{events.slice(0, 6).map((event) => <div key={event.id}><strong>{event.event_type.replaceAll("_", " ")}</strong><span>{event.severity}</span></div>)}</div>}
        </aside>}
      </div>

      {!companyView && examActive && <section className="proctored-answer-page">
        <header><div><h1>Proctored answer round</h1><p>Keep the meeting, camera, microphone, full screen, and entire-screen sharing active.</p></div><div className="proctored-header-actions"><span>{clock(coding.remaining_seconds)}</span>{!screenShared && <button className="btn btn-outline" onClick={requestMeetingShare}><MonitorUp size={14} /> Share entire screen</button>}<button className="btn btn-primary" disabled={actionBusy || !notebook} onClick={submitExam}>Submit all</button></div></header>
        <div className="proctored-question-list">{notebook?.cells.map((cell, index) => <article className="proctored-question" key={cell.cell_id}>
          <div className="proctored-question-title"><span>Question {index + 1}</span><strong>{cell.title}</strong></div>
          <div className="proctored-question-prompt">{cell.description}</div>
          <textarea spellCheck="false" aria-label={`Answer for ${cell.title}`} value={answers[cell.cell_id] || ""} onChange={(event) => updateAnswer(cell.cell_id, event.target.value)} />
          {cell.language !== "text" && <div className="proctored-question-actions"><button className="btn btn-outline" disabled={actionBusy} onClick={() => runAnswer(cell)}>Run visible tests</button>{runResults[cell.cell_id] && <span>{runResults[cell.cell_id].status === "disabled" ? "Execution is disabled until a secure runner is configured." : `${runResults[cell.cell_id].passed_tests}/${runResults[cell.cell_id].total_tests} visible tests passed`}</span>}</div>}
        </article>)}</div>
      </section>}

      {!companyView && coding?.status === "completed" && <div className="interview-complete-overlay"><CheckCircle2 size={42} /><h2>Answers submitted</h2><p>Your interview is complete.</p><button className="btn btn-primary" onClick={leave}>Return to HireIQ</button></div>}

      <div className="video-room-controls"><button className="video-control-btn leave" onClick={leave}><PhoneOff size={18} /><span>Leave HireIQ</span></button></div>
    </>}
  </div>;
}
