import { env } from "../config/env";
import type { InteractionEventSink } from "../domain/events";
import type { DrawingInput, PredictionResult } from "../domain/types";

/**
 * Class-link session: a student opens `/?kelas=<token>`, picks their absen
 * number + name, and every human decision is recorded to the backend so the
 * teacher dashboard can review it. Without a class token nothing is sent.
 */
const TOKEN_KEY = "sketchbook.classToken";
const STUDENT_KEY = "sketchbook.classStudent";

export interface ClassInfo {
  token: string;
  className: string;
  schoolName: string;
  studentCount: number;
}

export interface ClassStudent {
  token: string;
  studentId: number;
  number: number;
  name: string;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Reads `?kelas=` from the URL (persisting it) or falls back to the stored token. */
export function captureClassToken(): string | null {
  if (typeof window === "undefined") return null;
  const fromUrl = new URLSearchParams(window.location.search).get("kelas");
  const store = storage();
  if (fromUrl) {
    if (store?.getItem(TOKEN_KEY) !== fromUrl) store?.removeItem(STUDENT_KEY);
    store?.setItem(TOKEN_KEY, fromUrl);
    return fromUrl;
  }
  return store?.getItem(TOKEN_KEY) ?? null;
}

export async function fetchClassInfo(token: string): Promise<ClassInfo> {
  const res = await fetch(`${env.apiBaseUrl}/api/join/${encodeURIComponent(token)}`);
  if (!res.ok) throw new Error(await errorDetail(res, "Link kelas tidak valid."));
  const body = (await res.json()) as { class_name: string; school_name: string; student_count: number };
  return { token, className: body.class_name, schoolName: body.school_name, studentCount: body.student_count };
}

export async function joinClass(token: string, number: number, name: string): Promise<ClassStudent> {
  const res = await fetch(`${env.apiBaseUrl}/api/join/${encodeURIComponent(token)}/students`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ number, name }),
  });
  if (!res.ok) throw new Error(await errorDetail(res, "Gagal mendaftar ke kelas."));
  const body = (await res.json()) as { student_id: number; number: number; name: string };
  const student: ClassStudent = { token, studentId: body.student_id, number: body.number, name: body.name };
  storage()?.setItem(STUDENT_KEY, JSON.stringify(student));
  return student;
}

export function readClassStudent(token: string | null): ClassStudent | null {
  if (!token) return null;
  try {
    const parsed = JSON.parse(storage()?.getItem(STUDENT_KEY) ?? "null") as ClassStudent | null;
    return parsed && parsed.token === token ? parsed : null;
  } catch {
    return null;
  }
}

async function errorDetail(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: unknown };
    return typeof body.detail === "string" ? body.detail : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Wraps a sink so `decision_made` events are also recorded for the class.
 * `snapshot` returns the drawing + prediction the decision was made on.
 */
export function withClassRecording(
  inner: InteractionEventSink,
  getStudent: () => ClassStudent | null,
  snapshot: () => { drawing: DrawingInput | null; prediction: PredictionResult | null },
): InteractionEventSink {
  return {
    emit(event) {
      inner.emit(event);
      if (event.kind !== "decision_made") return;
      const student = getStudent();
      const { drawing, prediction } = snapshot();
      if (!student || !drawing || !prediction) return;
      void fetch(`${env.apiBaseUrl}/api/submissions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          join_token: student.token,
          student_id: student.studentId,
          level_id: event.levelId,
          strokes: drawing.strokes.map((s) => s.map(({ x, y }) => ({ x, y }))),
          candidates: prediction.candidates,
          decision_type: event.decisionType,
          source_rank: event.sourceRank ?? null,
          final_label: event.finalLabel,
        }),
      }).catch(() => {
        // Recording must never break gameplay; the teacher just misses this answer.
      });
    },
  };
}
