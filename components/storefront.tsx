"use client";
import { Suspense, useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  Leaf,
  MapPin,
  MessageCircle,
  PackageCheck,
  Scale,
  SlidersHorizontal,
  Search,
  X,
  Heart,
  Sprout,
  Sparkles,
} from "lucide-react";
import {
  products,
  featured,
  groups,
  searchProducts,
  inGroup,
} from "@/lib/products";
import { useCart } from "@/lib/cart-context";
import { whatsappUrl } from "@/lib/store";
import { ProductCard } from "./product-card";
import { ProductCarousel } from "./product-carousel";
import { referencePriceCents } from "@/lib/pricing.mjs";

import { ProductDeepLink } from "./product-deep-link";
import { StoreHelp } from "./store-help";
import { SearchAutocomplete } from "./search-autocomplete";
function QuerySync({
  onQuery,
}: {
  onQuery: (
    q: string,
    category: string,
    selection: boolean,
    offers: boolean,
  ) => void;
}) {
  const params = useSearchParams();
  useEffect(() => {
    onQuery(
      (params.get("q") || "").slice(0, 120),
      params.get("categoria") || "Todos",
      params.get("selecao") === "1",
      params.get("ofertas") === "1",
    );
  }, [params, onQuery]);
  return null;
}
const slides = [
  {
    label: "ESCOLHAS QUE FAZEM BEM",
    title: (
      <>
        Seu natural.
        <br />
        Na sua <em>medida.</em>
      </>
    ),
    description:
      "Castanhas, temperos e ingredientes para sua cozinha. Escolha de 100 em 100 g.",
    image: "hero-nuts",
  },
  {
    label: "NATUREZA NA MEDIDA CERTA",
    title: (
      <>
        O seu ritmo.
        <br />A sua <em>porção de natureza.</em>
      </>
    ),
    description:
      "Grãos, sementes e castanhas a granel. Preços por 100 g e quantidades de 100 em 100 g para montar sua seleção.",
    image: "hero-grains",
  },
  {
    label: "UMA PAUSA PARA VOCÊ",
    title: (
      <>
        Respire fundo.
        <br />
        Cultive seus <em>bons momentos.</em>
      </>
    ),
    description:
      "Um chá quentinho, um novo sabor, uma escolha com carinho. Seu próximo ritual começa aqui.",
    image: "hero-tea",
  },
];
const categories = [
  { name: "Castanhas", tile: 0, sub: "& oleaginosas" },
  { name: "Grãos e sementes", tile: 4, sub: "para sua rotina" },
  { name: "Chás e ervas", tile: 3, sub: "sua pausa natural" },
  { name: "Farinhas e pós", tile: 2, sub: "para suas receitas" },
  { name: "Temperos", tile: 5, sub: "mais sabor à mesa" },
  { name: "Mercearia", tile: 2, sub: "escolhas do dia a dia" },
];
export function Storefront({
  catalog = false,
  favoritesOnly = false,
}: {
  catalog?: boolean;
  favoritesOnly?: boolean;
}) {
  const [query, setQuery] = useState(""),
    [group, setGroup] = useState("Todos"),
    [selection, setSelection] = useState(false),
    [offersOnly, setOffersOnly] = useState(false),
    [sort, setSort] = useState("recommended"),
    [limit, setLimit] = useState(24),
    [slide, setSlide] = useState(0),
    [filters, setFilters] = useState(false);
  const { favorites, ready, catalog: products } = useCart();
  const combos = products.filter((p) => p.combo);
  const offers = products.filter((p) => p.originalPriceCents && !p.combo);
  const currentFeatured = featured
    .map((original) => products.find((p) => p.id === original.id))
    .filter((p): p is NonNullable<typeof p> => !!p);
  const onQuery = useCallback(
    (q: string, category: string, curated: boolean, discounted: boolean) => {
      setQuery(q);
      setGroup(groups.includes(category) ? category : "Todos");
      setSelection(curated);
      setOffersOnly(discounted);
      setLimit(24);
    },
    [],
  );
  const shown = useMemo(() => {
    let list = offersOnly
      ? offers
      : favoritesOnly
        ? products.filter((p) => favorites.includes(p.id))
        : selection || (!catalog && group === "Todos" && !query)
          ? currentFeatured
          : products;
    list = searchProducts(list, query).filter((p) => inGroup(p, group));
    if (sort === "recommended" && catalog)
      list = [...list].sort((a, b) => {
        const first = featured.findIndex((p) => p.id === a.id);
        const second = featured.findIndex((p) => p.id === b.id);
        return (
          (first < 0 ? featured.length : first) -
          (second < 0 ? featured.length : second)
        );
      });
    if (sort === "price-asc")
      list = [...list].sort(
        (a, b) => referencePriceCents(a) - referencePriceCents(b),
      );
    if (sort === "price-desc")
      list = [...list].sort(
        (a, b) => referencePriceCents(b) - referencePriceCents(a),
      );
    if (sort === "name")
      list = [...list].sort((a, b) =>
        a.nome_produto.localeCompare(b.nome_produto, "pt-BR"),
      );
    return list;
  }, [
    query,
    group,
    catalog,
    selection,
    offersOnly,
    sort,
    favoritesOnly,
    favorites,
    products,
  ]);
  const current = slides[slide];
  const CatalogHeading = catalog || favoritesOnly ? "h1" : "h2";
  return (
    <main id="conteudo">
      <Suspense>
        <QuerySync onQuery={onQuery} />
        <ProductDeepLink />
      </Suspense>
      {!catalog && !favoritesOnly && (
        <>
          <section className="hero">
            <div className="shell hero-inner">
              <div className="hero-copy">
                <span className="eyebrow">
                  <span /> {current.label}
                </span>
                <h1>{current.title}</h1>
                <p>{current.description}</p>
                <div className="hero-cta">
                  <a href="#catalogo" className="button">
                    Explore nossos produtos <ArrowRight size={18} />
                  </a>
                  <Link href="/sobre" className="hero-story">
                    Conheça a Mundo Natural <ArrowUpRight size={16} />
                  </Link>
                </div>
                <div className="hero-pagination" aria-label="Destaques">
                  {slides.map((s, i) => (
                    <button
                      key={s.label}
                      onClick={() => setSlide(i)}
                      className={i === slide ? "active" : ""}
                      aria-label={`Ver destaque ${i + 1}`}
                      aria-pressed={i === slide}
                    />
                  ))}
                  <span>UM POUQUINHO DE NATUREZA. TODOS OS DIAS.</span>
                </div>
              </div>
              <div className={`hero-visual ${current.image}`}>
                <div className="hero-orbit" />
                <div
                  className="hero-bowl"
                  role="img"
                  aria-label={
                    slide === 0
                      ? "Bowl de castanhas naturais"
                      : slide === 1
                        ? "Grãos e aveia"
                        : "Chá de ervas"
                  }
                />
                <div className="hero-stamp">
                  <Sprout size={28} />
                  <span>
                    NATURALMENTE
                    <br />
                    <strong>faz bem.</strong>
                  </span>
                </div>
                <div className="hero-note">
                  <Leaf size={22} />
                  <div>
                    <strong>Da natureza para a sua rotina.</strong>
                    <span>Simples. Saboroso. Do seu jeito.</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <section
            className="benefits shell"
            aria-label="Vantagens da Mundo Natural"
          >
            {[
              {
                icon: MapPin,
                title: "Pertinho de você",
                text: "Sua loja em Taboão da Serra",
              },
              {
                icon: Scale,
                title: "Na medida certa",
                text: "Escolha sua porção a granel",
              },
              {
                icon: PackageCheck,
                title: "Retire na nossa loja",
                text: "Combine pelo atendimento",
              },
              {
                icon: MessageCircle,
                title: "Gente que cuida",
                text: "Atendimento pelo WhatsApp",
              },
            ].map(({ icon: Icon, title, text }) => (
              <div className="benefit" key={title}>
                <span>
                  <Icon size={25} strokeWidth={1.5} />
                </span>
                <div>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </section>
          <section className="section shell category-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">ENCONTRE O SEU NATURAL</span>
                <h2>O que combina com você?</h2>
              </div>
              <Link href="/produtos" className="section-link">
                Ver todas as categorias <ArrowRight size={16} />
              </Link>
            </div>
            <div className="category-grid">
              {categories.map((category) => (
                <Link
                  className="category-card"
                  key={category.name}
                  href={`/produtos?categoria=${encodeURIComponent(category.name)}`}
                >
                  <div className={`category-photo tile-${category.tile}`}>
                    {category.tile === -1 && (
                      <Sprout size={44} strokeWidth={1.1} />
                    )}
                  </div>
                  <strong>{category.name}</strong>
                  <span>{category.sub}</span>
                </Link>
              ))}
            </div>
          </section>
          <section className="shell discovery-banner">
            <div>
              <span className="discovery-icon">
                <Leaf size={23} />
              </span>
              <p>
                Uma escolha pequena.
                <strong>Um cuidado que faz a diferença.</strong>
              </p>
            </div>
            <Link href="/produtos">
              Encontre seus novos favoritos <ArrowRight size={17} />
            </Link>
            <span className="banner-drawing">
              <Sprout size={90} strokeWidth={0.6} />
            </span>
          </section>
        </>
      )}
      {!favoritesOnly && !offersOnly && !query && group === "Todos" && (
        <>
          <ProductCarousel
            title="Boas escolhas, melhores preços"
            eyebrow="OFERTAS DA LOJA"
            description="Descontos nos produtos que você gosta. Valores a granel sempre por 100 g."
            products={offers}
            href="/produtos?ofertas=1"
          />
          <ProductCarousel
            title="Combinações que facilitam sua rotina"
            eyebrow="COMBOS MUNDO NATURAL"
            description="Ingredientes selecionados e embalados separadamente. Confira o que vem em cada combo."
            products={combos}
            href="/produtos?categoria=Combos"
          />
        </>
      )}
      <section
        id="catalogo"
        className={`section shell catalog-section ${catalog || favoritesOnly ? "full-catalog" : ""}`}
      >
        {(catalog || favoritesOnly) && (
          <div className="breadcrumbs">
            <Link href="/">Início</Link>
            <ChevronRight size={13} />
            <span>{favoritesOnly ? "Favoritos" : "Produtos"}</span>
          </div>
        )}
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              {favoritesOnly
                ? "SEU MUNDO, SUAS ESCOLHAS"
                : catalog
                  ? `${products.length} PRODUTOS PARA EXPLORAR`
                  : "SELECIONADOS COM CARINHO"}
            </span>
            <CatalogHeading>
              {favoritesOnly
                ? "Seus favoritos naturais"
                : catalog
                  ? offersOnly
                    ? "Ofertas da Mundo Natural"
                    : selection
                      ? "Escolhas naturais"
                      : "Um mundo de coisas boas"
                  : "Seu próximo cuidado começa aqui"}
            </CatalogHeading>
            {(catalog || favoritesOnly) && (
              <p className="section-description">
                {favoritesOnly
                  ? "Guarde o que combina com você e volte quando quiser."
                  : "A granel com preços por 100 g: escolha 100 g, 200 g, 300 g e monte sua seleção."}
              </p>
            )}
          </div>
          {!catalog && !favoritesOnly && (
            <Link href="/produtos" className="section-link">
              Explorar todo o catálogo <ArrowRight size={16} />
            </Link>
          )}
        </div>
        <div className="catalog-toolbar">
          <div className="filter-chips" aria-label="Filtrar por categoria">
            {groups.map((name) => (
              <button
                key={name}
                className={`filter-chip ${group === name ? "active" : ""}`}
                aria-pressed={group === name}
                onClick={() => {
                  setGroup(name);
                  setLimit(24);
                }}
              >
                {name}
              </button>
            ))}
          </div>
          <button
            className="filter-toggle"
            aria-expanded={filters}
            onClick={() => setFilters(!filters)}
          >
            <SlidersHorizontal size={17} /> Filtros
          </button>
        </div>
        {(catalog || favoritesOnly || filters) && (
          <div className="catalog-search-row">
            <SearchAutocomplete
              compact
              value={query}
              onChange={(next) => {
                setQuery(next);
                setLimit(24);
              }}
            />
            <label className="sort-label">
              Ordenar por
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="recommended">Nossa seleção</option>
                <option value="price-asc">Menor preço</option>
                <option value="price-desc">Maior preço</option>
                <option value="name">Nome: A a Z</option>
              </select>
            </label>
          </div>
        )}
        {catalog && (
          <p className="result-count" role="status">
            {shown.length}{" "}
            {shown.length === 1 ? "produto encontrado" : "produtos encontrados"}
            {query && ` para “${query}”`}
          </p>
        )}
        {shown.length ? (
          <div className="product-grid">
            {shown.slice(0, limit).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            {favoritesOnly ? (
              <Heart size={42} strokeWidth={1.2} />
            ) : (
              <Search size={42} strokeWidth={1.2} />
            )}
            <h3>
              {favoritesOnly
                ? ready
                  ? "Seus favoritos moram aqui"
                  : "Carregando seus favoritos…"
                : "Ainda não encontramos essa combinação"}
            </h3>
            <p>
              {favoritesOnly
                ? "Toque no coração dos produtos para montar uma seleção só sua."
                : "Tente outro ingrediente ou explore todas as categorias."}
            </p>
            {favoritesOnly ? (
              <Link href="/produtos" className="button">
                Explorar produtos <ArrowRight size={17} />
              </Link>
            ) : (
              <button
                className="button"
                onClick={() => {
                  setGroup("Todos");
                  setQuery("");
                  setSelection(false);
                }}
              >
                Limpar filtros
              </button>
            )}
          </div>
        )}
        {shown.length > limit && (
          <div className="load-more">
            <button
              className="button button-outline"
              onClick={() => setLimit(limit + 24)}
            >
              Mostrar mais produtos <PlusIcon />
            </button>
            <p>
              {Math.min(limit, shown.length)} de {shown.length} produtos
            </p>
          </div>
        )}
        <p className="catalog-disclaimer">
          Preços informados pela loja. Consulte disponibilidade e informações de
          alergênicos com a loja. Imagens ilustrativas.
        </p>
      </section>
      {!catalog && !favoritesOnly && (
        <>
          <section className="shell lifestyle-grid">
            <div className="lifestyle-card lifestyle-tea">
              <img
                src="/herbal-tea-natural-wellness.jpg"
                alt="Chá de ervas em uma pausa tranquila"
                loading="lazy"
              />
              <div>
                <span className="eyebrow">SEU MOMENTO DE PAUSA</span>
                <h2>
                  Desacelere.
                  <br />
                  <em>Saboreie o agora.</em>
                </h2>
                <Link href="/produtos?categoria=Ch%C3%A1s%20e%20ervas">
                  Encontre seu chá <ArrowRight size={18} />
                </Link>
              </div>
            </div>
            <div className="lifestyle-card lifestyle-grains">
              <div>
                <span className="eyebrow">DO SEU JEITO, NA SUA MEDIDA</span>
                <h2>
                  Mais variedade.
                  <br />
                  <em>Menos desperdício.</em>
                </h2>
                <p>Leve a porção que faz sentido para a sua rotina.</p>
                <Link href="/produtos?categoria=Gr%C3%A3os%20e%20sementes">
                  Explore os produtos a granel <ArrowRight size={18} />
                </Link>
              </div>
              <Scale size={110} strokeWidth={0.7} />
            </div>
          </section>
          <section className="section shell store-story">
            <div className="store-story-photo">
              <img
                src="/images/loja-mundo-natural.webp"
                alt="Fachada e interior da loja Mundo Natural em Taboão da Serra"
                loading="lazy"
              />
              <span>
                <MapPin size={15} /> TABOÃO DA SERRA · SP
              </span>
            </div>
            <div className="store-story-copy">
              <span className="eyebrow">DE VERDADE. DE PERTINHO.</span>
              <h2>
                Seu cantinho natural.
                <br />
                <em>Agora, também aqui.</em>
              </h2>
              <p>
                A gente acredita que cuidar de si começa nas pequenas escolhas.
                Por isso, reunimos sabores, ingredientes e um atendimento com o
                carinho de quem conhece você.
              </p>
              <p>
                Visite nossa loja, descubra novos favoritos e traga mais
                natureza para o seu dia.
              </p>
              <Link href="/sobre" className="button button-outline">
                Conheça nossa história <ArrowUpRight size={17} />
              </Link>
            </div>
          </section>
          <section className="help-banner">
            <div className="shell">
              <div>
                <Sparkles size={29} />
                <div>
                  <h2>Seu próximo passo pode ser mais natural.</h2>
                  <p>
                    Precisa de uma mão para escolher? Converse com a nossa
                    equipe.
                  </p>
                </div>
              </div>
              <a
                className="button button-cream"
                href={whatsappUrl()}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle size={19} /> Vamos conversar
              </a>
            </div>
          </section>
        </>
      )}
      <StoreHelp />
    </main>
  );
}
function PlusIcon() {
  return <span aria-hidden="true">+</span>;
}
