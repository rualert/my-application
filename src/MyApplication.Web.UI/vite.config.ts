import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Дев-сервер проксирует /Notes и /Auth на локально запущенный API (см. README),
// чтобы в разработке не настраивать CORS — в проде тот же эффект даёт nginx
// (см. nginx.conf.template рядом с Dockerfile.web-ui). Один origin важен и для refresh-cookie
// (httpOnly, выставляется API) — она должна быть того же origin, что и фронт.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/Notes": {
        target: "http://localhost:5184",
        changeOrigin: true,
      },
      "/Auth": {
        target: "http://localhost:5184",
        changeOrigin: true,
      },
    },
  },
});
