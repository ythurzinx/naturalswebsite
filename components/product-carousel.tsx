"use client";
import { useRef } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import type { Product } from "@/lib/types";
import { ProductCard } from "./product-card";

export function ProductCarousel({
  title,
  eyebrow,
  description,
  products,
  href,
}: {
  title: string;
  eyebrow: string;
  description: string;
  products: Product[];
  href: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  if (!products.length) return null;
  function move(direction: number) {
    track.current?.scrollBy({
      left: direction * (track.current.clientWidth * 0.8),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  return (
    <section className="section shell merchandising-section" aria-label={title}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            <Sparkles size={13} /> {eyebrow}
          </span>
          <h2>{title}</h2>
          <p className="section-description">{description}</p>
        </div>
        <div className="carousel-actions">
          <Link href={href} className="section-link">
            Ver todos <ArrowRight size={16} />
          </Link>
          <button
            type="button"
            className="icon-button"
            aria-label={`Voltar em ${title}`}
            onClick={() => move(-1)}
          >
            <ArrowLeft size={19} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={`Avançar em ${title}`}
            onClick={() => move(1)}
          >
            <ArrowRight size={19} />
          </button>
        </div>
      </div>
      <div
        ref={track}
        className="product-carousel"
        tabIndex={0}
        aria-label={`${title}: deslize ou use as setas`}
      >
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      <p className="carousel-hint">
        Deslize para descobrir mais <ArrowRight size={13} />
      </p>
    </section>
  );
}
