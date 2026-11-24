// Public origin used in metadata files. Falls back to the official domain.
export function siteUrl() {
  const value = process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return url.origin;
  } catch {}
  return "https://mundonaturaltaboao.com.br";
}
