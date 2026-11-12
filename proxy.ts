import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { contentSecurityPolicy } from "./security-headers.mjs";
import { canonicalPageRedirect } from "./lib/canonical-host.mjs";

export function proxy(request: NextRequest) {
  const canonical = canonicalPageRedirect(
    request.url,
    process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "",
    request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      "",
  );
  if (canonical) {
    const response = NextResponse.redirect(canonical, 308);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    return response;
  }
  const nonce = randomBytes(18).toString("base64");
  const policy = contentSecurityPolicy(
    process.env.NODE_ENV !== "production",
    nonce,
  );
  const headers = new Headers(request.headers);
  // Replace any supplied nonce/CSP; only the server may choose this value.
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|images/|.*\\..*).*)",
  ],
};
