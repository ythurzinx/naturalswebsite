"use client";
import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import {
  printOrderReceipt,
  printerSettings,
  savePrinterSettings,
  type PaperWidth,
} from "@/lib/thermal-receipt";
import type { Order } from "./admin-dashboard";

const sample: Order = {
  id: "TESTE-IMPRESSORA",
  total_cents: 2680,
  paid_cents: 2680,
  refunded_cents: null,
  fee_cents: null,
  cost_total_cents: null,
  state: "paid",
  customer_name: "Teste de impressão",
  customer_email: "",
  fulfillment_status: "new",
  fulfillment_mode: "pickup",
  created_at: Date.now(),
  items: [
    {
      line_key: "teste:100",
      product_id: "teste",
      title: "Produto de exemplo · 100 g",
      quantity: 2,
      unit_cents: 1340,
      cost_unit_cents: null,
      packed: 0,
    },
  ],
} as unknown as Order;

// Per-computer setting: only the store PC that should print turns it on.
export function AdminPrinterSettings() {
  const [settings, setSettings] = useState<{ auto: boolean; width: PaperWidth }>(
    { auto: false, width: 80 },
  );
  useEffect(() => setSettings(printerSettings()), []);
  const change = (next: Partial<typeof settings>) => {
    const value = { ...settings, ...next };
    setSettings(value);
    savePrinterSettings(value);
  };
  return (
    <div className="admin-card printer-card">
      <h3>
        <Printer size={19} /> Impressora da loja
      </h3>
      <label className="admin-toggle">
        <input
          type="checkbox"
          checked={settings.auto}
          onChange={(e) => change({ auto: e.target.checked })}
        />
        Imprimir automaticamente cada pedido pago neste computador
      </label>
      <div className="printer-row">
        <label className="field-label">
          Largura do papel
          <select
            value={settings.width}
            onChange={(e) =>
              change({ width: Number(e.target.value) === 58 ? 58 : 80 })
            }
          >
            <option value={80}>80 mm</option>
            <option value={58}>58 mm</option>
          </select>
        </label>
        <button
          type="button"
          className="button button-outline button-small"
          onClick={() => printOrderReceipt(sample, settings.width)}
        >
          Imprimir teste
        </button>
      </div>
      <p className="fine-print">
        Deixe o painel aberto neste computador. O pedido é impresso assim que o
        pagamento é aprovado, uma vez só.
      </p>
      <details className="printer-help">
        <summary>Imprimir sem a janela de confirmação</summary>
        <ol>
          <li>Defina a impressora térmica como impressora padrão do Windows.</li>
          <li>
            Crie um atalho do Google Chrome e, em Propriedades → Destino,
            acrescente no final: <code>--kiosk-printing</code>
          </li>
          <li>
            Feche todas as janelas do Chrome e abra o painel por esse atalho.
            A impressão sai direto, sem perguntar.
          </li>
        </ol>
      </details>
    </div>
  );
}
