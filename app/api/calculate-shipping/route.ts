import { estimateFreight } from "@/lib/freight.mjs";
import { shopConfig } from "@/lib/store.mjs";
export async function POST(request: Request) {
  try {
    const { cep } = await request.json();
    const { rate } = await shopConfig();
    const quote = await estimateFreight(cep, rate);
    return Response.json(
      { ...quote, cost: quote.cents / 100 },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const e = error as { status?: number; message?: string };
    return Response.json(
      { error: e.status ? e.message : "Consulta de frete indisponível." },
      { status: e.status || 503 },
    );
  }
}
