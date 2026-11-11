"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Heart, ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart-context";

export function MobileNavigation() {
  const path = usePathname();
  const { itemCount } = useCart();
  if (path.startsWith("/admin")) return null;
  const links = [
    { href: "/", label: "Início", Icon: Home },
    { href: "/produtos", label: "Buscar", Icon: Search },
    { href: "/favoritos", label: "Favoritos", Icon: Heart },
    { href: "/carrinho", label: "Carrinho", Icon: ShoppingBag },
  ];
  return (
    <nav className="mobile-bottom-nav" aria-label="Navegação do celular">
      {links.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={path === href ? "page" : undefined}
        >
          <span>
            <Icon size={21} />
            {href === "/carrinho" && itemCount > 0 && (
              <b>{itemCount > 99 ? "99+" : itemCount}</b>
            )}
          </span>
          {label}
        </Link>
      ))}
    </nav>
  );
}
