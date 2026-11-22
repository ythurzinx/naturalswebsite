import "server-only";
import { repository, publicCatalog } from "./shop";
import policy from "@/lib/sales-policy.json";
import {
  createShippingService,
  shippingConfiguration,
} from "./shipping-service.mjs";
import { googleRoutesClient } from "./google-routes.mjs";
export const shipping = createShippingService({
  repository,
  catalogProvider: publicCatalog,
  policy,
  config: shippingConfiguration(process.env),
  // Private server key; never expose it with NEXT_PUBLIC_.
  routes: googleRoutesClient(process.env.GOOGLE_MAPS_API_KEY),
});
