import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // The installed launcher has no .env, so the service URLs from desktop/.env are
  // inlined into the main bundle at build time (read as import.meta.env.*).
  main: { plugins: [externalizeDepsPlugin()], envPrefix: ["MAIN_VITE_", "WEB_URL", "API_URL", "VR_API_URL"] },
  // Sandboxed Electron preload scripts must be bundled as CommonJS.
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { output: { format: "cjs" } } },
  },
  renderer: { plugins: [react()] },
});
