/**
 * Floating placement controls: confirm the object position and show why a position is rejected.
 */
import { Icon } from "../ui/Icon";

export interface PlacementControlsProps {
  confirmDisabled: boolean;
  placementError: string;
  onConfirm: () => void;
}

export function PlacementControls({ confirmDisabled, placementError, onConfirm }: PlacementControlsProps) {
  return (
    <div className="stage-floating-controls placement-controls" data-testid="placement-controls">
      <button
        className="nb-btn nb-btn--green"
        data-testid="btn-confirm-placement"
        disabled={confirmDisabled}
        onClick={onConfirm}
      >
        <Icon name="check" size={22} stroke={3} />
        Taruh di sini
      </button>
      {placementError && <span className="placement-controls__error">{placementError}</span>}
    </div>
  );
}
