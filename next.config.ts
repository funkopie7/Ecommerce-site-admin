import type { NextConfig } from "next";

/* The admin's Images and Galleries screens render hundreds of product photos
   as small thumbnails. They were marked `unoptimized`, which means the browser
   downloads the full stored file — around 130KB each — to draw a 96px square.
   Browsing one page of Galleries pulled well over ten megabytes from Supabase
   storage, and that screen is used a lot.

   Optimising them instead costs one transformation per image at one width,
   cached for a year, and drops each thumbnail to a few kilobytes. The size
   lists are cut to just the two widths these screens ask for, so no photo can
   quietly generate a dozen encodes.

   See the storefront's next.config.ts for the full account of how the 60
   second default TTL and Supabase's no-cache header combined to exhaust the
   image quota. */
const nextConfig: NextConfig = {
  typedRoutes: true,
  images: {
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
