import { repository } from "@/lib/server/shop";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!repository || !/^[a-f0-9]{64}$/.test(id))
    return new Response(null, { status: 404 });
  try {
    const asset = await repository.image(id);
    if (!asset) return new Response(null, { status: 404 });
    const headers = {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
      ETag: `"${id}"`,
    };
    if (request.headers.get("if-none-match") === `"${id}"`)
      return new Response(null, { status: 304, headers });
    return new Response(new Uint8Array(asset.data), { headers });
  } catch {
    return new Response(null, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
