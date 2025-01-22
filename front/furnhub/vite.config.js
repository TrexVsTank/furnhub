//vite.config.js
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path"; // Node.js 경로 모듈 추가

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"), // @를 src 폴더로 매핑
    },
  },
  logLevel: "info",
});
