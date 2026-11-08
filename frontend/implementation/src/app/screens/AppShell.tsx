/**
 * Static page chrome around every screen: the single demo tape, <main id="screens"> and footer.
 * The brand lives on the level-select page itself (it was a header that bled behind the game).
 */
import type { ReactNode } from "react";
import { DevBanner } from "@/src/components/shared/DevBanner";

export interface AppShellProps {
  mode: "mock" | "partner";
  onboarding?: boolean;
  children: ReactNode;
}

export function AppShell({ mode, onboarding = false, children }: AppShellProps) {
  return (
    <div id="app" className={onboarding ? "onboarding-app" : undefined}>
      <DevBanner mode={mode} />
      <main id="screens">{children}</main>
      <footer className="app-footer" />
    </div>
  );
}
