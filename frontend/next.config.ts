import type { NextConfig } from "next";

// Production builds are a static export that the FastAPI server serves alongside the API (one process to deploy).
// In development, `next dev` proxies /api to FastAPI so cookies and paths match production.
const isBuild = process.env.NODE_ENV === "production";
const API = process.env.MINDLY_API ?? "http://localhost:8001";

const nextConfig: NextConfig = isBuild
  ? { output: "export", trailingSlash: true, images: { unoptimized: true } }
  : {
      devIndicators: false,
      trailingSlash: true,
      skipTrailingSlashRedirect: true, // keep /api/* paths exactly as FastAPI expects them
      async rewrites() {
        return [{ source: "/api/:path*", destination: `${API}/api/:path*` }];
      },
    };

export default nextConfig;
