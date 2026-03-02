import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  root: "client",
  server: {
    port: 9614,
    proxy: {
      "/api": {
        target: "http://localhost:9615",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:9615",
        ws: true,
      },
    },
  },
});
