"use client";
import { useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard, ShoppingBag, Package, MessageCircle, Tags, TicketPercent,
  Truck, Star, BookOpen, Wallet, ReceiptText, Settings2, Mail, CreditCard,
  Activity, LogOut, ShieldCheck, Menu, ArrowUpRight, Coins,
} from "lucide-react";
import { Modal } from "./modal";

export const adminGroups = [
  { label: "Dia a dia", items: [
    { id: "dashboard", label: "Visão geral", description: "Sua loja, seus pedidos e o que precisa de atenção.", icon: LayoutDashboard },
    { id: "orders", label: "Pedidos", description: "Separe, embale e acompanhe cada entrega em um só lugar.", icon: ShoppingBag },
    { id: "messages", label: "Mensagens", description: "Personalize os textos usados no atendimento pelo WhatsApp.", icon: MessageCircle },
  ] },
  { label: "Catálogo", items: [
    { id: "products", label: "Produtos e fotos", description: "Organize os produtos, os preços e as fotos da sua vitrine.", icon: Package },
    { id: "merchandising", label: "Ofertas e combos", description: "Monte combinações e ofertas com os descontos que você escolher.", icon: Tags },
    { id: "coupons", label: "Cupons", description: "Crie e acompanhe os cupons da loja.", icon: TicketPercent },
    { id: "content", label: "Conteúdo e receitas", description: "Ajude o cliente a escolher com informações e receitas.", icon: BookOpen },
    { id: "reviews", label: "Avaliações", description: "Leia, responda e publique opiniões de compras verificadas.", icon: Star },
  ] },
  { label: "Gestão", items: [
    { id: "finance", label: "Financeiro", description: "Entenda o resultado das vendas, os custos e as despesas.", icon: Wallet },
    { id: "costs", label: "Custos e importação", description: "Importe os custos do PDV com conferência antes de aplicar.", icon: Coins },
    { id: "expenses", label: "Despesas", description: "Registre os gastos que fazem parte da operação.", icon: ReceiptText },
    { id: "shipping", label: "Frete e entregas", description: "Defina a área atendida, as rotas e o valor da entrega.", icon: Truck },
  ] },
  { label: "Configuração", items: [
    { id: "setup", label: "Configuração", description: "Confira o que está pronto e conclua a configuração da loja.", icon: Settings2 },
    { id: "notifications", label: "E-mails automáticos", description: "Configure os avisos que acompanham o cliente após a compra.", icon: Mail },
    { id: "payments", label: "Pagamentos", description: "Confira a integração e faça a homologação privada do Mercado Pago.", icon: CreditCard },
    { id: "audit", label: "Atividade", description: "Consulte o histórico das alterações feitas pela equipe.", icon: Activity },
  ] },
];
export const adminAreas = adminGroups.flatMap((group) => group.items);

export function AdminNavigation({
  active, onNavigate, onLogout, busy, mfa,
}: {
  active: string; onNavigate: (id: string) => void; onLogout: () => void;
  busy: boolean; mfa: boolean;
}) {
  const [open, setOpen] = useState(false);
  function navigate(id: string) {
    onNavigate(id);
    setOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function links() {
    return (
      <nav aria-label="Painel administrativo" className="admin-navigation-groups">
        {adminGroups.map((group) => (
          <div className="admin-navigation-group" key={group.label}>
            <span className="admin-navigation-label">{group.label}</span>
            {group.items.map(({ id, label, icon: Icon }) => (
              <button type="button" key={id} className={active === id ? "active" : ""}
                aria-current={active === id ? "page" : undefined} onClick={() => navigate(id)}>
                <Icon size={18} aria-hidden="true" /><span>{label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>
    );
  }
  return (
    <>
      <aside className="admin-sidebar workspace-sidebar">
        <Link href="/" className="workspace-brand" aria-label="Mundo Natural — voltar à loja">
          <img src="/images/mundo-natural-logo.webp" alt="" width={44} height={44} />
          <span><strong>Mundo Natural</strong><small>Gestão da loja</small></span>
        </Link>
        {links()}
        <div className="workspace-sidebar-footer">
          <span className="admin-session"><ShieldCheck size={14} />{mfa ? "Acesso com autenticador" : "Sessão protegida"}</span>
          <Link href="/" target="_blank" rel="noopener noreferrer">Abrir minha loja <ArrowUpRight size={15} /></Link>
          <button type="button" disabled={busy} onClick={onLogout}><LogOut size={16} /> Sair do painel</button>
        </div>
      </aside>
      <button type="button" className="workspace-mobile-menu" aria-label="Abrir menu do painel"
        aria-expanded={open} onClick={() => setOpen(true)}><Menu size={22} /></button>
      <Modal open={open} onOpenChange={setOpen} title="Áreas do painel" className="admin-menu-dialog">
        <p className="fine-print">Mundo Natural · gestão da loja</p>
        {links()}
        <button type="button" className="button button-outline full-width" disabled={busy} onClick={onLogout}><LogOut size={16} /> Sair do painel</button>
      </Modal>
    </>
  );
}
