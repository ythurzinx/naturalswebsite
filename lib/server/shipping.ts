import "server-only";
import { repository, publicCatalog } from "./shop";
import policy from "@/lib/sales-policy.json";
import {
  createShippingService,
  shippingConfiguration,
} from "./shipping-service.mjs";
import { googleRoutesClient } from "./google-routes.mjs";
import { openRouteClient } from "./openroute.mjs";
export const shipping = createShippingService({
  repository,
  catalogProvider: publicCatalog,
  policy,
  config: shippingConfiguration(process.env),
  // Private server keys; never expose them with NEXT_PUBLIC_. Google is used
  // when configured; otherwise the free openrouteservice key.
  routes:
    googleRoutesClient(process.env.GOOGLE_MAPS_API_KEY) ||
    openRouteClient(process.env.OPENROUTESERVICE_API_KEY),
});
