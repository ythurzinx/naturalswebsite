import { store } from "./store-data.mjs";
import { whatsappLink } from "./order-messages.mjs";
export { store };
export function whatsappUrl(
  message = "Olá, Mundo Natural! Gostaria de saber mais sobre os produtos.",
) {
  return whatsappLink(store.phone, message);
}
