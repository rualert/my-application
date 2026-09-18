import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Дев-сервер проксирует /Notes на локально запущенный API (см. README),
// чтобы в разработке не настраивать CORS — в проде тот же эффект даёт nginx
// (см. nginx.conf рядом с Dockerfile).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/Notes": {
        target: "http://localhost:5184",
        changeOrigin: true,
      },
    },
  },
});
