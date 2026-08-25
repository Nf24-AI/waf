import { createApp } from "../server/_core/app";

/**
 * Vercel serverless entrypoint.
 *
 * Vercel routes every `/api/*` request here and serves the built client from
 * `dist/public` itself, so this handler only carries the tRPC API. Exporting
 * the Express app directly is the supported shape for the Node runtime.
 */
export default createApp();
