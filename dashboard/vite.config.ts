import { defineConfig } from "vite";

export default defineConfig({
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        useDefineForClassFields: false,
      },
    },
  },
  build: {
    outDir: "../gateway/public",
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:7328",
        changeOrigin: true,
      },
      "/komorebi.config.json": {
        target: "http://127.0.0.1:7328",
        changeOrigin: true,
      },
    },
  },
});

