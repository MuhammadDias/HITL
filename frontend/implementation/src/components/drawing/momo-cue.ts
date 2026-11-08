/**
 * Which Momo moment and speech line the drawing screen shows for the current flow phase.
 */
import type { MomoMoment } from "@/src/domain/momo-script";

export type DrawingPhase = "drawing" | "predicting" | "evaluating" | "prediction-error";

export interface MomoCue {
  moment: MomoMoment;
  /** `undefined` lets the bubble use its own default line for the moment. */
  message: string | string[] | undefined;
}

export function resolveMomoCue(feedback: string | null, visualPhase: DrawingPhase): MomoCue {
  if (feedback === "empty-drawing") return { moment: "drawing-empty", message: undefined };
  switch (visualPhase) {
    case "drawing":
      return { moment: "drawing-cue", message: "Gambar objekmu dulu, ya. Nanti aku coba tebak!" };
    case "predicting":
      return { moment: "predicting", message: "Hmm... ini gambar apa, ya?" };
    case "evaluating":
      return {
        moment: "top3-compare",
        message: ["Aku punya tiga tebakan. Bandingkan dulu, ya.", "Persen bukan jaminan benar. Kamu yang memutuskan."],
      };
    default:
      return { moment: "provider-error", message: "Hmm, aku belum bisa membaca gambarmu. Mau coba lagi?" };
  }
}
