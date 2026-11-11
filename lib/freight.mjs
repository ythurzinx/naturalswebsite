const origin =
  "Rua José Duarte Souza, 25, Jardim Saint Morritz, Taboão da Serra, SP, Brasil";
function invalid(message, status) {
  throw Object.assign(Error(message), { status });
}
export async function estimateFreight(cep, rate) {
  if (typeof cep !== "string" || !/^\d{5}-?\d{3}$/.test(cep))
    invalid("Informe um CEP com oito dígitos.", 400);
  const code = cep.replace("-", "");
  if (!process.env.GOOGLE_MAPS_API_KEY)
    invalid(
      "O cálculo de rota está indisponível. Consulte a entrega em Suporte ou escolha retirada.",
      503,
    );
  const postal = await fetch("https://viacep.com.br/ws/" + code + "/json/", {
    signal: AbortSignal.timeout(7000),
  });
  if (!postal.ok) invalid("Consulta de CEP indisponível.", 503);
  const p = await postal.json();
  if (p.erro || p.uf !== "SP")
    invalid("CEP inválido ou fora da região de entrega.", 400);
  const address = [p.logradouro, p.bairro, p.localidade, p.uf, code, "Brasil"]
    .filter(Boolean)
    .join(", ");
  const route = await fetch(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": "routes.distanceMeters",
      },
      body: JSON.stringify({
        origin: { address: origin },
        destination: { address },
        travelMode: "DRIVE",
      }),
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!route.ok)
    invalid("Não foi possível calcular a rota para esse CEP.", 503);
  const meters = (await route.json()).routes?.[0]?.distanceMeters;
  if (!Number.isFinite(meters) || meters < 0)
    invalid("Rota indisponível para esse CEP.", 422);
  return {
    cep: code,
    address,
    distance: Math.round(meters / 100) / 10,
    cents: Math.round((meters * rate) / 1000),
    rate,
  };
}
