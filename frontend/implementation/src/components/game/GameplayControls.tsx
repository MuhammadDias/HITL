/**
 * Floating gameplay controls: the three on-screen movement buttons plus "Geser objek".
 */
import { Icon, type IconName } from "../ui/Icon";
import { DirectionButton } from "./DirectionButton";
import type { DirectionKey } from "./game-stage-types";

const DIRECTION_BUTTONS: ReadonlyArray<{
  dir: DirectionKey;
  testId: string;
  ariaLabel: string;
  icon: IconName;
  label: string;
  primary?: boolean;
}> = [
  { dir: "left", testId: "move-left", ariaLabel: "Gerak Kiri", icon: "arrow-left", label: "Kiri" },
  { dir: "right", testId: "move-right", ariaLabel: "Gerak Kanan", icon: "arrow-right", label: "Kanan" },
  { dir: "jump", testId: "move-jump", ariaLabel: "Lompat / Loncat", icon: "arrow-up", label: "Lompat", primary: true },
];

export interface GameplayControlsProps {
  heldDirs: DirectionKey[];
  onPress: (pointerId: number, dir: DirectionKey) => void;
  onRelease: (pointerId: number) => void;
  onReposition: () => void;
}

export function GameplayControls({ heldDirs, onPress, onRelease, onReposition }: GameplayControlsProps) {
  return (
    <div className="stage-floating-controls" data-testid="gameplay-controls">
      <div className="gameplay-controls__row">
        {DIRECTION_BUTTONS.map((button) => (
          <DirectionButton
            key={button.dir}
            {...button}
            pressed={heldDirs.includes(button.dir)}
            onPress={onPress}
            onRelease={onRelease}
          />
        ))}
      </div>
      <span className="gameplay-controls__sep" aria-hidden="true" />
      <button className="nb-btn btn-small" data-testid="btn-reposition" onClick={onReposition}>
        <Icon name="swap" size={19} />
        Geser objek
      </button>
    </div>
  );
}
