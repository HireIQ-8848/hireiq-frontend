import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, FileCode2, LoaderCircle, MonitorUp, PhoneOff, Play, Save, ShieldCheck, Video } from "lucide-react";
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
  const [oralScore, setOralScore] = useState({ rating_out_of_10: "", interviewer_notes: "" });
  const [events, setEvents] = useState([]);
  const [coding, setCoding] = useState(null);
  const [notebook, setNotebook] = useState(null);
  const [answers, setAnswers] = useState({});
  const [activeCellId, setActiveCellId] = useState("");
  const [runResults, setRunResults] = useState({});
  const [examMinutes, setExamMinutes] = useState(30);
  const [actionBusy, setActionBusy] = useState(false);
  const [proctorReady, setProctorReady] = useState(false);
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
    void interviewApi.proctorEvent(interview.id, type, severity, { detail });
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
    if (!joined || companyView || coding?.status !== "active" || !proctorReady) return undefined;
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
  }, [coding?.status, companyView, joined, logEvent, proctorReady]);

  useEffect(() => {
    if (coding?.status === "active") return;
    screenStream.current?.getTracks().forEach((track) => track.stop());
    screenStream.current = null;
    setScreenShared(false);
    setProctorReady(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, [coding?.status]);

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
        setOralScore((draft) => ({
          rating_out_of_10: draft.rating_out_of_10 === "" ? (nextOral.round?.average_rating ?? "") : draft.rating_out_of_10,
          interviewer_notes: draft.interviewer_notes || nextOral.round?.interviewer_notes || "",
        }));
      } else {
        const nextCoding = await interviewApi.codingStatus(interview.id);
        setCoding(nextCoding);
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
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser does not support the required camera and microphone.");
        proctorStream.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        await interviewApi.precheck(interview.id, {
          role: credentials.role,
          token: credentials.token,
          camera: proctorStream.current.getVideoTracks().some((track) => track.readyState === "live"),
          microphone: proctorStream.current.getAudioTracks().some((track) => track.readyState === "live"),
          screen_share: false,
          fullscreen: false,
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

  const saveMark = () => perform(() => interviewApi.scoreOral(interview.id, {
    score: Number(oralScore.rating_out_of_10),
    notes: oralScore.interviewer_notes || null,
  }), "Mark saved.");

  const endViva = () => perform(() => interviewApi.endOral(interview.id), "Viva completed. The proctored round is ready.");
  const startExam = () => perform(() => interviewApi.startCoding(interview.id, examMinutes), "Proctored answer round started.");
  const skipExam = () => perform(() => interviewApi.skipCoding(interview.id), "Proctored round skipped. The interview is complete.");

  const enterProctoredWorkspace = async () => {
    setActionBusy(true); setError("");
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) throw new Error("This browser does not support screen sharing.");
      screenStream.current = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: "monitor" }, audio: false });
      const displaySurface = screenStream.current.getVideoTracks()[0]?.getSettings?.().displaySurface;
      if (displaySurface && displaySurface !== "monitor") {
        screenStream.current.getTracks().forEach((track) => track.stop());
        screenStream.current = null;
        throw new Error("Choose Entire Screen, not a browser tab or window.");
      }
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      setScreenShared(true);
      setProctorReady(true);
      logEvent("PROCTORED_WORKSPACE_ENTERED", "LOW", "Entire-screen sharing and full screen enabled");
    } catch (reason) {
      setError(reason.message || "Could not enter the proctored workspace");
    } finally { setActionBusy(false); }
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

  const leave = () => {
    meetingApi.current?.dispose?.();
    proctorStream.current?.getTracks().forEach((track) => track.stop());
    screenStream.current?.getTracks().forEach((track) => track.stop());
    if (document.fullscreenElement) void document.exitFullscreen();
    onLeave();
  };

  const examActive = coding?.status === "active";
  const oralMarked = oral.round?.average_rating != null;
  const activeCell = notebook?.cells.find((cell) => cell.cell_id === activeCellId) || notebook?.cells[0];

  return <div className={`video-room ${examActive && !companyView ? "proctored-mode" : ""}`}>
    <div className="video-room-header">
      <span>{current.candidate_name && companyView ? `${current.candidate_name} · ` : ""}{current.job_id || "HireIQ Interview"}</span>
      <span className="video-room-timer">{examActive ? clock(coding.remaining_seconds) : (meetingJoined ? "Connected" : current.scheduling_status)}</span>
    </div>
    {error && <div className="interview-room-alert" role="alert">{error}</div>}
    {message && <div className="interview-room-message">{message}</div>}

    {!joined ? <div className="interview-prejoin-card">
      <Video size={32} color="var(--primary)" /><h2>Ready to join?</h2>
      <p>{companyView ? "Your company invitation will be verified before entry." : "Allow camera and microphone for the oral video call. Screen sharing is requested later only if the interviewer starts the proctored round."}</p>
      <div className="portal-heading-actions"><button className="btn btn-primary" onClick={enter} disabled={joining}>{joining ? <LoaderCircle className="spin" size={15} /> : <ShieldCheck size={15} />} Verify & Join</button><button className="btn btn-outline" onClick={leave}>Cancel</button></div>
    </div> : <>
      <div className={`react-interview-layout ${companyView ? "interviewer" : "candidate"}`}>
        <main className={`react-meeting-stage ${examActive && !companyView ? "meeting-background" : ""}`}>
          <div ref={meetNode} className="react-jitsi-meeting" />
        </main>

        {companyView && <aside className="interviewer-control-panel">
          <div className="interview-state-row"><span>Applicant</span><strong>{dashboard?.interview?.candidate_joined ? "Joined" : "Waiting"}</strong></div>
          <div className="interview-state-row"><span>Stage</span><strong>{coding?.status === "active" ? "Proctored exam" : coding?.status === "skipped" ? "Proctoring skipped" : coding?.status === "completed" ? "Evaluation" : oral.round?.status === "active" ? "Oral round" : oral.round?.status === "completed" ? "Oral completed" : "Waiting"}</strong></div>

          {oral.round?.status === "not_started" && <button className="btn btn-primary" disabled={actionBusy} onClick={startViva}><Play size={14} /> Start oral round</button>}
          {oral.round?.status === "active" && <section className="viva-score-card">
            <strong>Overall oral assessment</strong>
            <small>No oral questions are stored. Enter one overall interviewer mark.</small>
            <label>Applicant mark out of 10<input type="number" min="0" max="10" step="0.5" value={oralScore.rating_out_of_10} onChange={(event) => setOralScore({ ...oralScore, rating_out_of_10: event.target.value })} /></label>
            <label>Interviewer notes<textarea value={oralScore.interviewer_notes} onChange={(event) => setOralScore({ ...oralScore, interviewer_notes: event.target.value })} /></label>
            <button className="btn btn-outline" disabled={actionBusy || oralScore.rating_out_of_10 === ""} onClick={saveMark}><Save size={13} /> Save oral mark</button>
          </section>}
          {oral.round?.status === "active" && <button className="btn btn-primary" disabled={!oralMarked || actionBusy} onClick={endViva}><CheckCircle2 size={14} /> Complete oral round</button>}
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
            <p>{coding.evaluation_status === "completed" ? `${coding.marks_awarded} / ${coding.max_marks} marks` : coding.evaluation_error || "Grok evaluation is in progress."}</p>
            {coding.breakdown?.map((item) => <div className="assessment-breakdown-row" key={item.question_id}><span>Q{item.question_number} · {item.title}</span><strong>{item.marks_awarded ?? "—"} / 5</strong><small>{item.evaluation?.feedback || "Awaiting evaluation"}</small></div>)}
            {coding.evaluation_status !== "completed" && <button className="btn btn-outline" disabled={actionBusy} onClick={() => perform(() => interviewApi.retryEvaluation(interview.id), "Evaluation refreshed.")}>Retry Grok evaluation</button>}
          </div>}
          {!!events.length && <div className="proctor-event-list"><h3>Recent flags</h3>{events.slice(0, 6).map((event) => <div key={event.id}><strong>{event.event_type.replaceAll("_", " ")}</strong><span>{event.severity}</span></div>)}</div>}
        </aside>}
      </div>

      {!companyView && examActive && <section className="proctored-answer-page">
        {!proctorReady ? <div className="proctor-permission-card"><ShieldCheck size={36} /><h2>Enter the secure answer workspace</h2><p>The timer is running. Share your Entire Screen and enter full screen to open the paper. The video call will continue securely in the background.</p><button className="btn btn-primary" disabled={actionBusy} onClick={enterProctoredWorkspace}><MonitorUp size={15} /> Share entire screen & continue</button></div> : <>
          <header><div><h1><FileCode2 size={20} /> HireIQ Paper</h1><p>Autosaved · each question carries 5 marks · Grok evaluates the submitted PDF.</p></div><div className="proctored-header-actions"><span>{clock(coding.remaining_seconds)}</span>{!screenShared && <button className="btn btn-outline" onClick={enterProctoredWorkspace}><MonitorUp size={14} /> Resume screen share</button>}<button className="btn btn-primary" disabled={actionBusy || !notebook} onClick={submitExam}>Submit paper</button></div></header>
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

      {!companyView && ["completed", "skipped"].includes(coding?.status) && <div className="interview-complete-overlay"><CheckCircle2 size={42} /><h2>{coding.status === "skipped" ? "Interview completed" : "Paper submitted"}</h2><p>{coding.status === "skipped" ? "The interviewer skipped the proctored round, so no question page was opened." : "Your PDF answer sheet was generated and sent for evaluation."}</p><button className="btn btn-primary" onClick={leave}>Return to HireIQ</button></div>}

      <div className="video-room-controls"><button className="video-control-btn leave" onClick={leave}><PhoneOff size={18} /><span>Leave HireIQ</span></button></div>
    </>}
  </div>;
}
