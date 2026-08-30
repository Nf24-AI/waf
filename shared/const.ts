/** Legacy session cookie, still cleared on logout so old sessions do not linger. */
export const COOKIE_NAME = "app_session_id";

export const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export const AXIOS_TIMEOUT_MS = 30_000;

export const UNAUTHED_ERR_MSG = "Unauthorized";
export const NOT_ADMIN_ERR_MSG = "Forbidden";

/**
 * How long the workspace may sit untouched before it locks itself.
 *
 * The window is idle-based, not absolute: any request the workspace makes
 * re-issues the session cookie, so a session in use never expires under the
 * user, while a page left open on a desk locks ten minutes later.
 */
export const IDLE_MINUTES = 10;
export const IDLE_MS = IDLE_MINUTES * 60 * 1000;

/**
 * How much of the idle window is spent asking before it locks.
 *
 * Locking without warning loses whatever was half-typed into a meeting note.
 * The last minute is given over to the question instead.
 */
export const IDLE_WARN_MS = 60 * 1000;
