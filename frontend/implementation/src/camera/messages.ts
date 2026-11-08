/**
 * Short, jargon-free Indonesian reasons shown to students when the camera or
 * hand tracking cannot be used. Every message is <= 8 words and ends with the
 * path that still works (mouse / keyboard), so the student is never stuck.
 */
export type CameraFailureReason =
  | "permission-denied"
  | "camera-unavailable"
  | "camera-busy"
  | "camera-lost"
  | "camera-failed"
  | "unsupported"
  | "model-error"
  | "tracker-error";

export const CAMERA_MESSAGES: Record<CameraFailureReason, string> = {
  "permission-denied": "Izin kamera ditolak. Pakai mouse atau keyboard.",
  "camera-unavailable": "Kamera tidak ditemukan. Pakai mouse atau keyboard.",
  "camera-busy": "Kamera sedang dipakai aplikasi lain.",
  "camera-lost": "Kamera terputus. Pakai mouse atau keyboard.",
  "camera-failed": "Kamera gagal dibuka. Pakai mouse atau keyboard.",
  unsupported: "Browser ini belum bisa pakai kamera.",
  "model-error": "Pelacak tangan gagal dimuat. Pakai mouse.",
  "tracker-error": "Pelacak tangan berhenti. Pakai mouse atau keyboard.",
};

export function messageFor(reason: CameraFailureReason): string {
  return CAMERA_MESSAGES[reason];
}

/** Map a getUserMedia / MediaPipe error to a student-facing reason. */
export function classifyCameraError(err: unknown): CameraFailureReason {
  const name = typeof err === "object" && err && "name" in err ? String((err as { name: unknown }).name) : "";
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (name === "NotAllowedError" || name === "SecurityError") return "permission-denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "camera-unavailable";
  if (name === "NotReadableError" || name === "AbortError") return "camera-busy";
  if (/model|asset|fileset|wasm|fetch|load/i.test(msg)) return "model-error";
  return "tracker-error";
}

/** Window event used to tell GlobalCamera (and any HUD) about hand-input status. */
export const HAND_STATUS_EVENT = "hand-input-status";
/** Window event the drawing UI already uses to switch pointer/hand. */
export const DRAWING_MODE_EVENT = "drawing-input-mode";
