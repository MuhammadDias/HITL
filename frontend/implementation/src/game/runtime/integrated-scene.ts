/**
 * The integrated (stage artwork) scene: a falling object is placed, committed and then the
 * Thinman plays through the level. Owns the scene's mutable game state and exposes it as a
 * KaplayGameHandle. Placement, commit and re-select logic live here because they all mutate
 * the same pending/committed bookkeeping.
 */
import type { KAPLAYCtx } from "kaplay";
import { STICKMAN_ASSET } from "../assets/stickman-svg";
import { CharacterRuntimeBridge } from "../character/character-runtime-bridge";
import type { WorldCreation } from "../creation-store";
import { JumpAssist } from "../jump-assist";
import { getStageGeometry, type StageGeometry } from "../stage-geometry";
import { CharacterSpriteLayer } from "./character-sprite";
import { FALL_DURATION, FALL_START_Y, GRAVITY, JUMP_FORCE, PLAYER_HEIGHT, PLAYER_WIDTH } from "./constants";
import { createCreationRenderer } from "./creation-renderer";
import { cloneCreation, createPendingCreation } from "./creations";
import { releaseEngine } from "./engine";
import { resolveHorizontalMovementIntent } from "./movement";
import { integratedGoalReached, integratedPlacementAllowed } from "./rules";
import { writeIntegratedTelemetry } from "./telemetry";
import type {
  DirectionInput,
  GameOutcome,
  GamePhase,
  KaplayGameHandle,
  KaplayGameOptions,
  SceneObject,
} from "./types";
import { buildStageWorld, playerSpawnPoint, type PlayerObject } from "./world-setup";

const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 450;
const FIXED_STEP_SECONDS = 1 / 60;
/** Desktop landscape level 1 starts at world x=0: keep the rendered sprite inside the left edge. */
const DESKTOP_MIN_WIDTH = 761;
const noInput = (): DirectionInput => ({ left: false, right: false, jump: false });

/** Custom data the scene attaches to hazard objects (stage hazards and "danger" creations). */
interface HazardInfo {
  creationBehavior?: string;
  label?: string;
  geometryId?: string;
}

function fitIntegratedViewport(k: KAPLAYCtx, canvas: HTMLCanvasElement): void {
  k.camPos(k.vec2(WORLD_WIDTH / 2, WORLD_HEIGHT / 2));
  k.camScale(k.vec2(1, 1));
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / WORLD_WIDTH, rect.height / WORLD_HEIGHT);
  Object.assign(canvas.dataset, {
    worldScale: String(scale),
    worldOffsetX: String((rect.width - WORLD_WIDTH * scale) / 2),
    worldOffsetY: String((rect.height - WORLD_HEIGHT * scale) / 2),
  });
}

function hazardFailReason(hazard: HazardInfo | undefined): string {
  if (hazard?.creationBehavior === "danger") {
    return `Menyentuh objek berbahaya (${hazard.label || "bahaya"})!`;
  }
  if (hazard?.geometryId?.includes("spike")) return "Jatuh ke lantai duri!";
  return "Menabrak rintangan bahaya!";
}

class IntegratedScene {
  private readonly geometry: StageGeometry;
  private readonly sceneScale: number;
  private readonly player: PlayerObject;
  private readonly characterBridge = new CharacterRuntimeBridge();
  private readonly character: CharacterSpriteLayer;
  private readonly jumpAssist = new JumpAssist();
  private readonly drawCreation: (item: WorldCreation, committed: boolean) => SceneObject;
  private readonly fall: ReturnType<KAPLAYCtx["tween"]>;
  /** Committed creations (data) and their rendered art. */
  private readonly creations: Map<string, WorldCreation>;
  private readonly rendered = new Map<string, SceneObject>();

  private phase: GamePhase = "falling";
  private settled = false;
  private destroyed = false;
  private input: DirectionInput = noInput();
  private pending: WorldCreation;
  private pendingArt: SceneObject;

  constructor(
    private readonly k: KAPLAYCtx,
    private readonly o: KaplayGameOptions,
    labelFont: string,
  ) {
    const geometry = getStageGeometry(o.level.stage);
    this.geometry = geometry;
    this.sceneScale = (1.1 * geometry.world.width) / geometry.source.width;
    this.creations = new Map((o.creations ?? []).map((item) => [item.id, cloneCreation(item)]));
    this.pending = createPendingCreation(o, geometry);

    const fit = () => fitIntegratedViewport(k, o.canvas);
    fit();
    k.onResize(fit);
    k.setGravity(GRAVITY);
    this.player = buildStageWorld(k, geometry);
    // Pausing skips fixedUpdate and interpolation; static prevents collision displacement.
    this.stopPlayer();

    this.character = new CharacterSpriteLayer({
      k,
      canvas: o.canvas,
      player: this.player,
      bridge: this.characterBridge,
      stage: o.level.stage,
      sceneScale: this.sceneScale,
      isDestroyed: () => this.destroyed,
    });

    this.drawCreation = createCreationRenderer(k, labelFont, () => this.destroyed);
    for (const item of this.creations.values()) {
      this.rendered.set(item.id, this.drawCreation(item, true));
    }
    this.pendingArt = this.drawCreation({ ...this.pending, y: FALL_START_Y }, false);

    this.fall = k.tween(
      FALL_START_Y,
      this.pending.y,
      FALL_DURATION,
      (y) => {
        if (!this.destroyed && this.phase === "falling") this.pendingArt.pos.y = y;
      },
      k.easings.easeOutCubic,
    );
    this.fall.onEnd(() => {
      if (!this.destroyed) this.enterPlace();
    });

    this.registerCollisions();
    // Input shares the body's fixed cadence; render stalls must not batch movement.
    k.onFixedUpdate(() => this.fixedStep());
    k.onUpdate(() => this.update());
    this.writeTelemetry();
  }

  /** The handle the GameController drives the scene with. */
  handle(): KaplayGameHandle {
    return {
      destroy: () => this.destroy(),
      setInput: (i) => this.setInput(i),
      onFallComplete: () => this.enterPlace(),
      setPlacement: (x, y) => this.setPlacement(x, y),
      selectCreation: (id) => this.selectCreation(id),
      commitPlacementAt: (x, y) => this.commitPlacementAt(x, y),
      retry: () => this.retry(),
      reposition: () => {
        this.selectCreation(this.pending.id);
      },
    };
  }

  // ---- lifecycle -------------------------------------------------------------------------

  private destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.characterBridge.dispose();
    this.fall.cancel();
    releaseEngine(this.k);
  }

  private setInput(i: DirectionInput): void {
    this.input =
      this.phase === "gameplay" && !this.settled
        ? { left: Boolean(i?.left), right: Boolean(i?.right), jump: Boolean(i?.jump) }
        : noInput();
  }

  // ---- player ----------------------------------------------------------------------------

  /** Freeze the player: no input, no velocity, static and paused. */
  private stopPlayer(): void {
    this.input = noInput();
    this.jumpAssist.reset();
    this.player.vel = this.k.vec2(0, 0);
    this.player.isStatic = true;
    this.player.paused = true;
  }

  /** Put the player back at the spawn with a fresh body (clears stale interpolation and platform state). */
  private resetPlayer(): void {
    const { k, o, player } = this;
    this.jumpAssist.reset();
    delete o.canvas.dataset.outcome;
    delete o.canvas.dataset.failReason;
    const spawn = playerSpawnPoint(this.geometry);
    player.pos = k.vec2(spawn.x, spawn.y);
    const frozen = this.phase !== "gameplay";
    player.unuse("body");
    player.use(k.body({ isStatic: frozen }));
    player.paused = frozen;
    player.isStatic = frozen;
    this.settled = false;
  }

  private playerAlive(): boolean {
    return !this.destroyed && Boolean(this.player?.exists?.()) && Boolean(this.player.pos);
  }

  // ---- outcome ---------------------------------------------------------------------------

  private reportOutcome(result: GameOutcome, reason?: string): void {
    if (this.settled || this.phase !== "gameplay") return;
    this.settled = true;
    this.stopPlayer();
    this.o.canvas.dataset.outcome = result;
    if (reason) this.o.canvas.dataset.failReason = reason;
    this.writeTelemetry();
    this.o.onOutcome(result, reason);
  }

  private registerCollisions(): void {
    const { player } = this;
    const hazardContact = (hazardObj?: unknown) => {
      this.reportOutcome("fail", hazardFailReason(hazardObj as HazardInfo | undefined));
    };
    const goalContact = () => {
      const body = { x: player.pos.x, y: player.pos.y, w: PLAYER_WIDTH, h: PLAYER_HEIGHT };
      if (integratedGoalReached(body, this.geometry.goal)) this.reportOutcome("success");
    };
    player.onCollide("hazard", hazardContact);
    player.onCollide("goal", goalContact);
    player.onCollideUpdate("goal", goalContact);
    player.onCollideUpdate("hazard", hazardContact);
  }

  // ---- placement -------------------------------------------------------------------------

  private snapshot(): WorldCreation[] {
    return [...this.creations.values()].map(cloneCreation);
  }

  /** Fall animation finished (or was skipped): the object waits to be placed. */
  private enterPlace(): void {
    if (this.phase !== "falling") return;
    this.phase = "placing";
    this.pendingArt.pos = this.k.vec2(this.pending.x, this.pending.y);
    this.stopPlayer();
    this.writeTelemetry();
    this.o.onFallComplete();
  }

  private setPlacement(x: number, y: number): boolean {
    if (
      this.phase !== "placing" ||
      !integratedPlacementAllowed({ ...this.pending, x, y }, this.geometry, this.snapshot(), this.pending.id)
    ) {
      return false;
    }
    this.pending = { ...this.pending, x, y };
    this.pendingArt.pos = this.k.vec2(x, y);
    this.writeTelemetry();
    return true;
  }

  /** Pick an already committed creation back up (or re-pick the pending one) for repositioning. */
  private selectCreation(id: string): boolean {
    if (this.phase === "falling") return false;
    const item = this.creations.get(id);
    if (!item) return false;
    if (this.phase === "placing") {
      if (this.pending.id === id) return true;
      this.pendingArt.destroy();
      const previous = this.creations.get(this.pending.id);
      if (previous && !this.rendered.has(previous.id)) {
        this.rendered.set(previous.id, this.drawCreation(previous, true));
      }
    }
    this.stopPlayer();
    this.rendered.get(id)?.destroy();
    this.rendered.delete(id);
    this.pending = cloneCreation(item);
    this.pendingArt = this.drawCreation(this.pending, false);
    this.phase = "placing";
    this.resetPlayer();
    this.writeTelemetry();
    this.o.onReposition();
    return true;
  }

  /** Lock the pending object in at (x, y) and start the play phase. */
  private commitPlacementAt(x: number, y: number): boolean {
    if (!this.setPlacement(x, y)) return false;
    this.pendingArt.destroy();
    this.rendered.get(this.pending.id)?.destroy();
    this.creations.set(this.pending.id, cloneCreation(this.pending));
    this.pendingArt = this.drawCreation(this.pending, true);
    this.rendered.set(this.pending.id, this.pendingArt);
    this.phase = "gameplay";
    this.resetPlayer();
    const { dataset } = this.o.canvas;
    Object.assign(dataset, {
      commitX: String(x),
      commitY: String(y),
      commitId: this.pending.id,
      commitCount: String(Number(dataset.commitCount ?? 0) + 1),
    });
    this.writeTelemetry();
    this.o.onCreationsChange?.(this.snapshot());
    this.o.onCommitPlacement();
    return true;
  }

  private retry(): void {
    if (this.phase !== "gameplay") return;
    this.stopPlayer();
    this.resetPlayer();
    this.writeTelemetry();
  }

  // ---- frame loops -----------------------------------------------------------------------

  private fixedStep(): void {
    const { player } = this;
    if (!this.playerAlive()) return;
    const resolvedVx = resolveHorizontalMovementIntent(this.input, this.phase === "gameplay", this.settled);
    this.characterBridge.update(
      {
        x: player.pos.x,
        y: player.pos.y,
        vx: player.vel?.x ?? 0,
        vy: player.vel?.y ?? 0,
        resolvedVx,
        grounded: Boolean(player.isGrounded?.()),
        facing: this.characterBridge.getFacing(),
        terminalPhase: this.settled ? (this.o.canvas.dataset.outcome === "success" ? "win" : "fail") : undefined,
      },
      FIXED_STEP_SECONDS,
    );
    this.character.syncFromBridge();
    if (this.phase !== "gameplay" || this.settled) return;
    player.move(resolvedVx, 0);
    if (
      this.o.level.stage === 1 &&
      globalThis.innerWidth >= DESKTOP_MIN_WIDTH &&
      globalThis.innerWidth > globalThis.innerHeight
    ) {
      player.pos.x = Math.max(player.pos.x, STICKMAN_ASSET.foot.x * this.sceneScale - PLAYER_WIDTH / 2 + 2);
    }
    if (this.jumpAssist.step(Boolean(player.isGrounded?.()), this.input.jump)) player.jump(JUMP_FORCE);
  }

  private update(): void {
    if (!this.playerAlive()) return;
    if (this.phase === "gameplay" && !this.settled && this.player.pos.y > this.geometry.killY) {
      this.reportOutcome("fail", "Jatuh ke jurang!");
    }
    this.writeTelemetry();
  }

  private writeTelemetry(): void {
    if (!this.playerAlive()) return;
    const pendingArt = this.pendingArt?.exists?.() && this.pendingArt.pos ? this.pendingArt : null;
    writeIntegratedTelemetry({
      canvas: this.o.canvas,
      phase: this.phase,
      settled: this.settled,
      player: this.player,
      pendingArt,
      pending: this.pending,
      committed: this.creations,
      committedSnapshot: this.snapshot(),
      geometry: this.geometry,
    });
  }
}

export function createIntegratedScene(k: KAPLAYCtx, o: KaplayGameOptions, labelFont: string): KaplayGameHandle {
  return new IntegratedScene(k, o, labelFont).handle();
}
