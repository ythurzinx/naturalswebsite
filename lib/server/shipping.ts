import "server-only";
import { repository, publicCatalog } from "./shop";
import policy from "@/lib/sales-policy.json";
import {
  createShippingService,
  shippingConfiguration,
} from "./shipping-service.mjs";
export const shipping = createShippingService({
  repository,
  catalogProvider: publicCatalog,
  policy,
  config: shippingConfiguration(process.env),
});
