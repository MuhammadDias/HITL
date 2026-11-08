/**
 * Small corner chip that states how the stage is currently controlled (hand tracking status or fallback).
 */
import type { ReactNode } from "react";

export function InputStatusChip({ children }: { children: ReactNode }) {
  return (
    <div className="stage-input-status-chip">
      <span role="status" data-testid="input-status">
        {children}
      </span>
    </div>
  );
}
