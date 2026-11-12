export const store = {
  name: "Mundo Natural",
  city: "Taboão da Serra, SP",
  address:
    "Rua José Duarte Souza, 21 · Jardim das Margaridas · Taboão da Serra, SP",
  phone: "551151993525",
  phoneLabel: "(11) 5199-3525",
  instagram: "https://instagram.com/_mundonaturalto",
};
export function whatsappUrl(
  message = "Olá, Mundo Natural! Gostaria de saber mais sobre os produtos.",
) {
  return `https://wa.me/${store.phone}?text=${encodeURIComponent(message)}`;
}
