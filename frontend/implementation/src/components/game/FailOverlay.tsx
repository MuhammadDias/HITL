/**
 * The student failed the level: Momo says it kindly in chat and offers three icon actions
 * (retry from checkpoint, move the same object, draw again).
 */
import { MomoChat } from "../momo/MomoChat";
import { Icon } from "../ui/Icon";

export interface FailOverlayProps {
  failReason: string;
  onRetry: () => void;
  onReposition: () => void;
  onRedraw: () => void;
}

export function FailOverlay({ failReason, onRetry, onReposition, onRedraw }: FailOverlayProps) {
  return (
    <div className="world-fail" data-testid="outcome-overlay">
      <MomoChat
        lines={["Belum berhasil, tidak apa-apa.", ...(failReason ? [failReason] : [])]}
        mood="Sedih"
        avatarHeight={190}
        extrasFrom="first"
        testId="fail-chat"
      >
        <div className="world-fail__actions">
          <button className="nb-btn nb-btn--primary" data-testid="btn-retry-cycle" onClick={onRetry}>
            <Icon name="again" size={20} />
            Coba lagi
          </button>
          <button className="nb-btn" data-testid="btn-reposition" onClick={onReposition}>
            <Icon name="swap" size={20} />
            Geser objek
          </button>
          <button className="nb-btn" data-testid="btn-redraw-gameplay" onClick={onRedraw}>
            <Icon name="pencil" size={20} />
            Gambar ulang
          </button>
        </div>
      </MomoChat>
      <h3 className="overlay-title visually-hidden" data-testid="outcome-title">
        Belum berhasil
      </h3>
      {failReason && (
        <p data-testid="fail-reason" className="visually-hidden">
          {failReason}
        </p>
      )}
    </div>
  );
}
