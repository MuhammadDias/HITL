import React, { useEffect, useRef } from "react";
import type { MissionConfig } from "../../domain/mission-config";
import { MomoChat } from "../momo/MomoChat";
import { Icon, objectIconFor } from "../ui/Icon";
import styles from "./MissionBriefing.module.css";

export interface MissionBriefingProps {
  isOpen: boolean;
  config: MissionConfig;
  onStartDrawing: () => void;
  onClose?: () => void;
  characterDisplayName?: string;
}

/**
 * Mission hint, told by Momo as chat with the helpful objects as icons (no walls of text).
 * Independent of the Top-3 card. Accessible with role="dialog", aria-modal="true", escape handling,
 * focus trap and focus return.
 */
export function MissionBriefing({
  isOpen,
  config,
  onStartDrawing,
  onClose,
}: MissionBriefingProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryBtnRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Parents pass inline handlers; keep the latest in refs so the listener effect only depends on isOpen.
  const dismissRef = useRef<() => void>(() => undefined);
  const tabRef = useRef<(e: KeyboardEvent) => void>(() => undefined);

  // Close handler: falls back to onClose or onStartDrawing
  const handleDismiss = () => {
    if (onClose) {
      onClose();
    } else {
      onStartDrawing();
    }
  };

  // Focus trap handler - always handle Tab to ensure proper cycling in test env
  const handleTabKey = (event: KeyboardEvent) => {
    if (!isOpen || !dialogRef.current) return;

    const focusableElements = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex=\"-1\"])"
      )
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0]!;
    const lastElement = focusableElements[focusableElements.length - 1]!;
    const activeElement = document.activeElement as HTMLElement;

    if (event.key === "Tab") {
      event.preventDefault();

      if (event.shiftKey) {
        // Shift+Tab: move to previous element
        if (activeElement === firstElement || !focusableElements.includes(activeElement)) {
          lastElement.focus();
        } else {
          const currentIndex = focusableElements.indexOf(activeElement);
          focusableElements[currentIndex - 1]!.focus();
        }
      } else {
        // Tab: move to next element
        if (activeElement === lastElement || !focusableElements.includes(activeElement)) {
          firstElement.focus();
        } else {
          const currentIndex = focusableElements.indexOf(activeElement);
          focusableElements[currentIndex + 1]!.focus();
        }
      }
    }
  };

  dismissRef.current = handleDismiss;
  tabRef.current = handleTabKey;

  // Keyboard navigation, Escape handling, and focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        dismissRef.current();
      }
    };
    const handleTab = (event: KeyboardEvent) => tabRef.current(event);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keydown", handleTab);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keydown", handleTab);
    };
  }, [isOpen]);

  // Initial focus on primary action when opened
  useEffect(() => {
    if (isOpen) {
      // Capture the opener ONLY on the closed->open edge (re-renders used to overwrite it with the dialog's own button).
      previouslyFocusedRef.current = document.activeElement as HTMLElement;
      primaryBtnRef.current?.focus();
    } else if (previouslyFocusedRef.current && previouslyFocusedRef.current.isConnected) {
      // Restore focus to previously focused element when closed
      previouslyFocusedRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const titleId = "mission-briefing-title";
  const descId = "mission-briefing-desc";

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleDismiss();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={styles.sheet}
      >
        <button
          ref={closeBtnRef}
          type="button"
          className={styles.closeButton}
          onClick={handleDismiss}
          aria-label="Tutup Petunjuk Misi"
        >
          <Icon name="close" size={20} stroke={3} />
        </button>

        <h2 id={titleId} className="visually-hidden">
          {config.title}
        </h2>

        <MomoChat
          lines={[config.title, config.instruction]}
          mood="Senang"
          avatarHeight={190}
          typing={false}
          stack
          testId="mission-chat"
        >
          {config.examples.length > 0 && (
            <ul className={styles.examplesList} aria-label="Benda yang bisa membantu">
              {config.examples.map((item) => (
                <li key={item.labelId} className={styles.exampleChip}>
                  <Icon name={objectIconFor(item.labelId)} size={26} stroke={2.2} />
                  <span>{item.displayName}</span>
                </li>
              ))}
            </ul>
          )}
        </MomoChat>

        {/* The thumb is the "go" gesture everywhere (win, story, hint); there is no skip. */}
        <button ref={primaryBtnRef} type="button" className="gesture-cue" onClick={onStartDrawing}>
          <span className="gesture-cue__hand">
            <Icon name="thumb-up" size={30} stroke={2.2} />
          </span>
          <span className="gesture-cue__label">{config.primaryCtaLabel}</span>
        </button>
      </div>
    </div>
  );
}
