import { notFound } from "next/navigation";
// A browser-only password cannot protect administration. Fail closed.
export default function AdminPage() {
  notFound();
}
