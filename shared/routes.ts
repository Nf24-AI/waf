import { SHARE_ROUTE } from "./meeting-share";

export const MEETING_ROUTES = {
  prepare: "/",
  display: "/display",
  /** Read-only, outside the password gate. The token is the credential. */
  shared: `${SHARE_ROUTE}/:token`,
} as const;
