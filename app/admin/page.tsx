import { AdminDashboard } from "@/components/admin-dashboard";
export const metadata = {
  title: "Administração",
  robots: { index: false, follow: false },
};
export default function AdminPage() {
  return <AdminDashboard />;
}
