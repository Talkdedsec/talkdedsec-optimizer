import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import desktop from "vite-plugin-electron/simple";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    desktop({
      main: { entry: "core/main.ts", vite: { build: { outDir: "dist-core" } } },
      preload: { input: "core/preload.ts", vite: { build: { outDir: "dist-core" } } },
    }),
  ],
});
