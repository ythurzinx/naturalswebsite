// Redirect only the www/apex counterpart to the merchant's configured origin.
// Neither a Host header nor a path can choose a different redirect destination.
export function canonicalPageRedirect(
  requestUrl,
  configuredOrigin,
  requestedHost = "",
) {
  try {
    const source = new URL(requestUrl),
      target = new URL(configuredOrigin);
    if (
      target.protocol !== "https:" ||
      target.username ||
      target.password ||
      target.pathname !== "/" ||
      target.search ||
      target.hash
    )
      return null;
    const incoming = new URL(`https://${requestedHost || source.host}`);
    if (
      incoming.username ||
      incoming.password ||
      incoming.pathname !== "/" ||
      incoming.search ||
      incoming.hash
    )
      return null;
    const alias = target.hostname.startsWith("www.")
      ? target.hostname.slice(4)
      : `www.${target.hostname}`;
    if (incoming.hostname !== alias) return null;
    target.pathname = source.pathname;
    target.search = source.search;
    return target.toString();
  } catch {
    return null;
  }
}
