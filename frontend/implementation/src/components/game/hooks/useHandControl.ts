/**
 * Optional hand control of the world stage: availability of the shared camera stream, the
 * GameplayHandDriver lifecycle (steering in gameplay, pinch-drag in placement) and the status text
 * shown to the student.
 */
import { useEffect, useState, type MutableRefObject } from "react";
import { getSharedStream } from "@/src/camera/shared-stream";
import type { GameplayHandDriver, GameplayStatus } from "@/src/input/gameplay-hand-driver";
import type { GameplayInput } from "./useGameplayInput";
import type { GameStageProps, StageOutcome, StagePhase } from "../game-stage-types";

const PREPARING_CAMERA = "Menyiapkan kamera";
const HAND_STATUS_POLL_MS = 1000;

const STATUS_TEXT: Record<GameplayStatus, string> = {
  tracking: "Tangan terbaca",
  "tracking-lost": "Tangan tidak terlihat",
  initializing: PREPARING_CAMERA,
  "camera-unavailable": "Kamera gagal, pakai keyboard",
  error: "Kamera gagal, pakai keyboard",
};

interface UseHandControlOptions {
  ready: boolean;
  phase: StagePhase;
  outcome: StageOutcome | null;
  integrated: boolean | undefined;
  input: GameplayInput;
  /** Always points at the newest props (the driver callbacks outlive renders). */
  latest: MutableRefObject<GameStageProps>;
  movePlacementToHandCursor: (cursor: { x: number; y: number }) => void;
}

export function useHandControl({
  ready,
  phase,
  outcome,
  integrated,
  input,
  latest,
  movePlacementToHandCursor,
}: UseHandControlOptions) {
  const [status, setStatus] = useState("NUI NOT VERIFIED");
  const [handAvailable, setHandAvailable] = useState(false);
  const { mode, setMode, arbiter, sendCombinedInput, releaseManualInput } = input;

  // Hand control is opt-in and only offered while the shared camera stream is live (no second permission prompt).
  useEffect(() => {
    if (!integrated) return;
    const check = () =>
      setHandAvailable(
        Boolean(getSharedStream()?.getVideoTracks().some((track) => track.readyState === "live")),
      );
    check();
    const id = window.setInterval(check, HAND_STATUS_POLL_MS);
    return () => window.clearInterval(id);
  }, [integrated]);

  useEffect(() => {
    sendCombinedInput();
    if (!ready || mode !== "camera" || outcome || (phase !== "placing" && phase !== "gameplay")) return;
    let cancelled = false;
    let driver: GameplayHandDriver | null = null;

    async function startDriver() {
      const { GameplayHandDriver: DriverClass } = await import("@/src/input/gameplay-hand-driver");
      if (cancelled) return;
      const video = document.querySelector<HTMLVideoElement>(".global-camera-host .camera-video");
      if (!video) {
        setStatus("Kamera belum tersedia · NUI NOT VERIFIED");
        return;
      }
      driver = new DriverClass({
        video,
        onStatus: (next) => {
          if (cancelled) return;
          setStatus(STATUS_TEXT[next]);
          if (next === "camera-unavailable") {
            arbiter.dispatch({ type: "camera", status: "revoked" });
            setMode("fallback");
            sendCombinedInput();
          }
        },
        onDiagnostic: (info) => {
          if (cancelled) return;
          if (info.message) setStatus(info.message);
          else if (info.delegate) setStatus("Tangan (" + info.delegate + ")");
        },
        onFrame: (frame) => {
          if (cancelled) return;
          arbiter.dispatch({
            type: "hand-frame",
            frame: {
              tracked: frame.tracked,
              cursor: frame.cursor ? { x: frame.cursor.x, y: frame.cursor.y } : null,
              pinched: frame.pinched,
              input: frame.input,
            },
          });
          if (!frame.tracked) {
            sendCombinedInput();
            return;
          }
          if (latest.current.phase === "gameplay") {
            sendCombinedInput();
          } else if (latest.current.phase === "placing" && frame.cursor && frame.pinched) {
            movePlacementToHandCursor(frame.cursor);
          }
        },
      });
      await driver.start();
      if (cancelled) void driver.stop();
    }
    void startDriver();

    return () => {
      cancelled = true;
      void driver?.stop();
      sendCombinedInput();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, mode, phase, outcome]);

  /** Integrated stage: the "Kontrol tangan" / "Pakai keyboard" toggle. */
  function toggleHandControl() {
    releaseManualInput();
    setMode(mode === "camera" ? "fallback" : "camera");
    setStatus(PREPARING_CAMERA);
    arbiter.dispatch({ type: "set-hand-enabled", enabled: mode !== "camera" });
    sendCombinedInput();
  }

  /** Stand-alone (legacy) stage: the "Nyalakan Kamera NUI" / FALLBACK toggle. */
  function toggleCameraNui() {
    releaseManualInput();
    sendCombinedInput();
    setMode(mode === "camera" ? "fallback" : "camera");
  }

  return { status, handAvailable, toggleHandControl, toggleCameraNui };
}
