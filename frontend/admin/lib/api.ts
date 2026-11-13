/** Typed client for the FastAPI admin endpoints (backend/app/dashboard.py). */

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");
export const GAME_URL = (process.env.NEXT_PUBLIC_GAME_URL ?? "http://localhost:3000").replace(/\/+$/, "");

const TOKEN_KEY = "momo.admin.token";

export type Decision = "accept" | "correct" | "override";
export type DecisionPercent = Record<Decision, number>;

export interface User {
  id: number;
  email: string;
  name: string;
  role: "superadmin" | "admin";
  school: { id: number; name: string } | null;
}

export interface ClassSummary {
  id: number;
  name: string;
  school_id: number;
  school_name: string;
  student_count: number;
  join_token: string;
  created_at: string;
  students_joined: number;
  total_submissions: number;
  percent: DecisionPercent;
  student_average_percent: DecisionPercent;
}

export interface StudentStats {
  id: number;
  number: number;
  name: string;
  total: number;
  counts: Record<Decision, number>;
  percent: DecisionPercent;
  avg_model_confidence: number | null;
}

export interface ClassDetail extends ClassSummary {
  stats: {
    total_submissions: number;
    students_joined: number;
    students_active: number;
    counts: Record<Decision, number>;
    percent: DecisionPercent;
    student_average_percent: DecisionPercent;
    students: StudentStats[];
  };
}

export interface Submission {
  id: number;
  level_id: string;
  decision_type: Decision;
  source_rank: number | null;
  final_label: string;
  candidates: { label: string; confidence: number }[];
  created_at: string;
  student_id: number;
  student_number: number;
  student_name: string;
}

export interface SchoolSummary {
  id: number;
  name: string;
  address: string;
  created_at: string;
  class_count: number;
  student_count: number;
  admin_count: number;
  submission_count: number;
}

export interface SchoolDetail {
  id: number;
  name: string;
  address: string;
  created_at: string;
  admins: { id: number; name: string; email: string; created_at: string }[];
  classes: ClassSummary[];
  students: {
    id: number;
    number: number;
    name: string;
    class_id: number;
    class_name: string;
    created_at: string;
    submission_count: number;
  }[];
}

export interface LevelDifficulty {
  level_id: string;
  name: string;
  enabled: boolean;
  /** 0 = raw model, 100 = hardest. */
  difficulty: number;
}

export interface DifficultySettings {
  levels: LevelDifficulty[];
  formula: { temperature_gain: number; swap_probability: number };
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Without storage the session lasts until the tab is closed.
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, `Tidak bisa menghubungi backend di ${API_URL}.`);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.detail;
    const message = typeof detail === "string" ? detail : Array.isArray(detail) ? "Isian belum valid." : `Error ${res.status}`;
    throw new ApiError(res.status, message);
  }
  return data as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("POST", "/api/auth/login", { email, password }),
  me: () => request<User>("GET", "/api/auth/me"),
  logout: () => request<{ ok: boolean }>("POST", "/api/auth/logout"),

  listSchools: () => request<SchoolSummary[]>("GET", "/api/schools"),
  createSchool: (name: string, address: string) => request<SchoolSummary>("POST", "/api/schools", { name, address }),
  getSchool: (id: number) => request<SchoolDetail>("GET", `/api/schools/${id}`),
  createAdmin: (schoolId: number, body: { name: string; email: string; password: string }) =>
    request<{ id: number }>("POST", `/api/schools/${schoolId}/admins`, body),

  getDifficulty: () => request<DifficultySettings>("GET", "/api/settings/difficulty"),
  saveDifficulty: (levels: Pick<LevelDifficulty, "level_id" | "enabled" | "difficulty">[]) =>
    request<{ levels: LevelDifficulty[] }>("PUT", "/api/settings/difficulty", { levels }),

  listClasses: (schoolId?: number) =>
    request<ClassSummary[]>("GET", `/api/classes${schoolId ? `?school_id=${schoolId}` : ""}`),
  createClass: (body: { name: string; student_count: number; school_id?: number }) =>
    request<ClassSummary>("POST", "/api/classes", body),
  getClass: (id: number) => request<ClassDetail>("GET", `/api/classes/${id}`),
  deleteClass: (id: number) => request<void>("DELETE", `/api/classes/${id}`),
  listSubmissions: (classId: number, filter: { studentId?: number; decision?: Decision } = {}) => {
    const q = new URLSearchParams();
    if (filter.studentId) q.set("student_id", String(filter.studentId));
    if (filter.decision) q.set("decision", filter.decision);
    const qs = q.toString();
    return request<Submission[]>("GET", `/api/classes/${classId}/submissions${qs ? `?${qs}` : ""}`);
  },
};

/** <img> cannot send headers, so the image endpoint accepts ?token=. */
export function submissionImageUrl(id: number): string {
  return `${API_URL}/api/submissions/${id}/image.png?token=${encodeURIComponent(getToken() ?? "")}`;
}

export function classLink(joinToken: string): string {
  return `${GAME_URL}/?kelas=${encodeURIComponent(joinToken)}`;
}

/** Downloads an authenticated export (CSV/ZIP) via a temporary blob URL. */
export async function downloadExport(classId: number, kind: "csv" | "zip"): Promise<void> {
  const res = await fetch(`${API_URL}/api/classes/${classId}/export.${kind}`, {
    headers: { authorization: `Bearer ${getToken() ?? ""}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(res.status, typeof data?.detail === "string" ? data.detail : `Export gagal (${res.status}).`);
  }
  const disposition = res.headers.get("content-disposition") ?? "";
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `kelas-${classId}.${kind}`;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const DECISION_LABEL: Record<Decision, string> = {
  accept: "Menerima",
  correct: "Merevisi",
  override: "Menolak",
};

export const DECISION_HINT: Record<Decision, string> = {
  accept: "Memakai tebakan #1 model",
  correct: "Memilih tebakan #2 atau #3",
  override: "Menolak semua tebakan, memberi label sendiri",
};
