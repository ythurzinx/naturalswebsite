import { PaymentStatus } from "@/components/payment-status";
export const metadata = {
  title: "Acompanhar pagamento",
  robots: { index: false, follow: false },
};
export default function PaymentReturnPage() {
  return <PaymentStatus />;
}
