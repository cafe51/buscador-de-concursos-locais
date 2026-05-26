// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: ["192.168.0.11"],
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb', // 🚀 Aumenta o limite de upload para 5 Megabytes
    },
  },
};

export default nextConfig;
