import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// viteSingleFile inlines all JS/CSS into dist/index.html so the built app
// runs from a double-clicked file:// URL — no server needed.
export default defineConfig({
  base: "./",
  plugins: [react(), viteSingleFile()],
});
