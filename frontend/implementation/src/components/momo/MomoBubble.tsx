import { momoLine, type MomoMoment } from "@/src/domain/momo-script";

/**
 * TASK 11 — Momo boundary: replaceable avatar slot + state-driven text bubble.
 * No chat input, no speech, no LLM, never creates objects or decides (lore).
 * Final mascot artwork arrives later via this slot only.
 */
export function MomoBubble({ moment, message }: { moment: MomoMoment; message?: string }) {
  return (
    <div className="momo">
      {/* REPLACEABLE ASSET SLOT — DEV/PLACEHOLDER artwork, do not treat as final. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny local placeholder SVG; optimization adds nothing here */}
      <img
        className="momo-avatar"
        src="/assets/momo-placeholder/momo.svg"
        alt="Momo (placeholder)"
        width={44}
        height={52}
      />
      <div className="momo-bubble" role="status">
        {message ?? momoLine(moment)}
      </div>
    </div>
  );
}
