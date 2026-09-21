import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:4000";

const nextConfig: NextConfig = {
  // Required by the Dockerfile: produces .next/standalone for the
  // production image's `node frontend/server.js` entrypoint.
  output: "standalone",
  // Allow the Freebuff preview proxy host to fetch dev assets
  allowedDevOrigins: ["*.daytonaproxy01.net"],
  async rewrites() {
    return [
      // Proxy AgentAuth API calls to the NestJS core engine (same-origin for the browser)
      { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
      // JWKS public key endpoint
      { source: "/.well-known/:path*", destination: `${backendUrl}/.well-known/:path*` },
    ];
  },
};

export default nextConfig;
