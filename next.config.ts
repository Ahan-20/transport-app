import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output produces a self-contained server.js with only the
  // node_modules it actually needs — keeps the Docker image small and
  // cold starts fast on Railway.
  output: "standalone",

  // better-sqlite3 and bcryptjs ship native bindings; Next.js shouldn't try
  // to bundle them — load them from node_modules at runtime instead.
  serverExternalPackages: ["better-sqlite3", "bcryptjs"],

  // Belt-and-braces: tell Next.js's file tracer to ignore data/ and any DB
  // files. Our .dockerignore already keeps these out of the build context,
  // but if someone runs `next build` locally with a populated data/ folder
  // we don't want PII or the local DB silently bundled into .next/standalone.
  outputFileTracingExcludes: {
    "*": [
      "./data/**",
      "**/*.db",
      "**/*.db-shm",
      "**/*.db-wal",
      "**/*.xlsx",
      "**/*.docx",
    ],
  },

  // Tighten production output.
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  devIndicators: false,
};

export default nextConfig;
