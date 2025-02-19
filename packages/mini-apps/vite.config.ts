import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import mkcert from "vite-plugin-mkcert";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "./dist"
  },
  base: "/"
});
