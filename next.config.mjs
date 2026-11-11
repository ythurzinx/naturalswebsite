import { securityHeaders } from "./security-headers.mjs";
const staticExport = process.env.STATIC_EXPORT === "1";
/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  ...(staticExport
    ? { output: "export", trailingSlash: true }
    : {
        async headers() {
          return [
            {
              source: "/(.*)",
              headers: securityHeaders(process.env.NODE_ENV !== "production"),
            },
          ];
        },
      }),
};
