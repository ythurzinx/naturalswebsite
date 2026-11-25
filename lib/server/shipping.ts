import "server-only";
import { repository, publicCatalog } from "./shop";
import policy from "@/lib/sales-policy.json";
import {
  createShippingService,
  shippingConfiguration,
} from "./shipping-service.mjs";
import { googleRoutesClient } from "./google-routes.mjs";
import { openRouteClient } from "./openroute.mjs";
import { tomTomClient } from "./tomtom.mjs";
export const shipping = createShippingService({
  repository,
  catalogProvider: publicCatalog,
  policy,
  config: shippingConfiguration(process.env),
  // Private server keys; never expose them with NEXT_PUBLIC_. The first
  // configured provider is used: Google, then the free TomTom and
  // openrouteservice plans.
  routes:
    googleRoutesClient(process.env.GOOGLE_MAPS_API_KEY) ||
    tomTomClient(process.env.TOMTOM_API_KEY) ||
    openRouteClient(process.env.OPENROUTESERVICE_API_KEY),
});
