import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" keeps asset paths relative, so the build also works on GitHub Pages
// sub-paths and inside the live preview proxy.
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { host: "0.0.0.0", port: 5173, allowedHosts: true },
  preview: { host: "0.0.0.0", port: 4173, allowedHosts: true },
});
