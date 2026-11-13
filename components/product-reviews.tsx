"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Star, BadgeCheck, MessageSquareText, ArrowRight } from "lucide-react";
type Review = {
  id: string;
  productId: string;
  productName: string;
  rating: number;
  text: string;
  author: string;
  createdAt: number;
  reply: string;
  verified: boolean;
};
type ReviewData = {
  available: boolean;
  average: number | null;
  count: number;
  reviews: Review[];
};
export function ProductReviews({ productId }: { productId?: string }) {
  const [data, setData] = useState<ReviewData | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    fetch(
      `/api/reviews${productId ? `?product=${encodeURIComponent(productId)}` : ""}`,
      { cache: "no-store", signal: c.signal },
    )
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then(setData)
      .catch(() => {
        if (!c.signal.aborted)
          setError("Não foi possível carregar as avaliações agora.");
      });
    return () => c.abort();
  }, [productId]);
  return (
    <section className="product-reviews">
      <div className="reviews-heading">
        <div>
          <h3>
            {productId ? "Quem comprou conta" : "Experiências de quem comprou"}
          </h3>
          <p>Opiniões de compras verificadas, publicadas após análise.</p>
        </div>
        <MessageSquareText size={24} />
      </div>
      {error && (
        <p className="payment-error" role="alert">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Carregando avaliações…</p>}
      {data && (
        <>
          <div className="reviews-summary">
            <span className="reviews-score">
              {data.count ? data.average?.toLocaleString("pt-BR") : "—"}
            </span>
            <div>
              <div
                className="review-stars"
                aria-label={
                  data.count ? `Nota ${data.average} de 5` : "Ainda sem nota"
                }
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    size={18}
                    fill={
                      data.count && n <= Math.round(data.average || 0)
                        ? "currentColor"
                        : "none"
                    }
                  />
                ))}
              </div>
              <small>
                {data.count
                  ? `${data.count} ${data.count === 1 ? "avaliação publicada" : "avaliações publicadas"}`
                  : "Seja a primeira pessoa a avaliar"}
              </small>
            </div>
          </div>
          {!data.reviews.length && (
            <div className="reviews-empty">
              <BadgeCheck size={27} />
              <strong>
                {data.available
                  ? "Sua experiência pode ajudar outras pessoas"
                  : "Avaliações em preparação"}
              </strong>
              <p>
                Depois que seu pedido estiver concluído, você poderá avaliar os
                produtos pelo mesmo navegador usado na compra.
              </p>
            </div>
          )}
          <div className="reviews-list">
            {data.reviews.map((r) => (
              <article className="review-card" key={r.id}>
                <div className="review-card-top">
                  <strong>{r.author}</strong>
                  <span>
                    <BadgeCheck size={14} />
                    Compra verificada
                  </span>
                </div>
                <div
                  className="review-stars"
                  aria-label={`${r.rating} de 5 estrelas`}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      size={15}
                      fill={n <= r.rating ? "currentColor" : "none"}
                    />
                  ))}
                </div>
                {!productId && (
                  <p className="review-product-name">{r.productName}</p>
                )}
                <p className="review-text">{r.text}</p>
                <time dateTime={new Date(r.createdAt).toISOString()}>
                  {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                </time>
                {r.reply && (
                  <div className="review-reply">
                    <strong>Resposta da Mundo Natural</strong>
                    <p>{r.reply}</p>
                  </div>
                )}
              </article>
            ))}
          </div>
          <Link
            className="button button-small button-outline"
            href={`/avaliacoes${productId ? `?produto=${encodeURIComponent(productId)}` : ""}`}
          >
            Quero avaliar minha compra <ArrowRight size={16} />
          </Link>
        </>
      )}
    </section>
  );
}
type Eligible = {
  orderId: string;
  productId: string;
  title: string;
  reviewed: boolean;
};
export function ReviewForm() {
  const [items, setItems] = useState<Eligible[] | null>(null),
    [choice, setChoice] = useState(""),
    [rating, setRating] = useState(0),
    [text, setText] = useState(""),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/reviews/eligibility", {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then((r) => r.json())
      .then((d) => {
        if (active) setItems(Array.isArray(d.products) ? d.products : []);
      })
      .catch(() => {
        if (active) setItems([]);
      });
    return () => {
      active = false;
    };
  }, []);
  const remaining = (items || []).filter((i) => !i.reviewed);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setMessage("");
    const selected = remaining.find(
      (i) => `${i.orderId}|${i.productId}` === choice,
    );
    if (!selected || !rating || !consent) {
      setError("Escolha um produto, a nota e autorize a publicação.");
      return;
    }
    setBusy(true);
    try {
      const s = await fetch("/api/checkout/session", {
          cache: "no-store",
          credentials: "same-origin",
        }),
        session = await s.json();
      if (!s.ok || !session.csrfToken)
        throw Error("Atualize a página no navegador usado na compra.");
      const r = await fetch("/api/reviews", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": session.csrfToken,
        },
        body: JSON.stringify({
          orderId: selected.orderId,
          productId: selected.productId,
          rating,
          text,
          publishConsent: consent,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Não foi possível enviar a avaliação.");
      setMessage(d.message);
      setItems(
        (previous) =>
          previous?.map((i) =>
            i === selected ? { ...i, reviewed: true } : i,
          ) || [],
      );
      setChoice("");
      setText("");
      setRating(0);
      setConsent(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="review-form-section">
      <span className="eyebrow">SUA OPINIÃO FAZ PARTE</span>
      <h2>Conte como foi sua compra</h2>
      {items === null ? (
        <p role="status">Consultando pedidos deste navegador…</p>
      ) : !remaining.length ? (
        <div className="reviews-empty">
          <BadgeCheck size={28} />
          <strong>
            Nenhum produto disponível para avaliar neste navegador
          </strong>
          <p>
            As avaliações são liberadas após a conclusão do pedido. Use o mesmo
            navegador da compra, enquanto o acesso ao pedido estiver válido. Se
            já avaliou, obrigado por compartilhar sua experiência!
          </p>
          <Link href="/pagamento/retorno">Acompanhar meu pedido</Link>
        </div>
      ) : (
        <form onSubmit={submit}>
          <fieldset className="checkout-fieldset" disabled={busy}>
            <label className="field-label">
              Produto da sua compra
              <select
                required
                value={choice}
                onChange={(e) => setChoice(e.target.value)}
              >
                <option value="">Selecione um produto</option>
                {remaining.map((i) => (
                  <option
                    key={`${i.orderId}|${i.productId}`}
                    value={`${i.orderId}|${i.productId}`}
                  >
                    {i.title} · {i.orderId.slice(-8)}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="review-rating">
              <legend>Que nota você dá ao produto?</legend>
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n}>
                  <input
                    type="radio"
                    name="review-rating"
                    value={n}
                    required
                    checked={rating === n}
                    onChange={() => setRating(n)}
                  />
                  <Star
                    size={27}
                    fill={n <= rating ? "currentColor" : "none"}
                  />
                  <span className="sr-only">
                    {n} {n === 1 ? "estrela" : "estrelas"}
                  </span>
                </label>
              ))}
            </fieldset>
            <label className="field-label">
              Sua avaliação
              <textarea
                required
                minLength={10}
                maxLength={600}
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Conte sobre sabor, preparo, embalagem e sua experiência…"
              />
              <small>
                {text.length}/600 caracteres. Evite informar telefone, e-mail ou
                endereço.
              </small>
            </label>
            <label className="checkout-contact-consent">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                Autorizo publicar minha avaliação e meu primeiro nome na loja.
              </span>
            </label>
            <button className="button" disabled={busy}>
              {busy ? "Enviando…" : "Enviar minha avaliação"}
            </button>
          </fieldset>
        </form>
      )}
      {error && (
        <p className="payment-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="admin-notice" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
