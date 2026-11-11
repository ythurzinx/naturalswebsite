export function contentSecurityPolicy(development = false, nonce) {
  const scriptSources = development
    ? "'self' 'unsafe-inline' 'unsafe-eval'"
    : nonce
      ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
      : "'self'";
  return `default-src 'self'; script-src ${scriptSources}; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'${development ? " ws: wss:" : ""}; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'${development ? "" : "; upgrade-insecure-requests"}`;
}
export function securityHeaders(development = false) {
  return [
    {
      key: "Content-Security-Policy",
      value: contentSecurityPolicy(development),
    },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "no-referrer" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=()",
    },
    { key: "Strict-Transport-Security", value: "max-age=31536000" },
  ];
}
