"use client";
import { Package, Leaf } from "lucide-react";
import { productTile } from "@/lib/products";
import type { Product } from "@/lib/types";
export function ProductImage({
  product,
  className = "",
}: {
  product: Product;
  className?: string;
}) {
  const packaged = /Suplementos|Fitoterápicos/.test(product.categoria);
  if (product.combo)
    return (
      <div
        className={`product-photo combo-photo ${className}`}
        role="img"
        aria-label={`Ingredientes de ${product.nome_produto}`}
      >
        {product.combo.slice(0, 4).map((component) => (
          <div key={component.productId}>
            {component.imagem &&
            /^\/(?:images\/products\/[a-z0-9-]+\.webp|api\/product-images\/[a-f0-9]{64})$/.test(
              component.imagem,
            ) ? (
              <img
                src={component.imagem}
                alt=""
                loading="lazy"
                width={320}
                height={320}
              />
            ) : (
              <Leaf size={30} />
            )}
            <span>{component.weight} g</span>
          </div>
        ))}
      </div>
    );
  if (
    product.imagem &&
    /^\/(?:images\/products\/[a-z0-9-]+\.webp|api\/product-images\/[a-f0-9]{64})$/.test(
      product.imagem,
    )
  )
    return (
      <div className={`product-photo product-custom-photo ${className}`}>
        <img
          src={product.imagem}
          alt={`${product.imagemLegenda || "Imagem ilustrativa"} — ${product.nome_produto}`}
          loading="lazy"
          decoding="async"
          width={640}
          height={640}
        />
      </div>
    );
  return (
    <div
      className={`product-photo tile-${productTile(product)} ${packaged ? "packaged-photo" : ""} ${className}`}
      role="img"
      aria-label={`Imagem ilustrativa de ${product.nome_produto}`}
    >
      {packaged && <Package size={60} strokeWidth={1} />}
    </div>
  );
}
