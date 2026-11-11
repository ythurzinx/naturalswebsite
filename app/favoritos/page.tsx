import { Storefront } from "@/components/storefront";
export const metadata = { title: "Meus favoritos" };
export default function FavoritesPage() {
  return <Storefront favoritesOnly />;
}
