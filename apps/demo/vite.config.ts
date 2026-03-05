import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const backendPort = process.env.WORKERS_DEV ? 8787 : 9615;

export default defineConfig({
  plugins: [react()],
  root: "client",
  server: {
    port: 9614,
    proxy: {
      "/api": {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
      },
      "/ws": {
        target: `ws://localhost:${backendPort}`,
        ws: true,
      },
    },
  },
});
