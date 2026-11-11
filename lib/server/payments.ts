import "server-only";
import catalog from "@/lib/catalog.json";
import policy from "@/lib/sales-policy.json";
import { repository, publicCatalog } from "./shop";
import { shipping } from "./shipping";
import {
  createPaymentService,
  paymentConfiguration,
} from "./payment-service.mjs";

// Only this server boundary reads credentials. Never re-export this module
// from a client component or use NEXT_PUBLIC_ for a secret.
const configuration = paymentConfiguration({
  MERCADOPAGO_ACCESS_TOKEN: process.env.MERCADOPAGO_ACCESS_TOKEN,
  MERCADOPAGO_WEBHOOK_SECRET: process.env.MERCADOPAGO_WEBHOOK_SECRET,
  MERCADOPAGO_ENV: process.env.MERCADOPAGO_ENV,
  APP_URL: process.env.APP_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NODE_ENV: process.env.NODE_ENV,
});
export const payments = createPaymentService({
  catalog,
  policy,
  config: repository ? configuration : null,
  repository,
  catalogProvider: publicCatalog,
  shipping,
});
