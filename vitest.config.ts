import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
    },
  },
  test: {
    environment: "node",
    environmentMatchGlobs: [["client/**/*.test.tsx", "jsdom"]],
    // jsdom بلا matchMedia ولا IntersectionObserver، وframer-motion يسألهما.
    setupFiles: [path.resolve(templateRoot, "client", "src", "test-setup.ts")],
    include: ["server/**/*.test.ts", "server/**/*.spec.ts", "shared/**/*.test.ts", "client/**/*.test.ts", "client/**/*.test.tsx"],
  },
});
