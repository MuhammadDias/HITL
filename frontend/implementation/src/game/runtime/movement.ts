/**
 * Pure horizontal movement rule shared by physics and the character animation.
 */
import { WALK_SPEED } from "./constants";

/** Resolved horizontal velocity for the current input; zero outside live gameplay or once settled. */
export function resolveHorizontalMovementIntent(
  input: { left: boolean; right: boolean },
  gameplay: boolean,
  settled: boolean,
): number {
  return gameplay && !settled
    ? (Number(Boolean(input.right)) - Number(Boolean(input.left))) * WALK_SPEED
    : 0;
}
