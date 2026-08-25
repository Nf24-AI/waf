import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

/**
 * Request context.
 *
 * Identity used to come from Manus OAuth, which only resolves inside the Manus
 * platform. Access is now a single-user password gate that reads the session
 * cookie off the request, so the context only needs req/res.
 */
export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  return { req: opts.req, res: opts.res };
}
