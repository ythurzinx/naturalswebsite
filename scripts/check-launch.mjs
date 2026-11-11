import { readFile, access } from "node:fs/promises";
import { existsSync } from "node:fs";
import { paymentConfiguration } from "../lib/server/payment-service.mjs";
import { adminConfiguration } from "../lib/server/admin-auth.mjs";
import { createDatabase } from "../lib/server/database.mjs";
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}
const codeOnly = process.argv.includes("--code-only");
const catalog = JSON.parse(
  await readFile(new URL("../lib/catalog.json", import.meta.url), "utf8"),
);
const policy = JSON.parse(
  await readFile(new URL("../lib/sales-policy.json", import.meta.url), "utf8"),
);
const checks = [];
function check(label, condition) {
  checks.push({ label, ok: !!condition });
  console.log(`${condition ? "OK" : "PENDENTE"}: ${label}`);
}
check(
  "Catálogo com IDs únicos e preços positivos",
  catalog.length > 0 &&
    new Set(catalog.map((p) => p.id)).size === catalog.length &&
    catalog.every(
      (p) =>
        typeof p.id === "string" &&
        Number.isFinite(p.valor_unitario) &&
        p.valor_unitario > 0,
    ),
);
check(
  "Preços aprovados pela loja e retirada habilitada",
  policy.pricesConfirmedByMerchant === true &&
    policy.onlinePickupEnabled === true,
);
check(
  "Limites de venda e lista de indisponíveis válidos",
  Number.isSafeInteger(policy.maxOrderCents) &&
    policy.maxOrderCents >= 100 &&
    policy.maxOrderCents <= 10000000 &&
    Number.isInteger(policy.maxDistinctLines) &&
    policy.maxDistinctLines >= 1 &&
    policy.maxDistinctLines <= 50 &&
    Number.isInteger(policy.maxQuantityPerLine) &&
    policy.maxQuantityPerLine >= 1 &&
    policy.maxQuantityPerLine <= 99 &&
    Array.isArray(policy.disabledProductIds) &&
    policy.disabledProductIds.every((id) => catalog.some((p) => p.id === id)),
);
try {
  await access(new URL("../docs/HOSTINGER.md", import.meta.url));
  check("Guia de produção presente", true);
} catch {
  check("Guia de produção presente", false);
}
if (!codeOnly) {
  const config = paymentConfiguration({
    ...process.env,
    NODE_ENV: "production",
  });
  check("Origem HTTPS e Access Token configurados no servidor", !!config);
  check("Modo produtivo selecionado", config?.environment === "production");
  check(
    "Assinatura de Webhooks configurada",
    !!config && config.webhookSecret.length >= 16,
  );
  const admin = adminConfiguration({ ...process.env, NODE_ENV: "production" });
  check("Senha administrativa e segredo de sessão configurados", !!admin);
  check("Autenticador de dois fatores configurado", !!admin?.totpSecret);
  let pool;
  try {
    pool = createDatabase(process.env);
    if (!pool) throw Error();
    await pool.execute("SELECT 1 FROM mn_products LIMIT 0");
    await pool.execute("SELECT 1 FROM mn_orders LIMIT 0");
    await pool.execute("SELECT 1 FROM mn_admin_sessions LIMIT 0");
    check("MySQL acessível e migração aplicada", true);
  } catch {
    check("MySQL acessível e migração aplicada", false);
  } finally {
    if (pool) await pool.end();
  }
  console.log(
    "Este comando verifica configuração; não cria pagamento nem comprova aprovação de uma transação real.",
  );
  console.log(
    "Antes da abertura: valide o checkout em conta de teste, o certificado HTTPS, a chave Pix e o recebimento dos Webhooks no painel Mercado Pago.",
  );
}
process.exitCode = checks.every((c) => c.ok) ? 0 : 1;
