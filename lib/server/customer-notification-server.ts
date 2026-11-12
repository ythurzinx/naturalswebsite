import "server-only";
import { repository } from "./shop";
import { createCustomerNotifications } from "./customer-notifications.mjs";

export const customerNotifications = createCustomerNotifications({
  repository,
  env: {
    BREVO_API_KEY: process.env.BREVO_API_KEY,
    BREVO_SENDER_EMAIL: process.env.BREVO_SENDER_EMAIL,
    BREVO_WHATSAPP_SENDER: process.env.BREVO_WHATSAPP_SENDER,
  },
});
