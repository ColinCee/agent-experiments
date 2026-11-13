import { copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { defineConfig } from "vitest/config";

// The Python package ships the built page as package data and injects each day's report into it.
const packagedPage = fileURLToPath(new URL("../src/agent_experiments/dashboard.html", import.meta.url));

const copyToPackage: Plugin = {
  name: "copy-to-package",
  apply: "build",
  async writeBundle(options) {
    await copyFile(`${options.dir}/index.html`, packagedPage);
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile(), copyToPackage],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: { port: 5199, strictPort: true },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test-setup.ts"],
  },
});
