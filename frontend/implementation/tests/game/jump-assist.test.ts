import { describe, expect, it } from "vitest";
import { JumpAssist, COYOTE_STEPS, JUMP_BUFFER_STEPS } from "../../src/game/jump-assist";

describe("JumpAssist (coyote time + jump buffer)", () => {
  it("jumps immediately when grounded and jump is held", () => {
    expect(new JumpAssist().step(true, true)).toBe(true);
  });
  it("coyote: a jump pressed within the window after leaving a ledge still fires, once", () => {
    const a = new JumpAssist();
    a.step(true, false);
    for (let i = 0; i < COYOTE_STEPS - 1; i++) expect(a.step(false, false)).toBe(false);
    expect(a.step(false, true)).toBe(true);
    expect(a.step(false, true)).toBe(false); // no double jump
  });
  it("coyote expires: a jump pressed after the window is rejected", () => {
    const a = new JumpAssist();
    a.step(true, false);
    for (let i = 0; i < COYOTE_STEPS + 1; i++) a.step(false, false);
    expect(a.step(false, true)).toBe(false);
  });
  it("no coyote jump after a real jump (cannot jump again in the air)", () => {
    const a = new JumpAssist();
    expect(a.step(true, true)).toBe(true);
    for (let i = 0; i < 3; i++) expect(a.step(false, true)).toBe(false);
  });
  it("buffer: a jump pressed just before landing fires on landing", () => {
    const a = new JumpAssist();
    a.step(true, true); // jump
    a.step(false, false);
    expect(a.step(false, true)).toBe(false); // press in air, too early
    let fired = false;
    for (let i = 0; i < JUMP_BUFFER_STEPS - 2; i++) { a.step(false, false); }
    fired = a.step(true, false); // landed within the buffer
    expect(fired).toBe(true);
  });
  it("buffer expires if landing is too late", () => {
    const a = new JumpAssist();
    a.step(true, true); a.step(false, false);
    a.step(false, true); a.step(false, false);
    for (let i = 0; i < JUMP_BUFFER_STEPS + 2; i++) a.step(false, false);
    expect(a.step(true, false)).toBe(false);
  });
  it("reset clears pending assists", () => {
    const a = new JumpAssist(); a.step(true, false); a.reset();
    expect(a.step(false, true)).toBe(false);
  });
});
