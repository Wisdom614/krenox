import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    return [
      {
        source: "/wait",
        destination: "/waiting",
        permanent: true,
      },
      {
        source: "/register",
        destination: "/register-organisation",
        permanent: true,
      },
      {
        source: "/status",
        destination: "/register-organisation/status",
        permanent: true,
      },
      {
        source: "/setup",
        destination: "/setup-account",
        permanent: true,
      },
      {
        source: "/poster",
        destination: "/",
        permanent: false,
      },
      {
        source: "/q",
        destination: "/",
        permanent: false,
      },
      {
        source: "/queue/:slug",
        destination: "/q/:slug",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    const backendUrl =
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.BACKEND_URL ||
      "https://krenox-backend.onrender.com";
    return [
      {
        source: "/api/backend/:path*",
        destination: `${backendUrl.replace(/\/$/, "")}/:path*`,
      },
    ];
  },
};

export default nextConfig;
