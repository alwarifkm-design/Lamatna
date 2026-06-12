export const EXIT_SAVE_FLAGS = {
  shouldPreserveSessionKey: "jamaatna_should_preserve_session",
} as const;

/**
 * Mark that we want to preserve current room/player session on navigation away.
 * Used together with beforeunload.
 */
export function markPreserveSession(): void {
  try {
    sessionStorage.setItem(EXIT_SAVE_FLAGS.shouldPreserveSessionKey, "1");
  } catch {
    // ignore
  }
}

export function clearPreserveSession(): void {
  try {
    sessionStorage.removeItem(EXIT_SAVE_FLAGS.shouldPreserveSessionKey);
  } catch {
    // ignore
  }
}

/**
 * Called from beforeunload.
 * Return true if we should avoid resetting player/step on next load.
 */
export function shouldPreserveSession(): boolean {
  try {
    return sessionStorage.getItem(EXIT_SAVE_FLAGS.shouldPreserveSessionKey) === "1";
  } catch {
    return false;
  }
}

