/**
 * Physics and presentation constants of the KAPLAY runtime. Changing any value changes game feel.
 */

/** Thinman is drawn a little smaller than the physics body so Momo (the interactive mascot) reads as the bigger one. Collider unchanged. */
export const CHARACTER_VISUAL_SCALE = 0.88;

export const GRAVITY = 1600;
/** Horizontal walking speed in world px/s. */
export const WALK_SPEED = 200;
export const JUMP_FORCE = 520;

/** The player's collider (feet on the body bottom). */
export const PLAYER_WIDTH = 24;
export const PLAYER_HEIGHT = 40;

/** Falling object tween: start y, duration and the pending object's resting "fall start" y in the integrated scene. */
export const FALL_START_Y = 5;
export const FALL_DURATION = 0.85;
