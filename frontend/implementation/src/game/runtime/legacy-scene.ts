/**
 * Legacy (non-integrated) scene: the original stand-alone sketchbook world with a flat ground,
 * a gap, a flag and the decided object dropped into the gap. Kept as is apart from formatting.
 */
import type { KAPLAYCtx } from "kaplay";
import { isLegalPlacement, worldOutcome } from "../placement-rules";
import { worldViewport } from "../world-viewport";
import { releaseEngine } from "./engine";
import type { GameOutcome, KaplayGameHandle, KaplayGameOptions } from "./types";

export function createLegacyScene(
  k: KAPLAYCtx,
  o: KaplayGameOptions,
  labelFont: string,
  pixelDensity: number,
): KaplayGameHandle {
  function fitViewport() {
    const rect = o.canvas.getBoundingClientRect();
    const v = worldViewport(rect.width, rect.height, pixelDensity);
    k.camScale(k.vec2(v.scale, v.scale));
    k.camPos(k.vec2(400, 190));
    o.canvas.dataset.worldScale = String(v.scale);
    o.canvas.dataset.worldOffsetX = String(v.offsetX);
    o.canvas.dataset.worldOffsetY = String(v.offsetY);
  }
  fitViewport();
  k.onResize(fitViewport);

  // Draw subtle sketchbook dot-grid on the canvas (22px spacing)
  for (let gx = 11; gx < 800; gx += 22) {
    for (let gy = 11; gy < 380; gy += 22) {
      k.add([k.circle(1.2), k.pos(gx, gy), k.color(49, 45, 38), k.opacity(0.14)]);
    }
  }
  const groundY = 320;
  const scene = o.level.scene;
  const width = scene.gapWidth + 24;
  const height = 8;
  let phase = "falling";
  let settled = false;
  let destroyed = false;
  let x = scene.gapStartX - 10;
  let input = { left: false, right: false, jump: false };
  let objectBody = false;
  k.setGravity(1600);
  for (const seg of [
    { start: 0, end: scene.gapStartX },
    { start: scene.gapStartX + scene.gapWidth, end: 800 },
  ]) {
    k.add([
      k.rect(seg.end - seg.start, 60),
      k.pos(seg.start, groundY),
      k.color(195, 92, 52),
      k.outline(2, k.rgb(35, 33, 29)),
      k.area(),
      k.body({ isStatic: true }),
      "ground",
    ]);
  }
  // Flag pole
  k.add([k.rect(4, 64), k.pos(scene.goalX + 12, groundY - 64), k.color(35, 33, 29)]);
  // Flag banner (olive green #A5C48A)
  k.add([
    k.polygon([
      k.vec2(scene.goalX + 16, groundY - 64),
      k.vec2(scene.goalX + 42, groundY - 50),
      k.vec2(scene.goalX + 16, groundY - 36),
    ]),
    k.color(165, 196, 138),
    k.outline(2, k.rgb(35, 33, 29)),
  ]);
  // Goal collision area
  k.add([k.rect(32, 64), k.pos(scene.goalX + 6, groundY - 64), k.area(), k.opacity(0), "goal"]);
  k.add([k.rect(width, 8), k.pos(scene.gapStartX - 10, groundY + 6), k.color(80, 180, 120), k.opacity(0.3)]);
  const player = k.add([k.rect(24, 40), k.pos(40, groundY - 40), k.area(), k.body(), k.opacity(0), "player"]);
  stop();
  // Stickman graphics attached to the real collision body.
  player.add([k.circle(7), k.pos(12, 7), k.color(26, 26, 26)]);
  player.add([k.rect(3, 16), k.pos(11, 14), k.color(26, 26, 26)]);
  for (const points of [
    [[12, 18], [2, 26]],
    [[12, 18], [22, 26]],
    [[12, 28], [3, 40]],
    [[12, 28], [21, 40]],
  ]) {
    player.add([
      k.polygon([
        k.vec2(points[0]![0]!, points[0]![1]!),
        k.vec2(points[1]![0]!, points[1]![1]!),
        k.vec2(points[1]![0]! + 2, points[1]![1]!),
      ]),
      k.color(26, 26, 26),
    ]);
  }
  const solidWood = [170, 130, 85]; // warm wood brown
  const dangerTerracotta = [195, 92, 52]; // terracotta red-orange (same as ground)
  const neutralGray = [140, 150, 160];
  const color = o.behavior === "solid" ? solidWood : o.behavior === "danger" ? dangerTerracotta : neutralGray;
  const obj = k.add([
    k.rect(width, height),
    k.pos(x, 5),
    k.color(color[0]!, color[1]!, color[2]!),
    k.outline(2, k.rgb(26, 26, 26)),
    k.area(),
    "decided-object",
  ]);
  const label = obj.add([k.text(o.finalLabel, { size: 13, font: labelFont }), k.pos(0, -20), k.color(50, 40, 30)]);
  void label;
  if (o.drawingInput) {
    for (const stroke of o.drawingInput.strokes) {
      for (let j = 1; j < stroke.length; j++) {
        const a = stroke[j - 1];
        const b = stroke[j];
        if (!a || !b || a.x == null || b.x == null) continue;
        obj.add([
          k.polygon([
            k.vec2(a.x * width, a.y * 12),
            k.vec2(b.x * width, b.y * 12),
            k.vec2(b.x * width + 1, b.y * 12 + 1),
          ]),
          k.color(20, 20, 20),
        ]);
      }
    }
  }

  function stop() {
    input = { left: false, right: false, jump: false };
    player.vel = k.vec2(0, 0);
    player.isStatic = true;
    player.paused = true;
  }
  function removeCollider() {
    if (objectBody) {
      obj.unuse("body");
      objectBody = false;
    }
    obj.unuse("hazard");
  }
  function resetPlayer() {
    delete o.canvas.dataset.outcome;
    player.pos = k.vec2(40, groundY - 40);
    player.unuse("body");
    player.use(k.body({ isStatic: phase !== "gameplay" }));
    player.paused = phase !== "gameplay";
    player.isStatic = phase !== "gameplay";
    settled = false;
  }
  function report(result: GameOutcome) {
    if (settled || phase !== "gameplay") return;
    settled = true;
    stop();
    o.onOutcome(result);
  }
  function setPlacement(nextX: number, nextY: number) {
    if (phase !== "placing") return false;
    const legal = isLegalPlacement(nextX, nextY, width, height);
    if (legal) {
      x = nextX;
      obj.pos = k.vec2(x, nextY);
    }
    return legal;
  }
  function enterPlace() {
    if (phase !== "falling") return;
    phase = "placing";
    obj.pos = k.vec2(x, groundY);
    stop();
    o.onFallComplete();
  }
  // Falling visual has area for picking only; no body/collider until confirmed.
  const fall = k.tween(
    5,
    groundY,
    0.85,
    (y) => {
      if (!destroyed) obj.pos.y = y;
    },
    k.easings.easeOutCubic,
  );
  fall.onEnd(() => {
    if (!destroyed) enterPlace();
  });
  player.onCollide("hazard", () => report("fail"));
  player.onCollide("goal", () => {
    if (phase === "gameplay") report("success");
  });
  k.onUpdate(() => {
    if (destroyed || !player?.exists?.() || !obj?.exists?.() || !player.pos || !obj.pos) return;
    o.canvas.dataset.objectY = String(Math.round(obj.pos.y));
    o.canvas.dataset.phase = phase;
    o.canvas.dataset.playerX = String(Math.round(player.pos.x));
    o.canvas.dataset.playerY = String(Math.round(player.pos.y));
    o.canvas.dataset.objectX = String(Math.round(x));
    o.canvas.dataset.objectCount = "1";
    if (phase !== "gameplay" || settled) return;
    player.move((Number(Boolean(input.right)) - Number(Boolean(input.left))) * 200, 0);
    if (input.jump && player.isGrounded?.()) player.jump(520);
    const result = worldOutcome({
      phase,
      x: player.pos.x,
      y: player.pos.y,
      goal: scene.goalX,
      grounded: Boolean(player.isGrounded?.()),
      hazard: false,
    });
    if (result) report(result);
  });
  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      fall.cancel();
      releaseEngine(k);
    },
    setInput(i) {
      input =
        phase === "gameplay" && !settled
          ? { left: Boolean(i?.left), right: Boolean(i?.right), jump: Boolean(i?.jump) }
          : { left: false, right: false, jump: false };
    },
    onFallComplete() {
      enterPlace();
    },
    setPlacement,
    commitPlacementAt(nextX, nextY) {
      if (phase !== "placing" || !isLegalPlacement(nextX, nextY, width, height)) return false;
      x = nextX;
      obj.pos = k.vec2(nextX, nextY);
      removeCollider();
      if (o.behavior === "solid") {
        obj.use(k.body({ isStatic: true }));
        objectBody = true;
      }
      if (o.behavior === "danger") obj.use("hazard");
      phase = "gameplay";
      resetPlayer();
      o.onCommitPlacement();
      return true;
    },
    retry() {
      if (phase !== "gameplay") return;
      stop();
      resetPlayer();
    },
    reposition() {
      if (phase !== "gameplay") return;
      stop();
      removeCollider();
      phase = "placing";
      obj.pos = k.vec2(x, o.canvas.dataset.objectY ? Number(o.canvas.dataset.objectY) : groundY);
      resetPlayer();
      o.onReposition();
    },
  };
}
