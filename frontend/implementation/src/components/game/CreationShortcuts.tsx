/**
 * "Geser <label>" buttons that let the student pick an earlier creation back up for repositioning.
 */
import type { WorldCreation } from "@/src/game/creation-store";
import { Icon } from "../ui/Icon";
import styles from "./game-stage.module.css";

export interface CreationShortcutsProps {
  creations: WorldCreation[];
  onSelect: (creation: WorldCreation) => void;
}

export function CreationShortcuts({ creations, onSelect }: CreationShortcutsProps) {
  return (
    <div className={styles.objects}>
      {creations.map((creation, index) => (
        <button key={creation.id} className="nb-btn btn-small" data-testid={`reposition-${index}`} onClick={() => onSelect(creation)}>
          <Icon name="swap" size={17} />
          {creation.label} {index + 1}
        </button>
      ))}
    </div>
  );
}
