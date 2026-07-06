import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // 상대 경로 — GitHub Pages 서브경로(/crop-server/) 배포와 로컬 실행 모두 호환
  base: "./",
  plugins: [react()],
  server: { port: 5173, open: true },
});
