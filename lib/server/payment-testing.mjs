import {
  createPaymentService,
  paymentConfiguration,
} from "./payment-service.mjs";
import { jsonResponse } from "./http-security.mjs";
export function createPaymentTesting(env, options = {}) {
  const service = createPaymentService({
    catalog: [
      {
        id: "sandbox-checkout",
        nome_produto: "Homologação Mundo Natural — sem venda real",
        peso_produto: "Teste",
        isGranel: false,
        valor_unitario: 1,
      },
    ],
    policy: {
      pricesConfirmedByMerchant: true,
      onlinePickupEnabled: true,
      maxOrderCents: 100,
      maxDistinctLines: 1,
      maxQuantityPerLine: 1,
      disabledProductIds: [],
    },
    config: paymentConfiguration({
      APP_URL: env.APP_URL,
      NEXT_PUBLIC_SITE_URL: env.NEXT_PUBLIC_SITE_URL,
      NODE_ENV: env.NODE_ENV,
      MERCADOPAGO_ACCESS_TOKEN: env.MERCADOPAGO_TEST_ACCESS_TOKEN,
      MERCADOPAGO_ENV: "test",
    }),
    channel: "sandbox",
    fetcher: options.fetcher || fetch,
    ...(options.now ? { now: options.now } : {}),
  });
  return {
    session: service.session,
    resetSession: service.resetSession,
    checkout: service.checkout,
    status: async (request) => {
      const result = await service.status(request, "current");
      return result.status === 404
        ? jsonResponse({ state: "none", testMode: true })
        : result;
    },
  };
}
