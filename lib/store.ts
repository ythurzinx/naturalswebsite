import { store } from "./store-data.mjs";
export { store };
export function whatsappUrl(
  message = "Olá, Mundo Natural! Gostaria de saber mais sobre os produtos.",
) {
  return `https://wa.me/${store.phone}?text=${encodeURIComponent(message)}`;
}
