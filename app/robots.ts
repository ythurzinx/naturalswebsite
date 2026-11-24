import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

// Customer, payment and admin pages stay out of search results.
export default function robots(): MetadataRoute.Robots {
  const origin = siteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api/",
        "/carrinho",
        "/checkout",
        "/favoritos",
        "/pagamento/",
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
