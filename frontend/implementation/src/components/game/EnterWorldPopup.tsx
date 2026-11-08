/**
 * Offers the decided object to the world; the world only starts once the student enters it.
 */
import type { DrawingInput, ObjectBehavior } from "@/src/domain/types";
import { generateSketchDataUri } from "@/src/game/sketch-renderer";
import { Icon } from "../ui/Icon";

export interface EnterWorldPopupProps {
  label: string;
  behavior: ObjectBehavior;
  drawingInput: DrawingInput | null;
  onEnter: () => void;
  onRedraw: () => void;
}

export function EnterWorldPopup({ label, behavior, drawingInput, onEnter, onRedraw }: EnterWorldPopupProps) {
  return (
    <div className="enter-world-popup nb-card" role="dialog" aria-label="Masukkan objek ke dunia" data-testid="enter-world-popup">
      <span className="enter-world-popup__tape" aria-hidden="true" />
      <div className="enter-world-popup__sheet">
        {/* eslint-disable-next-line @next/next/no-img-element -- generated data URI preview of the student's own sketch */}
        <img
          className="enter-preview"
          alt={`Sketsa ${label}`}
          src={generateSketchDataUri(drawingInput, { width: 220, height: 96, behavior, label, pixelScale: 3 })}
        />
      </div>
      <p className="enter-label">{label}</p>
      <button className="nb-btn nb-btn--primary enter-world-popup__go" data-testid="btn-enter-world" onClick={onEnter}>
        <Icon name="flag" size={20} />
        Masukkan ke dunia
      </button>
      <button className="nb-btn nb-btn--ghost btn-small" data-testid="btn-redraw" onClick={onRedraw}>
        <Icon name="pencil" size={18} />
        Gambar ulang
      </button>
    </div>
  );
}
