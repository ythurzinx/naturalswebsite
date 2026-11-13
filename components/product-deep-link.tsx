"use client";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useCart } from "@/lib/cart-context";
const QuickView = dynamic(() =>
  import("./product-quick-view").then((m) => m.ProductQuickView),
);
export function ProductDeepLink() {
  const params = useSearchParams(),
    router = useRouter(),
    { catalog } = useCart(),
    id = params.get("produto"),
    product = catalog.find((p) => p.id === id);
  if (!product) return null;
  return (
    <QuickView
      key={product.id}
      product={product}
      onClose={() => {
        const next = new URLSearchParams(params.toString());
        next.delete("produto");
        router.replace(`/produtos${next.size ? `?${next}` : ""}`, {
          scroll: false,
        });
      }}
    />
  );
}
