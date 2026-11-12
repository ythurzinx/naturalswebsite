import "server-only";
import { createPaymentTesting } from "./payment-testing.mjs";
export const paymentTesting = createPaymentTesting({
  APP_URL: process.env.APP_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NODE_ENV: process.env.NODE_ENV,
  MERCADOPAGO_TEST_ACCESS_TOKEN: process.env.MERCADOPAGO_TEST_ACCESS_TOKEN,
});
