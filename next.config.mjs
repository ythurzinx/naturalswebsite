import { securityHeaders } from "./security-headers.mjs";
/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders(process.env.NODE_ENV !== "production"),
      },
    ];
  },
};
