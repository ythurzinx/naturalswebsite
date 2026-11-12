import "server-only";
import { repository } from "./shop";
import { payments } from "./payments";
import { adminConfiguration } from "./admin-auth.mjs";
import { createAdminService } from "./admin-service.mjs";
import { shipping } from "./shipping";
import { paymentTesting } from "./payment-testing-server";
import { customerNotifications } from "./customer-notification-server";
const config = adminConfiguration({
  APP_URL: process.env.APP_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NODE_ENV: process.env.NODE_ENV,
  ADMIN_USERNAME: process.env.ADMIN_USERNAME,
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
  ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
  ADMIN_TOTP_SECRET: process.env.ADMIN_TOTP_SECRET,
});
export const admin = createAdminService({
  config,
  repository,
  payments,
  shipping,
  paymentTesting,
  notifications: customerNotifications,
});
