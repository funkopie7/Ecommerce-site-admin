import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  images: {
    unoptimized: true,
    minimumCacheTTL: 60 * 60 * 24 * 365,
    deviceSizes: [640, 1080],
    imageSizes: [96, 128, 256],
    formats: ["image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "rkeesplvgrriqmztpeje.supabase.co" },
      { protocol: "https", hostname: "uzdrfxatgdevbtopriwo.supabase.co" },
    ],
  },
};
export default nextConfig;
