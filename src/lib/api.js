import { supabase } from "./supabase.js";
import { privateInterviewAssetRequest } from "./privateInterviewAssets.js";
import { normalizeWrittenEvaluation } from "./writtenEvaluation.js";

// Empty API origins intentionally use the current origin. Vite and the
// production container proxy /api and /health for the monorepo deployment.
const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const INTERVIEW_API_URL = (
  import.meta.env.VITE_INTERVIEW_API_URL || `${API_URL}/api/v1`
).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message, status, code = "API_ERROR") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function errorDetails(payload, status) {
  const body = payload?.error || payload?.detail || payload;
  if (typeof body === "string") return { message: body, code: "API_ERROR" };
  return {
    message: body?.message || `Request failed with HTTP ${status}`,
    code: body?.code || "API_ERROR",
  };
}

function normalizeInterview(item) {
  if (!item || typeof item !== "object") return item;
  return {
    ...item,
    display_status: item.display_status || item.interview_status || "pending",
    scheduling_status: item.scheduling_status || item.display_status || item.interview_status || "pending",
    join_url: item.join_url || item.interview_room_url || item.interview_url || "",
    oral_score: item.oral_score ?? item.oral?.score ?? item.oral_round?.score ?? null,
    oral_max_score: item.oral_max_score ?? item.oral?.maximum_score ?? item.oral_round?.maximum_score ?? 10,
  };
}

function normalizeOralRound(payload) {
  const source = payload?.round || payload || {};
  const score = source.score
    ?? source.oral_score
    ?? source.rating_out_of_10
    ?? source.average_rating
    ?? null;
  const status = source.status === "in_progress" ? "active" : source.status;
  const round = {
    ...source,
    status,
    score,
    oral_score: score,
    oral_max_score: source.oral_max_score ?? source.maximum_score ?? source.max_score ?? 10,
    average_rating: score,
    interviewer_notes: source.interviewer_notes ?? source.notes ?? "",
  };
  return payload?.round ? { ...payload, round } : { round, questions: [] };
}

function localApiAlternatives(baseUrl) {
  const alternatives = [baseUrl];
  try {
    const configured = new URL(baseUrl);
    const localNames = new Set(["127.0.0.1", "localhost"]);
    if (!localNames.has(configured.hostname)) return alternatives;
    const browserHost = window.location.hostname;
    for (const hostname of [browserHost, "127.0.0.1", "localhost"]) {
      if (!localNames.has(hostname)) continue;
      const candidate = new URL(configured);
      candidate.hostname = hostname;
      if (!alternatives.includes(candidate.origin)) alternatives.push(candidate.origin);
    }
  } catch {
    // The configured value is validated by fetch below.
  }
  return alternatives;
}

async function authenticatedRequest(baseUrl, path, options = {}) {
  if (!supabase) throw new ApiError("Supabase is not configured", 0, "AUTH_CONFIG");
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) {
    throw new ApiError("Please sign in with Google", 401, "AUTH_REQUIRED");
  }

  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${session.access_token}`);
  headers.set("Accept", "application/json");
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response = null;
  let networkError = null;
  for (const requestBase of localApiAlternatives(baseUrl)) {
    try {
      response = await fetch(`${requestBase}${path}`, { ...options, headers });
      break;
    } catch (reason) {
      networkError = reason;
    }
  }
  if (!response) {
    throw new ApiError(
      `Cannot reach the HireIQ API at ${baseUrl || "the current origin"}. ${networkError?.message || "Start the backend and try again."}`,
      0,
      "API_UNAVAILABLE",
    );
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  if (!response.ok) {
    const detail = errorDetails(payload, response.status);
    throw new ApiError(detail.message, response.status, detail.code);
  }
  return payload;
}

export const apiRequest = (path, options = {}) => authenticatedRequest(API_URL, path, options);
export const interviewApiRequest = (path, options = {}) =>
  authenticatedRequest(INTERVIEW_API_URL, path, options);

export const authApi = {
  me: () => apiRequest("/api/v1/auth/me"),
  verifyFaceLock: (frame) => {
    const body = new FormData();
    body.append("current_frame", frame);
    return apiRequest("/api/v1/auth/face-lock", { method: "POST", body });
  },
};

export const registrationApi = {
  status: () => apiRequest("/api/v1/registration/status"),
  selectRole: (role) =>
    apiRequest("/api/v1/registration/role", {
      method: "POST",
      body: JSON.stringify({ role }),
    }),
  uploadDocument: (documentType, frontFile, backFile = null) => {
    const body = new FormData();
    body.append("document_type", documentType);
    body.append("front_file", frontFile);
    if (backFile) body.append("back_file", backFile);
    return apiRequest("/api/v1/registration/document", { method: "POST", body });
  },
  completeInformation: (fields) =>
    apiRequest("/api/v1/registration/information", {
      method: "PATCH",
      body: JSON.stringify({ fields }),
    }),
  activeLiveness: ({ frames = [] }) => {
    const body = new FormData();
    if (frames[0]) body.append("frame", frames[0]);
    frames.slice(1).forEach((frame) => body.append("frames", frame));
    return apiRequest("/api/v1/registration/active-liveness", {
      method: "POST",
      body,
    });
  },
  retry: () => apiRequest("/api/v1/registration/retry", { method: "POST" }),
  retryBiometrics: ({ frames = [] }) => {
    const body = new FormData();
    const primaryFrame = frames[frames.length - 1];
    if (primaryFrame) body.append("frame", primaryFrame);
    frames.slice(0, -1).forEach((frame) => body.append("frames", frame));
    return apiRequest("/api/v1/registration/retry-biometrics", {
      method: "POST",
      body,
    });
  },
};

export const jobsApi = {
  list: () => apiRequest("/api/v1/jobs"),
  recommendations: () => apiRequest("/api/v1/recommendations"),
  apply: (jobId) => apiRequest(`/api/v1/jobs/${encodeURIComponent(jobId)}/apply`, { method: "POST" }),
};

export const applicationsApi = {
  mine: () => apiRequest("/api/v1/applications"),
};

export const cvApi = {
  get: () => apiRequest("/api/v1/cv"),
  upload: (file, replace = false) => {
    const body = new FormData();
    body.append("file", file);
    return apiRequest("/api/v1/cv", { method: replace ? "PUT" : "POST", body });
  },
  remove: () => apiRequest("/api/v1/cv", { method: "DELETE" }),
};

export const notificationsApi = {
  list: () => apiRequest("/api/v1/notifications"),
  markRead: (id) => apiRequest(`/api/v1/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" }),
};

export const companyApi = {
  profile: () => apiRequest("/api/v1/company/profile"),
  jobs: () => apiRequest("/api/v1/company/jobs"),
  createJob: (payload) => apiRequest("/api/v1/jobs", { method: "POST", body: JSON.stringify(payload) }),
  updateJob: (id, payload) => apiRequest(`/api/v1/jobs/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteJob: (id) => apiRequest(`/api/v1/jobs/${encodeURIComponent(id)}`, { method: "DELETE" }),
  applicants: (jobId) => apiRequest(`/api/v1/company/jobs/${encodeURIComponent(jobId)}/applicants`),
  ranking: (jobId, topN = 5) => apiRequest(`/api/v1/company/jobs/${encodeURIComponent(jobId)}/ranking?top_n=${encodeURIComponent(topN)}`),
  closeJob: (id) => apiRequest(`/api/v1/company/jobs/${encodeURIComponent(id)}/close`, { method: "PATCH" }),
  updateApplication: (applicationId, status) => apiRequest(`/api/v1/company/applications/${encodeURIComponent(applicationId)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  }),
};

export const adminApi = {
  dashboard: () => apiRequest("/api/v1/admin/dashboard"),
  users: () => apiRequest("/api/v1/admin/users"),
  verifications: () => apiRequest("/api/v1/admin/verifications"),
  verification: (verificationId) =>
    apiRequest(`/api/v1/admin/verifications/${encodeURIComponent(verificationId)}`),
  approveVerification: (verificationId, steps, reason) =>
    apiRequest(
      `/api/v1/admin/verifications/${encodeURIComponent(verificationId)}/approve`,
      {
        method: "PATCH",
        body: JSON.stringify({ steps, reason }),
      },
    ),
  user: (profileId) =>
    apiRequest(`/api/v1/admin/users/${encodeURIComponent(profileId)}`),
  deleteUser: (profileId, payload) =>
    apiRequest(`/api/v1/admin/users/${encodeURIComponent(profileId)}`, {
      method: "DELETE",
      body: JSON.stringify(payload),
    }),
  companies: () => apiRequest("/api/v1/admin/companies"),
  jobs: () => apiRequest("/api/v1/admin/jobs"),
  moderateCompany: (companyId, action, reason) =>
    apiRequest(`/api/v1/admin/companies/${encodeURIComponent(companyId)}/${action}`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    }),
  moderateJob: (jobId, action, reason) =>
    apiRequest(`/api/v1/admin/jobs/${encodeURIComponent(jobId)}/${action}`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    }),
  logs: () => apiRequest("/api/v1/admin/logs"),
  health: () => apiRequest("/health"),
};

export const interviewApi = {
  syncMe: () => interviewApiRequest("/users/me/sync", { method: "POST" }),
  list: async () => {
    const payload = await interviewApiRequest("/interviews");
    const rows = Array.isArray(payload) ? payload : payload?.items || [];
    return rows.map(normalizeInterview);
  },
  get: async (id) => normalizeInterview(await interviewApiRequest(`/interviews/${encodeURIComponent(id)}`)),
  create: (payload) =>
    interviewApiRequest("/interviews/create", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  bulkSchedule: (payload) =>
    interviewApiRequest("/interviews/bulk-schedule", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  respond: (id, payload) =>
    interviewApiRequest(`/interviews/${encodeURIComponent(id)}/respond`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  decideReschedule: (id, action, note = null) =>
    interviewApiRequest(`/interviews/${encodeURIComponent(id)}/reschedule-decision`, {
      method: "POST",
      body: JSON.stringify({ action, note }),
    }),
  updateSchedule: (id, payload) =>
    interviewApiRequest(`/interviews/${encodeURIComponent(id)}/schedule`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  cancel: (id) =>
    interviewApiRequest(`/interviews/${encodeURIComponent(id)}/cancel`, { method: "POST" }),
  start: (id) => interviewApiRequest(`/interviews/${encodeURIComponent(id)}/start`, { method: "POST" }),
  end: (id) => interviewApiRequest(`/interviews/${encodeURIComponent(id)}/end`, { method: "POST" }),
  verifyToken: (id, role, token) =>
    interviewApiRequest(`/interviews/${encodeURIComponent(id)}/verify-token`, {
      method: "POST",
      body: JSON.stringify({ role, token }),
    }),
  precheck: (id, payload) =>
    interviewApiRequest(`/interviews/${encodeURIComponent(id)}/precheck`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  join: (id, role, token) =>
    interviewApiRequest(`/interviews/${encodeURIComponent(id)}/join`, {
      method: "POST",
      body: JSON.stringify({ role, token }),
    }),
  proctorEvent: (id, eventType, severity, metadata = {}) =>
    interviewApiRequest(`/interviews/${encodeURIComponent(id)}/proctoring/event`, {
      method: "POST",
      body: JSON.stringify({ event_type: eventType, severity, metadata }),
    }),
  oralQuestions: (id) => interviewApiRequest(`/interviews/${encodeURIComponent(id)}/oral-questions`),
  createOralQuestion: (id, payload) => interviewApiRequest(`/interviews/${encodeURIComponent(id)}/oral-questions/create-custom`, {
    method: "POST", body: JSON.stringify(payload),
  }),
  deleteOralQuestion: (id, questionId) => interviewApiRequest(`/interviews/${encodeURIComponent(id)}/oral-questions/${encodeURIComponent(questionId)}`, { method: "DELETE" }),
  oralRound: async (id) => normalizeOralRound(await interviewApiRequest(`/interviews/${encodeURIComponent(id)}/oral-round`)),
  startOral: (id) => interviewApiRequest(`/interviews/${encodeURIComponent(id)}/oral-round/start`, { method: "POST" }),
  rateOral: (id, questionId, payload) => interviewApiRequest(`/interviews/${encodeURIComponent(id)}/oral-questions/${encodeURIComponent(questionId)}/rate`, {
    method: "POST", body: JSON.stringify(payload),
  }),
  endOral: (id) => interviewApiRequest(`/interviews/${encodeURIComponent(id)}/oral-round/end`, { method: "POST" }),
  codingQuestions: (id) => interviewApiRequest(`/interviews/${encodeURIComponent(id)}/questions`),
  createCodingQuestion: (id, payload) => interviewApiRequest(`/interviews/${encodeURIComponent(id)}/questions/create-custom`, {
    method: "POST", body: JSON.stringify(payload),
  }),
  deleteCodingQuestion: (id, questionId) => interviewApiRequest(`/interviews/${encodeURIComponent(id)}/questions/${encodeURIComponent(questionId)}`, { method: "DELETE" }),
  startCoding: (id, minutes) => interviewApiRequest(`/interviews/${encodeURIComponent(id)}/coding-round/start`, {
    method: "POST", body: JSON.stringify({ exam_duration_minutes: Number(minutes) }),
  }),
  skipCoding: (id) => interviewApiRequest(`/interviews/${encodeURIComponent(id)}/coding-round/skip`, { method: "POST" }),
  retryEvaluation: async (id) => normalizeWrittenEvaluation(await interviewApiRequest(`/interviews/${encodeURIComponent(id)}/coding-round/evaluate`, { method: "POST" })),
  codingStatus: async (id) => normalizeWrittenEvaluation(await interviewApiRequest(`/interviews/${encodeURIComponent(id)}/coding-round/status`)),
  notebook: (id, token) => interviewApiRequest(`/interviews/${encodeURIComponent(id)}/notebook?token=${encodeURIComponent(token)}`),
  saveAnswer: (id, cellId, token, code) => interviewApiRequest(`/interviews/${encodeURIComponent(id)}/notebook/cell/${encodeURIComponent(cellId)}/update`, {
    method: "POST", body: JSON.stringify({ token, code }),
  }),
  runAnswer: (id, cellId, token, code) => interviewApiRequest(`/interviews/${encodeURIComponent(id)}/notebook/cell/${encodeURIComponent(cellId)}/run`, {
    method: "POST", body: JSON.stringify({ token, code }),
  }),
  submitAll: async (id, token) => normalizeWrittenEvaluation(await interviewApiRequest(`/interviews/${encodeURIComponent(id)}/notebook/submit-all`, {
    method: "POST", body: JSON.stringify({ token }),
  })),
  generateReport: (id) => interviewApiRequest(`/interviews/${encodeURIComponent(id)}/generate-report`, { method: "POST" }),
  calendar: (query = "") => interviewApiRequest(`/calendar/events${query}`),
  createCalendarEvent: (payload) =>
    interviewApiRequest("/calendar/events", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateCalendarEvent: (id, payload) =>
    interviewApiRequest(`/calendar/events/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteCalendarEvent: (id) =>
    interviewApiRequest(`/calendar/events/${encodeURIComponent(id)}`, { method: "DELETE" }),
  dashboard: (id) =>
    interviewApiRequest(`/company/interviews/${encodeURIComponent(id)}/dashboard`),
  proctoringEvents: (id) =>
    interviewApiRequest(`/interviews/${encodeURIComponent(id)}/proctoring/events`),
  report: (id) => interviewApiRequest(`/interviews/${encodeURIComponent(id)}/report`),
  deleteUserRecords: (profileId, payload) =>
    interviewApiRequest(`/admin/users/${encodeURIComponent(profileId)}`, {
      method: "DELETE",
      body: JSON.stringify(payload),
    }),
};

export async function loadPrivateAsset(source) {
  if (!source) return null;
  if (/^https?:\/\//i.test(source)) {
    return { url: source, revoke: false, contentType: "" };
  }
  if (!supabase) throw new ApiError("Supabase is not configured", 0, "AUTH_CONFIG");
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) {
    throw new ApiError("Please sign in with Google", 401, "AUTH_REQUIRED");
  }

  const response = await fetch(`${API_URL}${source}`, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      Accept: "application/pdf, image/*, application/octet-stream",
    },
  });
  if (!response.ok) {
    throw new ApiError("Could not load the private verification asset", response.status);
  }
  const blob = await response.blob();
  return { url: URL.createObjectURL(blob), revoke: true, contentType: blob.type };
}

export async function loadPrivateInterviewAsset(source) {
  if (!source) return null;
  if (!supabase) throw new ApiError("Supabase is not configured", 0, "AUTH_CONFIG");
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) {
    throw new ApiError("Please sign in with Google", 401, "AUTH_REQUIRED");
  }

  let response = null;
  let requestError = null;
  for (const requestBase of localApiAlternatives(INTERVIEW_API_URL)) {
    try {
      const request = privateInterviewAssetRequest(source, requestBase, window.location.origin, session.access_token);
      response = await fetch(request.url, { headers: request.headers });
      break;
    } catch (reason) {
      requestError = reason;
      // Try the next local hostname, matching normal API requests.
    }
  }
  if (!response) throw new ApiError(requestError?.message || "Could not reach the interview service", 0, "API_UNAVAILABLE");
  if (!response.ok) throw new ApiError("Could not load the applicant answer PDF", response.status);
  const blob = await response.blob();
  return { url: URL.createObjectURL(blob), revoke: true, contentType: blob.type };
}
