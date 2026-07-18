import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  base: process.env.NODE_ENV === "production" ? "/Web-tools/video-compressor/dist" : "/",
  integrations: [react()],
  output: "static",
  vite: {
    worker: {
      format: "es",
    },
  },
});
