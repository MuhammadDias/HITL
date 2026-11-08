/**
 * World HUD, top row. Left: whose world this is and what the student decided (icon + the label only).
 * Right: hand-control toggle and "Gambar lagi". Everything is icon + short word; no parenthesised hints.
 */
import { Icon, type IconName } from "../ui/Icon";
import { ThinmanArt } from "../ui/ThinmanArt";
import type { HumanDecision } from "@/src/domain/types";
import type { InputMode } from "./game-stage-types";

const DECISION_ICON: Record<HumanDecision["type"], IconName> = {
  accept: "check",
  correct: "swap",
  override: "pencil",
};

const DECISION_NAME: Record<HumanDecision["type"], string> = {
  accept: "Terima",
  correct: "Pilih lain",
  override: "Bukan ketiganya",
};

export interface StageHeaderProps {
  characterName: string;
  decision: HumanDecision;
  integrated: boolean | undefined;
  mode: InputMode;
  /** The shared camera stream is live, so hand control may be offered. */
  handAvailable: boolean;
  onToggleHandControl: () => void;
  onToggleCameraNui: () => void;
  onDrawAgain: () => void;
}

export function StageHeader({
  characterName,
  decision,
  integrated,
  mode,
  handAvailable,
  onToggleHandControl,
  onToggleCameraNui,
  onDrawAgain,
}: StageHeaderProps) {
  const cameraOn = mode === "camera";
  return (
    <div className="stage-floating-header hud">
      <div className="hud-plate nb-card">
        <span className="hud-plate__mark" aria-hidden="true">
          <ThinmanArt />
        </span>
        <h2 className="hud-plate__title">Dunia {characterName}</h2>
        <span className="hud-plate__sep" aria-hidden="true" />
        <span
          className="nb-chip nb-chip--leaf decision-chip"
          title={`${DECISION_NAME[decision.type]}${decision.type !== "override" ? `, peringkat ${decision.sourceRank}` : ""}`}
        >
          <span className="nb-chip__badge" aria-hidden="true">
            <Icon name={DECISION_ICON[decision.type]} size={13} stroke={3.2} />
          </span>
          {decision.finalLabel}
        </span>
      </div>
      <div className="hud-actions">
        {integrated && (handAvailable || cameraOn) && (
          <button
            className="nb-btn btn-small"
            data-testid="btn-hand-control"
            aria-pressed={cameraOn}
            onClick={onToggleHandControl}
          >
            <Icon name={cameraOn ? "pointer" : "hand-draw"} size={20} />
            {cameraOn ? "Pakai keyboard" : "Kontrol tangan"}
          </button>
        )}
        {!integrated && (
          <button className="nb-btn btn-small" onClick={onToggleCameraNui}>
            <Icon name="camera" size={20} />
            {cameraOn ? "Pakai keyboard atau pointer" : "Nyalakan kamera"}
          </button>
        )}
        <button className="nb-btn nb-btn--primary btn-small" data-testid="btn-draw-again" onClick={onDrawAgain}>
          <Icon name="pencil" size={20} />
          Gambar lagi
        </button>
      </div>
    </div>
  );
}
