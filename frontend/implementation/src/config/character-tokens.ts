/**
 * Centralized character display name tokens.
 * Preview candidate: Thinman — NOT academically finalized.
 * Fallback when empty/blank: Stickman.
 * No identifier/route/test ID rename; only display copy.
 */

export const DEFAULT_CHARACTER_NAME = "Thinman";
export const FALLBACK_CHARACTER_NAME = "Stickman";

/**
 * Resolves the character display name from a user-provided or config value.
 * - undefined/null/empty/whitespace => fallback Stickman
 * - otherwise trimmed value
 */
export function resolveCharacterDisplayName(
  input?: string | null,
): string {
  if (input === undefined || input === null) {
    return DEFAULT_CHARACTER_NAME;
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return FALLBACK_CHARACTER_NAME;
  }
  return trimmed;
}

/**
 * Interpolates the character display name into a template string.
 * Template must contain {character} placeholder.
 */
export function formatCharacterText(
  template: string,
  characterDisplayName?: string | null,
): string {
  const name = resolveCharacterDisplayName(characterDisplayName);
  return template.replace(/\{character\}/g, name);
}
