"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  ReceiptText,
  ShieldCheck,
  LogOut,
  RefreshCw,
  Plus,
  Pencil,
  ImagePlus,
  Search,
  ArrowUpRight,
  Activity,
  LockKeyhole,
} from "lucide-react";
import { Modal } from "./modal";
import { ProductImage } from "./product-card";
import { formatPrice } from "@/lib/products";
import type { Product } from "@/lib/types";
type AdminProduct = Product & {
  priceCents: number;
  costCents: number | null;
  active: boolean;
  imageSha: string | null;
};
type Order = {
  id: string;
  total_cents: number;
  paid_cents: number;
  refunded_cents: number | null;
  fee_cents: number | null;
  cost_total_cents: number | null;
  state: string;
  customer_name: string;
  customer_email: string;
  fulfillment_status: string;
  created_at: number;
  items?: {
    title: string;
    quantity: number;
    unit_cents: number;
    cost_unit_cents: number | null;
  }[];
};
type Expense = {
  id: string;
  description: string;
  amount_cents: number;
  incurred_at: number;
};
type Stats = {
  grossCents: number;
  refundedCents: number;
  netRevenueCents: number | null;
  feesCents: number;
  costsCents: number;
  expensesCents: number;
  profitCents: number | null;
  orders: number;
  pending: number;
  missingCosts: number;
  missingFees: number;
  missingRefunds: number;
  incompletePayments: number;
  chart: { day: number; cents: number }[];
};
type ProductDraft = {
  id?: string;
  name: string;
  category: string;
  weightLabel: string;
  isBulk: boolean;
  price: string;
  cost: string;
  active: boolean;
  imageSha: string | null;
};
const freshProduct = (): ProductDraft => ({
  name: "",
  category: "Produtos naturais e alimentícios",
  weightLabel: "250 g",
  isBulk: false,
  price: "",
  cost: "",
  active: true,
  imageSha: null,
});
const stateLabel: Record<string, string> = {
  paid: "Pago",
  pending: "Pendente",
  failed: "Recusado",
  refunded: "Reembolso",
  canceled: "Cancelado",
};
function currency(cents: number | null | undefined) {
  return cents == null ? "—" : formatPrice(cents / 100);
}
function date(value: number) {
  return new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}
function amount(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized))
    throw Error("Use um valor com até duas casas decimais.");
  return Math.round(Number(normalized) * 100);
}
export function AdminDashboard() {
  const expenseIntent = useRef<{ id: string; fingerprint: string } | null>(
    null,
  );
  const [auth, setAuth] = useState<boolean | null>(null),
    [available, setAvailable] = useState(true),
    [mfa, setMfa] = useState(false),
    [username, setUsername] = useState("admin"),
    [password, setPassword] = useState(""),
    [otp, setOtp] = useState("");
  const [tab, setTab] = useState("dashboard"),
    [days, setDays] = useState(30),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [stats, setStats] = useState<Stats | null>(null),
    [products, setProducts] = useState<AdminProduct[]>([]),
    [orders, setOrders] = useState<Order[]>([]),
    [expenses, setExpenses] = useState<Expense[]>([]),
    [audit, setAudit] = useState<
      { id: number; event: string; entity_id: string; created_at: number }[]
    >([]);
  const [search, setSearch] = useState(""),
    [productLimit, setProductLimit] = useState(100),
    [draft, setDraft] = useState<ProductDraft | null>(null),
    [order, setOrder] = useState<Order | null>(null),
    [costConfirm, setCostConfirm] = useState(false);
  const [expenseDescription, setExpenseDescription] = useState(""),
    [expenseAmount, setExpenseAmount] = useState(""),
    [expenseDate, setExpenseDate] = useState(() =>
      new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
    );
  const csrf = useRef("");
  const api = useCallback(
    async <T,>(
      path: string,
      method = "GET",
      body?: Record<string, unknown> | File,
    ): Promise<T> => {
      const binary = typeof File !== "undefined" && body instanceof File;
      const response = await fetch(`/api/admin/${path}`, {
        method,
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          ...(method !== "GET" ? { "X-CSRF-Token": csrf.current } : {}),
          ...(body
            ? {
                "Content-Type": binary
                  ? (body as File).type
                  : "application/json",
              }
            : {}),
        },
        ...(body
          ? { body: binary ? (body as File) : JSON.stringify(body) }
          : {}),
        signal: AbortSignal.timeout(60000),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) setAuth(false);
        throw Error(data.error || "Não foi possível concluir esta ação.");
      }
      return data;
    },
    [],
  );
  useEffect(() => {
    api<{
      available: boolean;
      authenticated: boolean;
      csrfToken?: string;
      username?: string;
      mfa?: boolean;
    }>("session")
      .then((value) => {
        setAvailable(value.available);
        setAuth(value.authenticated);
        setMfa(!!value.mfa);
        csrf.current = value.csrfToken || "";
        if (value.username) setUsername(value.username);
      })
      .catch(() => {
        setAvailable(false);
        setAuth(false);
      });
  }, [api]);
  const reload = useCallback(async () => {
    setError("");
    try {
      if (tab === "dashboard")
        setStats(await api<Stats>(`dashboard?days=${days}`));
      if (tab === "products")
        setProducts(
          (await api<{ products: AdminProduct[] }>("products")).products,
        );
      if (tab === "orders")
        setOrders((await api<{ orders: Order[] }>("orders")).orders);
      if (tab === "expenses")
        setExpenses((await api<{ expenses: Expense[] }>("expenses")).expenses);
      if (tab === "audit")
        setAudit((await api<{ events: typeof audit }>("audit")).events);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Falha ao atualizar.");
    }
  }, [tab, days, api]);
  useEffect(() => {
    if (auth) void reload();
  }, [auth, reload]);
  async function action(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível concluir a ação.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function login(event: FormEvent) {
    event.preventDefault();
    await action(async () => {
      const data = await api<{ csrfToken: string; username: string }>(
        "login",
        "POST",
        { username, password, otp },
      );
      csrf.current = data.csrfToken;
      setUsername(data.username);
      setPassword("");
      setOtp("");
      setAuth(true);
    });
  }
  async function saveProduct(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    await action(async () => {
      const { id, price, cost, ...fields } = draft;
      await api(id ? `products/${id}` : "products", id ? "PUT" : "POST", {
        ...fields,
        priceCents: amount(price),
        costCents: cost.trim() ? amount(cost) : null,
      });
      setDraft(null);
      setNotice(
        "Produto salvo. As alterações já são usadas no catálogo e no pagamento.",
      );
      await reload();
    });
  }
  async function upload(file: File | undefined) {
    if (!file || !draft) return;
    await action(async () => {
      if (file.size > 5 * 1024 * 1024) throw Error("A foto deve ter até 5 MB.");
      const data = await api<{ imageSha: string }>("images", "POST", file);
      setDraft((current) =>
        current ? { ...current, imageSha: data.imageSha } : null,
      );
      setNotice("Foto enviada. Salve o produto para associá-la.");
    });
  }
  function edit(product: AdminProduct) {
    setNotice("");
    setError("");
    setDraft({
      id: product.id,
      name: product.nome_produto,
      category: product.categoria,
      weightLabel: product.peso_produto,
      isBulk: product.isGranel,
      price: (product.priceCents / 100).toFixed(2),
      cost:
        product.costCents == null ? "" : (product.costCents / 100).toFixed(2),
      active: product.active,
      imageSha: product.imageSha,
    });
  }
  async function saveExpense(event: FormEvent) {
    event.preventDefault();
    await action(async () => {
      const expense = {
        description: expenseDescription,
        amountCents: amount(expenseAmount),
        date: expenseDate,
      };
      const fingerprint = JSON.stringify(expense);
      if (
        !expenseIntent.current ||
        expenseIntent.current.fingerprint !== fingerprint
      )
        expenseIntent.current = { id: crypto.randomUUID(), fingerprint };
      await api("expenses", "POST", {
        ...expense,
        id: expenseIntent.current.id,
      });
      expenseIntent.current = null;
      setExpenseDescription("");
      setExpenseAmount("");
      setNotice("Despesa registrada.");
      await reload();
    });
  }
  function exportOrders() {
    const safe = (value: unknown) =>
      `"${String(value ?? "")
        .replace(/^\s*[=+@-]/, "'$&")
        .replaceAll('"', '""')}"`;
    const rows = [
      [
        "Pedido",
        "Cliente",
        "E-mail",
        "Status",
        "Total",
        "Recebido",
        "Taxas",
        "Data",
      ],
      ...orders.map((row) => [
        row.id,
        row.customer_name,
        row.customer_email,
        stateLabel[row.state] || row.state,
        (row.total_cents / 100).toFixed(2),
        (row.paid_cents / 100).toFixed(2),
        row.fee_cents == null ? "" : (row.fee_cents / 100).toFixed(2),
        date(row.created_at),
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(
        ["\uFEFF" + rows.map((row) => row.map(safe).join(";")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "pedidos-mundo-natural.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  if (auth === null)
    return (
      <main id="conteudo" className="shell page-main">
        <h1 className="page-title">Abrindo seu painel…</h1>
      </main>
    );
  if (!auth)
    return (
      <main id="conteudo" className="shell page-main">
        <div className="admin-login">
          <span className="admin-lock">
            <LockKeyhole size={26} />
          </span>
          <span className="eyebrow">ACESSO RESTRITO À EQUIPE</span>
          <h1>
            Cuide do seu
            <br />
            <em>Mundo Natural.</em>
          </h1>
          <p>Produtos, pedidos e resultados em um só lugar.</p>
          {!available ? (
            <p className="privacy-note">
              O acesso administrativo está indisponível. Verifique a
              configuração do servidor e do banco com o responsável pela
              hospedagem.
            </p>
          ) : (
            <form onSubmit={login}>
              <label className="field-label">
                Usuário
                <input
                  autoComplete="username"
                  required
                  maxLength={80}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </label>
              <label className="field-label">
                Senha
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={256}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              {mfa && (
                <label className="field-label">
                  Código do autenticador
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  />
                </label>
              )}
              {error && (
                <p className="payment-error" role="alert">
                  {error}
                </p>
              )}
              <button className="button full-width" disabled={busy}>
                {busy ? "Verificando…" : "Entrar no painel"}
                <ArrowUpRight size={16} />
              </button>
            </form>
          )}
          <Link className="back-link" href="/">
            Voltar à loja
          </Link>
        </div>
      </main>
    );
  const tabs = [
    { id: "dashboard", label: "Visão geral", icon: LayoutDashboard },
    { id: "products", label: "Produtos e fotos", icon: Package },
    { id: "orders", label: "Pedidos", icon: ShoppingBag },
    { id: "expenses", label: "Despesas", icon: ReceiptText },
    { id: "audit", label: "Atividade", icon: Activity },
  ];
  const filtered = products.filter((p) =>
    `${p.nome_produto} ${p.categoria}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <main id="conteudo" className="shell admin-app">
      <aside className="admin-sidebar">
        <span className="eyebrow">MUNDO NATURAL</span>
        <strong>Gestão da loja</strong>
        <nav aria-label="Painel administrativo">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => {
                setTab(id);
                setNotice("");
                setError("");
              }}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <span className="admin-session">
          <ShieldCheck size={15} />
          {mfa ? "Acesso com autenticador" : "Sessão protegida"}
        </span>
        <button
          className="admin-logout"
          disabled={busy}
          onClick={() =>
            void action(async () => {
              await api("logout", "POST");
              csrf.current = "";
              setAuth(false);
            })
          }
        >
          <LogOut size={16} /> Sair
        </button>
      </aside>
      <section className="admin-content">
        <header className="admin-heading">
          <div>
            <span className="eyebrow">OLÁ, {username.toUpperCase()}</span>
            <h1>{tabs.find((t) => t.id === tab)?.label}</h1>
          </div>
          <div>
            <Link
              href="/"
              target="_blank"
              className="button button-outline button-small"
            >
              Ver loja <ArrowUpRight size={14} />
            </Link>
            <button
              disabled={busy}
              className="icon-button"
              aria-label="Atualizar painel"
              onClick={() => void reload()}
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </header>
        {error && (
          <p className="payment-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="admin-notice" role="status">
            {notice}
          </p>
        )}
        {tab === "dashboard" && (
          <>
            <div className="admin-toolbar">
              <p>Resultados reais das compras registradas por esta loja.</p>
              <label>
                Período
                <select
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                >
                  <option value={7}>Últimos 7 dias</option>
                  <option value={30}>Últimos 30 dias</option>
                  <option value={90}>Últimos 90 dias</option>
                </select>
              </label>
            </div>
            <div className="admin-metrics">
              {[
                {
                  label: "Receita recebida",
                  value: stats ? currency(stats.netRevenueCents) : "—",
                  sub: stats?.missingRefunds
                    ? "Há reembolsos pendentes de conciliação"
                    : "Após reembolsos conhecidos",
                },
                {
                  label: "Lucro estimado",
                  value: currency(stats?.profitCents),
                  sub:
                    stats?.profitCents == null
                      ? "Complete custos e concilie os pagamentos"
                      : "Receita − custos − taxas − despesas",
                },
                {
                  label: "Pedidos",
                  value: stats ? String(stats.orders) : "—",
                  sub: stats
                    ? `${stats.pending} aguardando pagamento`
                    : "Carregando dados",
                },
                {
                  label: "Despesas",
                  value: currency(stats?.expensesCents),
                  sub: "Despesas cadastradas no período",
                },
              ].map((card) => (
                <article key={card.label}>
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <p>{card.sub}</p>
                </article>
              ))}
            </div>
            {stats && (
              <>
                <section className="admin-panel">
                  <div className="admin-panel-title">
                    <h2>Recebimentos por dia</h2>
                    <span>Reembolsos conhecidos descontados</span>
                  </div>
                  {!stats.chart.length ? (
                    <p className="admin-empty">
                      Os recebimentos aparecerão aqui após as primeiras vendas.
                    </p>
                  ) : (
                    <div
                      className="admin-chart"
                      role="img"
                      aria-label="Gráfico de recebimentos por dia"
                    >
                      {stats.chart.map((item) => (
                        <div
                          key={item.day}
                          title={`${new Date(item.day * 86400000).toLocaleDateString("pt-BR", { timeZone: "UTC" })}: ${currency(item.cents)}`}
                        >
                          <span>{currency(item.cents)}</span>
                          <i
                            style={{
                              height: `${Math.max(3, (item.cents / Math.max(...stats.chart.map((p) => p.cents), 1)) * 130)}px`,
                            }}
                          />
                          <small>
                            {new Date(item.day * 86400000).toLocaleDateString(
                              "pt-BR",
                              {
                                timeZone: "UTC",
                                day: "2-digit",
                                month: "2-digit",
                              },
                            )}
                          </small>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
                <div className="admin-two-col">
                  <section className="admin-panel">
                    <h2>Composição do resultado</h2>
                    <dl>
                      <div>
                        <dt>Recebimentos brutos</dt>
                        <dd>{currency(stats.grossCents)}</dd>
                      </div>
                      <div>
                        <dt>Reembolsos conhecidos</dt>
                        <dd>{currency(stats.refundedCents)}</dd>
                      </div>
                      <div>
                        <dt>Custos registrados</dt>
                        <dd>{currency(stats.costsCents)}</dd>
                      </div>
                      <div>
                        <dt>Taxas conciliadas</dt>
                        <dd>{currency(stats.feesCents)}</dd>
                      </div>
                      <div>
                        <dt>Despesas</dt>
                        <dd>{currency(stats.expensesCents)}</dd>
                      </div>
                    </dl>
                  </section>
                  <section className="admin-panel">
                    <h2>Para completar sua análise</h2>
                    <p>
                      {stats.missingCosts} pedidos sem custo completo.
                      <br />
                      {stats.missingFees} pedidos com taxas pendentes.
                      <br />
                      {stats.missingRefunds} pedidos com reembolso pendente.
                    </p>
                    <button
                      disabled={busy}
                      className="button button-outline button-small"
                      onClick={() => setCostConfirm(true)}
                    >
                      Aplicar custos atuais aos pedidos sem custo
                    </button>
                    <p className="fine-print">
                      O lucro é uma estimativa gerencial. Os custos são
                      guardados por pedido, e a aplicação exige sua confirmação.
                    </p>
                  </section>
                </div>
              </>
            )}
          </>
        )}
        {tab === "products" && (
          <>
            <div className="admin-toolbar">
              <div className="catalog-search">
                <Search size={17} />
                <input
                  aria-label="Buscar produtos"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setProductLimit(100);
                  }}
                  placeholder="Buscar produto ou categoria"
                />
              </div>
              <button
                className="button button-small"
                onClick={() => {
                  setDraft(freshProduct());
                  setError("");
                  setNotice("");
                }}
              >
                <Plus size={16} /> Novo produto
              </button>
            </div>
            <p className="muted">
              {filtered.length} produtos. Custo por kg para itens a granel e por
              unidade para os demais.
            </p>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Preço</th>
                    <th>Custo</th>
                    <th>Margem bruta</th>
                    <th>Situação</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, productLimit).map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="admin-product-cell">
                          <ProductImage product={p} />
                          <div>
                            <strong>{p.nome_produto}</strong>
                            <small>
                              {p.isGranel ? "Preço por kg" : p.peso_produto}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>{currency(p.priceCents)}</td>
                      <td>
                        {p.costCents == null ? (
                          <span className="admin-warning">Não cadastrado</span>
                        ) : (
                          currency(p.costCents)
                        )}
                      </td>
                      <td>
                        {p.costCents == null
                          ? "—"
                          : `${(((p.priceCents - p.costCents) / p.priceCents) * 100).toFixed(1)}%`}
                      </td>
                      <td>
                        <span
                          className={`admin-badge ${p.active ? "paid" : "canceled"}`}
                        >
                          {p.active ? "Ativo" : "Indisponível"}
                        </span>
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          onClick={() => edit(p)}
                          aria-label={`Editar ${p.nome_produto}`}
                        >
                          <Pencil size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length > productLimit && (
              <button
                className="button button-outline button-small"
                onClick={() => setProductLimit((n) => n + 100)}
              >
                Mostrar mais produtos
              </button>
            )}
          </>
        )}
        {tab === "orders" && (
          <>
            <div className="admin-toolbar">
              <p>
                Últimos 200 pedidos. A retirada só é liberada após nova
                conferência do pagamento.
              </p>
              <div>
                <button
                  className="button button-outline button-small"
                  onClick={exportOrders}
                >
                  Exportar CSV
                </button>
                <button
                  disabled={busy}
                  className="button button-small"
                  onClick={() =>
                    void action(async () => {
                      const value = await api<{ results: { ok: boolean }[] }>(
                        "orders/sync",
                        "POST",
                      );
                      setNotice(
                        `${value.results.filter((r) => r.ok).length} pedidos sincronizados nesta rodada.`,
                      );
                      await reload();
                    })
                  }
                >
                  <RefreshCw size={15} /> Sincronizar pendentes
                </button>
              </div>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Pedido / cliente</th>
                    <th>Total</th>
                    <th>Pagamento</th>
                    <th>Retirada</th>
                    <th>Data</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {orders.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong className="admin-id">{item.id}</strong>
                        <small>{item.customer_name || "Comprador"}</small>
                      </td>
                      <td>{currency(item.total_cents)}</td>
                      <td>
                        <span className={`admin-badge ${item.state}`}>
                          {stateLabel[item.state] || item.state}
                        </span>
                      </td>
                      <td>
                        {
                          (
                            {
                              new: "Novo",
                              ready: "Pronto",
                              completed: "Retirado",
                            } as Record<string, string>
                          )[item.fulfillment_status]
                        }
                      </td>
                      <td>{date(item.created_at)}</td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() =>
                            void action(async () =>
                              setOrder(
                                (
                                  await api<{ order: Order }>(
                                    `orders/${item.id}`,
                                  )
                                ).order,
                              ),
                            )
                          }
                        >
                          Ver pedido
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!orders.length && (
                <p className="admin-empty">Nenhum pedido registrado ainda.</p>
              )}
            </div>
            <a
              className="back-link"
              href="https://www.mercadopago.com.br/activities"
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir Mercado Pago para conciliação ou reembolso{" "}
              <ArrowUpRight size={15} />
            </a>
          </>
        )}
        {tab === "expenses" && (
          <>
            <section className="admin-panel">
              <h2>Registrar despesa</h2>
              <form onSubmit={saveExpense} className="admin-expense-form">
                <label className="field-label">
                  Descrição
                  <input
                    required
                    minLength={2}
                    maxLength={180}
                    value={expenseDescription}
                    onChange={(e) => setExpenseDescription(e.target.value)}
                    placeholder="Embalagens, manutenção, frete…"
                  />
                </label>
                <label className="field-label">
                  Valor (R$)
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                  />
                </label>
                <label className="field-label">
                  Data
                  <input
                    required
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                  />
                </label>
                <button disabled={busy} className="button button-small">
                  Registrar
                </button>
              </form>
              <p className="fine-print">
                Cadastre despesas adicionais. As taxas já conciliadas do Mercado
                Pago são deduzidas separadamente.
              </p>
            </section>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Descrição</th>
                    <th>Valor</th>
                    <th>Data</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((item) => (
                    <tr key={item.id}>
                      <td>{item.description}</td>
                      <td>{currency(item.amount_cents)}</td>
                      <td>{date(item.incurred_at)}</td>
                      <td>
                        <button
                          disabled={busy}
                          className="text-button"
                          onClick={() => {
                            if (
                              window.confirm(
                                "Excluir esta despesa dos resultados? A ação ficará registrada.",
                              )
                            )
                              void action(async () => {
                                await api(`expenses/${item.id}`, "DELETE");
                                await reload();
                              });
                          }}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!expenses.length && (
                <p className="admin-empty">Nenhuma despesa cadastrada.</p>
              )}
            </div>
          </>
        )}
        {tab === "audit" && (
          <section className="admin-panel">
            <h2>Últimas atividades</h2>
            <p className="muted">
              Alterações de produtos, fotos, retiradas, despesas e acessos
              administrativos.
            </p>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Ação</th>
                    <th>Registro</th>
                    <th>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((item) => (
                    <tr key={item.id}>
                      <td>{item.event}</td>
                      <td className="admin-id">{item.entity_id}</td>
                      <td>{date(item.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        <p className="admin-footer-note">
          <ShieldCheck size={14} /> Dados gerenciais desta loja. Mantenha o
          catálogo e os custos atualizados e confirme os créditos na conta
          Mercado Pago.
        </p>
      </section>
      <Modal
        open={!!draft}
        onOpenChange={(open) => {
          if (!open && !busy) setDraft(null);
        }}
        title={draft?.id ? "Editar produto" : "Novo produto"}
        wide
      >
        {draft && (
          <form onSubmit={saveProduct}>
            <fieldset className="checkout-fieldset" disabled={busy}>
              <div className="admin-product-editor">
                <div className="admin-photo-editor">
                  {draft.imageSha ? (
                    <img
                      src={`/api/product-images/${draft.imageSha}`}
                      alt="Foto do produto"
                    />
                  ) : (
                    <div className="admin-photo-placeholder">
                      <ImagePlus size={42} />
                      <span>Foto ilustrativa da categoria será usada</span>
                    </div>
                  )}
                  <label className="button button-outline button-small">
                    <ImagePlus size={16} />
                    {busy ? "Enviando…" : "Enviar foto"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(e) => void upload(e.target.files?.[0])}
                    />
                  </label>
                  {draft.imageSha && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setDraft({ ...draft, imageSha: null })}
                    >
                      Usar imagem da categoria
                    </button>
                  )}
                  <p className="fine-print">
                    JPEG, PNG ou WebP, até 5 MB. A foto é otimizada e tem os
                    metadados removidos.
                  </p>
                </div>
                <div>
                  <label className="field-label">
                    Nome
                    <input
                      required
                      maxLength={160}
                      value={draft.name}
                      onChange={(e) =>
                        setDraft({ ...draft, name: e.target.value })
                      }
                    />
                  </label>
                  <label className="field-label">
                    Categoria
                    <input
                      required
                      maxLength={100}
                      value={draft.category}
                      onChange={(e) =>
                        setDraft({ ...draft, category: e.target.value })
                      }
                    />
                  </label>
                  <label className="field-label">
                    Peso / embalagem
                    <input
                      required
                      maxLength={80}
                      value={draft.weightLabel}
                      onChange={(e) =>
                        setDraft({ ...draft, weightLabel: e.target.value })
                      }
                    />
                  </label>
                  <label className="admin-checkbox">
                    <input
                      type="checkbox"
                      checked={draft.isBulk}
                      onChange={(e) =>
                        setDraft({ ...draft, isBulk: e.target.checked })
                      }
                    />{" "}
                    Produto a granel (preço e custo por kg)
                  </label>
                  <div className="form-row">
                    <label className="field-label">
                      Preço de venda (R$)
                      <input
                        required
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={draft.price}
                        onChange={(e) =>
                          setDraft({ ...draft, price: e.target.value })
                        }
                      />
                    </label>
                    <label className="field-label">
                      Custo (R$, opcional)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.cost}
                        onChange={(e) =>
                          setDraft({ ...draft, cost: e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <label className="admin-checkbox">
                    <input
                      type="checkbox"
                      checked={draft.active}
                      onChange={(e) =>
                        setDraft({ ...draft, active: e.target.checked })
                      }
                    />{" "}
                    Disponível para venda no site
                  </label>
                </div>
              </div>
              {error && (
                <p className="payment-error" role="alert">
                  {error}
                </p>
              )}
              <button disabled={busy} className="button full-width">
                {busy ? "Salvando…" : "Salvar produto"}
              </button>
            </fieldset>
          </form>
        )}
      </Modal>
      <Modal
        open={!!order}
        onOpenChange={(open) => {
          if (!open) setOrder(null);
        }}
        title="Detalhes do pedido"
        wide
      >
        {order && (
          <>
            <p className="admin-id">{order.id}</p>
            <p>
              {order.customer_name} · {order.customer_email}
            </p>
            <span className={`admin-badge ${order.state}`}>
              {stateLabel[order.state]}
            </span>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Qtd.</th>
                    <th>Unitário</th>
                    <th>Custo unitário</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items?.map((item, i) => (
                    <tr key={i}>
                      <td>{item.title}</td>
                      <td>{item.quantity}</td>
                      <td>{currency(item.unit_cents)}</td>
                      <td>{currency(item.cost_unit_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Total: <strong>{currency(order.total_cents)}</strong> · Taxas:{" "}
              {currency(order.fee_cents)}
            </p>
            <label className="field-label">
              Situação da retirada
              <select
                disabled={busy || order.state !== "paid"}
                value={order.fulfillment_status}
                onChange={(e) =>
                  void action(async () => {
                    await api(`orders/${order.id}/fulfillment`, "PUT", {
                      state: e.target.value,
                    });
                    setOrder(
                      (await api<{ order: Order }>(`orders/${order.id}`)).order,
                    );
                    await reload();
                  })
                }
              >
                <option value="new">Novo</option>
                <option value="ready">Pronto para retirada</option>
                <option value="completed">Retirado</option>
              </select>
            </label>
            <p className="fine-print">
              A alteração exige uma nova consulta ao Mercado Pago e pagamento
              integral aprovado.
            </p>
            {error && (
              <p className="payment-error" role="alert">
                {error}
              </p>
            )}
          </>
        )}
      </Modal>
      <Modal
        open={costConfirm}
        onOpenChange={setCostConfirm}
        title="Aplicar custos atuais?"
      >
        <p className="muted">
          Esta ação preenche apenas os custos ausentes dos pedidos com os custos
          cadastrados hoje nos produtos. Eles passam a compor a estimativa de
          lucro; custos já registrados são preservados. A ação ficará no
          histórico.
        </p>
        <button
          disabled={busy}
          className="button full-width"
          onClick={() =>
            void action(async () => {
              await api("costs/backfill", "POST");
              setCostConfirm(false);
              setNotice(
                "Custos ausentes atualizados com os valores atuais cadastrados.",
              );
              await reload();
            })
          }
        >
          Confirmar aplicação dos custos
        </button>
      </Modal>
    </main>
  );
}
