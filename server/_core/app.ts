import "dotenv/config";
import express, { type Express } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";

/**
 * Builds the API without binding a port.
 *
 * Split out from the entrypoint so the same app can run two ways: a long-lived
 * server locally (`server/_core/index.ts`), and a serverless handler on Vercel
 * (`api/index.ts`), where nothing may call `listen`.
 *
 * Static files are deliberately not served here — Vercel serves the built
 * client itself, and the local entrypoint adds Vite or the static handler.
 */
export function createApp(): Express {
  const app = express();

  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ limit: "5mb", extended: true }));

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  return app;
}
