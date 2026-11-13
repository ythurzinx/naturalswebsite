"use client";
import { useCallback, useEffect, useState } from "react";
import { Star, BadgeCheck, RefreshCw } from "lucide-react";
type Api = <T>(
  path: string,
  method?: string,
  body?: Record<string, unknown>,
) => Promise<T>;
type Review = {
  id: string;
  orderId: string;
  productName: string;
  author: string;
  rating: number;
  text: string;
  createdAt: number;
  published: boolean;
  reply: string;
};
export function AdminReviews({ api }: { api: Api }) {
  const [items, setItems] = useState<Review[]>([]),
    [replies, setReplies] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try {
      const d = await api<{ reviews: Review[] }>("reviews");
      setItems(d.reviews);
      setReplies(
        Object.fromEntries(d.reviews.map((r) => [r.id, r.reply || ""])),
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível carregar as avaliações.",
      );
    }
  }, [api]);
  useEffect(() => {
    void load();
  }, [load]);
  async function save(item: Review, published: boolean) {
    setBusy(item.id);
    setError("");
    setNotice("");
    try {
      await api(`reviews/${item.id}`, "PUT", {
        published,
        reply: replies[item.id] || "",
      });
      await load();
      setNotice(
        published
          ? "Avaliação publicada. A nota e o texto originais foram preservados."
          : "Avaliação ocultada. O registro foi preservado.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="admin-reviews">
      <div className="section-heading">
        <div>
          <span className="eyebrow">OUVIR TAMBÉM É CUIDAR</span>
          <h2>Avaliações de clientes</h2>
          <p>
            Somente produtos de pedidos concluídos. Analise o conteúdo e
            responda pela loja.
          </p>
        </div>
        <button
          className="icon-button"
          aria-label="Atualizar avaliações"
          onClick={() => void load()}
        >
          <RefreshCw size={18} />
        </button>
      </div>
      <p className="fine-print">
        Publique opiniões positivas ou negativas que respeitem as regras. Oculte
        dados pessoais, ofensas e spam. Evite publicar promessas de cura ou
        resultados garantidos. As estrelas e o texto do cliente não podem ser
        alterados pelo painel.
      </p>
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
      {!items.length && (
        <div className="admin-panel reviews-empty">
          <BadgeCheck size={30} />
          <h3>Ainda não há avaliações recebidas</h3>
          <p>
            As avaliações de compras verificadas chegarão aqui para análise.
          </p>
        </div>
      )}
      {items.map((item) => (
        <article key={item.id} className="admin-panel review-moderation-card">
          <div className="review-card-top">
            <strong>
              {item.author} · {item.productName}
            </strong>
            <span
              className={`admin-badge ${item.published ? "paid" : "pending"}`}
            >
              {item.published ? "Publicada" : "Não publicada"}
            </span>
          </div>
          <div
            className="review-stars"
            aria-label={`${item.rating} de 5 estrelas`}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                size={17}
                key={n}
                fill={n <= item.rating ? "currentColor" : "none"}
              />
            ))}
          </div>
          <p className="review-text">{item.text}</p>
          <p className="fine-print">
            Pedido verificado: {item.orderId} ·{" "}
            {new Date(item.createdAt).toLocaleString("pt-BR")}
          </p>
          <label className="field-label">
            Resposta da loja (opcional)
            <textarea
              rows={3}
              maxLength={600}
              value={replies[item.id] || ""}
              onChange={(e) =>
                setReplies({ ...replies, [item.id]: e.target.value })
              }
            />
          </label>
          <div className="review-moderation-actions">
            <button
              className="button button-small"
              disabled={!!busy}
              onClick={() => void save(item, true)}
            >
              {item.published ? "Salvar resposta" : "Publicar avaliação"}
            </button>
            <button
              className="button button-small button-outline"
              disabled={!!busy}
              onClick={() => void save(item, false)}
            >
              Ocultar avaliação
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
