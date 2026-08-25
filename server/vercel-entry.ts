import { createApp } from "./_core/app";

/**
 * Vercel serverless entrypoint.
 *
 * Bundled by `build:api` into `api/index.js` rather than shipped as source.
 * The package is ESM ("type": "module"), and Vercel's own transpile leaves
 * relative imports extensionless — invalid in native ESM, which crashed the
 * function on boot with FUNCTION_INVOCATION_FAILED. Bundling resolves every
 * import ahead of time so nothing is left to resolve at runtime.
 */
export default createApp();
