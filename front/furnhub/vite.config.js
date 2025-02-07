//vite.config.js
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path"; // Node.js 경로 모듈 추가

// https://vitejs.dev/config/
export default defineConfig({
  base: "/furnhub/",
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  logLevel: "info",
  build: {
    outDir: "dist",
  },
  server: {
    host: '0.0.0.0',
    port: 8081,
  },
});
