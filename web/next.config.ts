import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Vet records and visit photos are uploaded through server actions.
    // Photos are shrunk in the browser first, but phones that can't shrink
    // (e.g. HEIC outside Safari) may send a few full-size files at once.
    serverActions: { bodySizeLimit: "40mb" },
    proxyClientMaxBodySize: "40mb",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
