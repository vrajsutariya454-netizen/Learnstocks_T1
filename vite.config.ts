import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { componentTagger } from "lovable-tagger"

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 8080,
    proxy: {
      // Proxy requests starting with /advisor-api to the investment-advisor app
      // This avoids CORS during local development. The frontend should call
      // `/advisor-api/api/chat` which will be forwarded to http://localhost:3000/api/chat
      "/advisor-api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/advisor-api/, ""),
      },
      "/py-api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/py-api/, ""),
      },
    },
  },
}))