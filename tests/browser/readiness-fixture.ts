// Launch checklist returned by /api/admin/readiness in isolated UI tests.
export const readinessFixture = {
  payments: { configured: true, production: true, webhook: true },
  security: { mfa: true },
  coupons: { storage: true, active: 0 },
  shipping: { enabled: true, route: false, originAddress: false },
  notifications: {
    email: false,
    whatsapp: false,
    emailEnabled: false,
    whatsappEnabled: false,
    worker: false,
    issues: 0,
  },
};
