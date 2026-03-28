import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output bundles everything needed to run on EC2 without node_modules
  output: "standalone",

  // Allow the backend API origin in production
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
    ];
  },
};

export default nextConfig;
