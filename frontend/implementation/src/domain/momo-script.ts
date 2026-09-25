/**
 * FR-14: Momo is a contextual companion / pattern reader.
 * It may show short state-driven text bubbles. It must NEVER create the
 * student's object, decide for the student, or imply it can (lore invariant).
 * All lines are placeholder copy — final Momo visual/voice remains unlocked.
 */

export type MomoMoment =
  | "level-entry"
  | "drawing-cue"
  | "drawing-empty"
  | "predicting"
  | "provider-error"
  | "top3-compare"
  | "decision-accepted"
  | "decision-corrected"
  | "decision-overridden"
  | "solid-consequence"
  | "danger-consequence"
  | "fallback-consequence"
  | "cycle-success"
  | "cycle-fail"
  | "level-complete";

/** Placeholder guidance lines keyed by app state. */
const LINES: Record<MomoMoment, string> = {
  "level-entry": "Halo! Aku Momo. Aku bisa membaca pola gambarmu — tapi aku tidak bisa menggambar. Kamu satu-satunya Illustrator di sini.",
  "drawing-cue": "Gambar objekmu di kanvas. Aku akan menebak apa yang kamu buat.",
  "drawing-empty": "Kanvasnya masih kosong. Gambar sesuatu dulu ya.",
  predicting: "Sedang kubaca pola goresanmu…",
  "provider-error": "Aku gagal membaca polanya sekarang. Tidak masalah — coba lagi atau gambar ulang.",
  "top3-compare": "Ini tiga tebakanku dengan tingkat keyakinannya. Confidence bukan jaminan benar — bandingkan dulu.",
  "decision-accepted": "Kamu setuju dengan tebakan peringkat 1. Keputusan bagus kalau kamu sudah yakin.",
  "decision-corrected": "Kamu memilih tebakan lain dari Top-3. Bagus, kamu membandingkan dulu.",
  "decision-overridden": "Kamu menolak semua tebankan dan memilih sendiri. Kamu yang paling tahu ciptaanmu.",
  "solid-consequence": "Objekmu jadi pijakan yang kokoh. Silakan lewat!",
  "danger-consequence": "Objek itu berbahaya di halaman ini… hati-hati!",
  "fallback-consequence": "Hmm, aku belum tahu perilaku objek ini. Kuberikan versi netral dulu.",
  "cycle-success": "Berhasil! Kamu bisa mengulang siklus atau lanjut.",
  "cycle-fail": "Tidak apa-apa gagal. Coba putuskan lagi, atau gambar ulang objekmu.",
  "level-complete": "Bab ini selesai! Keputusanmu tadi yang menentukan jalannya cerita.",
};

export function momoLine(moment: MomoMoment): string {
  return LINES[moment];
}
