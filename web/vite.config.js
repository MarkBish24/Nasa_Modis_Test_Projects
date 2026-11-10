import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" makes every asset path relative, so the built site works from any
// GitHub Pages sub-path (https://<user>.github.io/<repo>/) without changes.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
