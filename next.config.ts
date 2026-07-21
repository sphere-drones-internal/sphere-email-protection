import type { NextConfig } from "next";

// Content-Security-Policy is set per-request in src/proxy.ts instead, since it
// needs a fresh nonce on every response — a static header here can't carry one.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // Standalone output → a self-contained server bundle the container runs with
  // `node server.js`, no full node_modules in the runtime image.
  output: "standalone",
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;