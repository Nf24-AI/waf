import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

// The Manus runtime plugin and debug collector were removed: they injected a
// script into every page and wrote browser logs to .manus-logs, which only
// served the Manus platform this project no longer runs on.

export default defineConfig({
  plugins: [react(), tailwindcss(), jsxLocPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // One 700KB chunk made the first paint wait on everything. React and the
        // data layer change rarely, so they cache separately from app code.
        manualChunks: {
          react: ["react", "react-dom", "react/jsx-runtime"],
          data: ["@trpc/client", "@trpc/react-query", "@tanstack/react-query", "superjson"],
        },
      },
    },
  },
  server: {
    host: true,
    allowedHosts: ["localhost", "127.0.0.1"],
    fs: { strict: true, deny: ["**/.*"] },
  },
});
