const STORAGE_KEY = "hireiq:oral-question-timers";

export const DEFAULT_ORAL_TIMER_SECONDS = 120;

export function loadOralQuestionTimers() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    return Object.fromEntries(
      Object.entries(stored).filter(([, seconds]) => Number.isFinite(Number(seconds)) && Number(seconds) >= 10),
    );
  } catch {
    return {};
  }
}

export function saveOralQuestionTimer(questionId, seconds) {
  const timers = { ...loadOralQuestionTimers(), [questionId]: Math.max(10, Math.round(Number(seconds))) };
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(timers)); } catch { /* Keep the timer available for this session. */ }
  return timers;
}

export function removeOralQuestionTimer(questionId) {
  const timers = loadOralQuestionTimers();
  delete timers[questionId];
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(timers)); } catch { /* Storage may be unavailable in private mode. */ }
  return timers;
}
