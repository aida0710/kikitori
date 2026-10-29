import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// 開発中は API サーバー（既定 http://127.0.0.1:8780）へ /api と /v1 を中継する
const apiServer = process.env.KIKITORI_API_SERVER ?? "http://127.0.0.1:8780";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": apiServer,
      "/v1": { target: apiServer, ws: true },
    },
  },
});
