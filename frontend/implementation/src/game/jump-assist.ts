/**
 * Forgiving jump timing for a 50 Hz fixed-step platformer.
 *
 * Evidence (docs/execution/PHASE0_BASELINE_AUDIT.md): KAPLAY drops `isGrounded()` one fixed step (20 ms) after
 * the body leaves a platform and a render frame can be 65 ms on weak devices, so a jump pressed "at the edge" is
 * lost. Two standard, bounded assists:
 *  - coyote time: a jump is still allowed for COYOTE_STEPS after walking off a ledge (never after a jump);
 *  - jump buffer: a jump pressed up to BUFFER_STEPS before landing fires on landing.
 * Both are tiny (100 ms), do not change jump height/speed/gravity, and can be disabled by setting the steps to 0.
 * Owner note: control feel is not locked in governance; this is an implemented-but-pending-ratification tuning.
 */
export const COYOTE_STEPS = 5;
export const JUMP_BUFFER_STEPS = 5;

export class JumpAssist {
  private coyote = 0;
  private buffer = 0;
  private prevHeld = false;
  constructor(private readonly coyoteSteps = COYOTE_STEPS, private readonly bufferSteps = JUMP_BUFFER_STEPS) {}

  /** Call once per fixed step. Returns true when a jump must be executed this step. */
  step(grounded: boolean, jumpHeld: boolean): boolean {
    if (jumpHeld && !this.prevHeld) this.buffer = this.bufferSteps; // fresh press
    this.prevHeld = jumpHeld;
    if (grounded) this.coyote = this.coyoteSteps;

    const canJump = grounded || this.coyote > 0;
    const wants = jumpHeld || this.buffer > 0;
    if (wants && canJump) {
      this.coyote = 0; // no double jump out of coyote
      this.buffer = 0;
      return true;
    }
    if (!grounded && this.coyote > 0) this.coyote -= 1;
    if (this.buffer > 0) this.buffer -= 1;
    return false;
  }

  reset(): void { this.coyote = 0; this.buffer = 0; this.prevHeld = false; }
}
