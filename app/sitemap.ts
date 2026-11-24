import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";
import { products } from "@/lib/products";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteUrl();
  const pages: MetadataRoute.Sitemap = [
    { url: `${origin}/`, changeFrequency: "daily", priority: 1 },
    { url: `${origin}/produtos`, changeFrequency: "daily", priority: 0.9 },
    { url: `${origin}/avaliacoes`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${origin}/sobre`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${origin}/contato`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${origin}/blog`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${origin}/termos`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${origin}/privacidade`, changeFrequency: "yearly", priority: 0.2 },
  ];
  return [
    ...pages,
    ...products
      .filter((product) => !product.combo)
      .map((product) => ({
        url: `${origin}/produtos?produto=${encodeURIComponent(product.id)}`,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
  ];
}
