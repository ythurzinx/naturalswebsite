import { payments } from "@/lib/server/payments";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = payments.session;
export const POST = payments.resetSession;
