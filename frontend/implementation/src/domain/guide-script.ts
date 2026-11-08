/**
 * What Momo says on every page before the drawing starts. Momo guides each page like a chat contact:
 * short lines, one at a time, always pointing at the next thing to do. No parentheses (M-012). Display only:
 * Momo never decides or creates anything (lore invariant).
 */
import type { MomoMood } from "./momo-script";

export interface GuideStep {
  lines: string[];
  mood: MomoMood;
}

/** The cover: Momo sleeps until the camera is on (later: until the student waves; the wave detector is not the wake-up yet). */
export const COVER_WAKE: GuideStep = {
  mood: "Senang",
  lines: [
    "Halo! Aku Momo.",
    "Aku bakal nemenin kamu keliling dunia buku gambar ini.",
    "Yuk mulai dari nomor absenmu. Pakai penggaris ya.",
  ],
};

export const NUMBER_STEP: GuideStep = {
  mood: "Penasaran",
  lines: ["Geser penggarisnya sampai pas di nomor absenmu.", "Sudah pas? Tekan Lanjut."],
};

export const NUMBER_TAKEN_STEP: GuideStep = {
  mood: "Bingung",
  lines: ["Nomor itu sudah ada yang pakai. Geser ke nomor lain ya."],
};

export type TutorialMoment = "deal" | "walk" | "walk-done" | "safety" | "gesture" | "gesture-done";

export function tutorialStep(moment: TutorialMoment, characterName: string): GuideStep {
  switch (moment) {
    case "deal":
      return { mood: "Senang", lines: ["Ada tiga kartu panduan. Kita buka satu-satu ya."] };
    case "walk":
      return { mood: "Semangat", lines: [`Coba geser tanganmu ke kanan dan kiri. Ajak ${characterName} jalan ke bendera.`] };
    case "walk-done":
      return { mood: "Senang", lines: [`Mantap, ${characterName} sampai! Tekan Lanjut.`] };
    case "safety":
      return { mood: "Berpikir", lines: ["Benda padat jadi pijakan. Benda tajam berbahaya.", "Sudah paham? Tekan Lanjut."] };
    case "gesture":
      return { mood: "Semangat", lines: ["Sekarang coret kanvasnya, lalu coba mundur.", "Dua gestur itu yang bikin tombol Mulai terbuka."] };
    case "gesture-done":
      return { mood: "Senang", lines: ["Kamu sudah siap! Tekan Mulai Level 1."] };
  }
}

/** The level list: Momo points at the newest unlocked chapter. */
export function levelListStep(unlocked: number): GuideStep {
  if (unlocked <= 1) return { mood: "Semangat", lines: ["Ini bab-bab bukunya.", "Pilih Bab 1, lalu tarik pitanya ke bawah."] };
  if (unlocked === 2) return { mood: "Senang", lines: ["Bab 2 sudah kebuka!", "Pilih Bab 2 dan tarik pitanya ke bawah."] };
  return { mood: "Senang", lines: ["Semua bab sudah kebuka!", "Pilih bab yang mau kamu mainkan, lalu tarik pitanya."] };
}
