import { storeRequest } from "@/lib/store.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = (request: Request) => storeRequest(request);
export const POST = (request: Request) => storeRequest(request);
