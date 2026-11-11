"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie, ShieldCheck } from "lucide-react";
import { Modal } from "./modal";
import { readConsent, saveConsent } from "@/lib/privacy.mjs";
export function CookieConsent() {
  const [visible, setVisible] = useState(false),
    [open, setOpen] = useState(false),
    [preferences, setPreferences] = useState(false);
  useEffect(() => {
    const consent = readConsent();
    setVisible(!consent);
    setPreferences(!!consent?.preferences);
    const edit = () => {
      setPreferences(!!readConsent()?.preferences);
      setOpen(true);
    };
    window.addEventListener("open-cookie-settings", edit);
    return () => window.removeEventListener("open-cookie-settings", edit);
  }, []);
  function save(value: boolean) {
    saveConsent(value);
    setPreferences(value);
    setVisible(false);
    setOpen(false);
  }
  return (
    <>
      {visible && (
        <aside
          className="cookie-banner"
          aria-label="Suas preferências de privacidade"
        >
          <div className="cookie-copy">
            <span className="cookie-icon">
              <Cookie size={23} />
            </span>
            <div>
              <strong>Seu bem-estar também é digital.</strong>
              <p>
                Usamos armazenamento essencial para o carrinho. Você escolhe se
                quer lembrar seus favoritos.{" "}
                <Link href="/privacidade">Saiba mais</Link>
              </p>
            </div>
          </div>
          <div className="cookie-actions">
            <button className="text-button" onClick={() => setOpen(true)}>
              Personalizar
            </button>
            <button
              className="button button-outline button-small"
              onClick={() => save(false)}
            >
              Só essenciais
            </button>
            <button className="button button-small" onClick={() => save(true)}>
              Aceitar todos
            </button>
          </div>
        </aside>
      )}
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Sua privacidade, suas escolhas"
        description="Você pode mudar estas opções a qualquer momento pelo rodapé do site."
      >
        <div className="privacy-option">
          <div>
            <strong>
              <ShieldCheck size={18} /> Essenciais
            </strong>
            <p>
              Mantêm seu carrinho por até 30 dias e registram sua escolha de
              privacidade por até 180 dias, neste navegador.
            </p>
          </div>
          <span className="essential-label">Sempre ativos</span>
        </div>
        <div className="privacy-option">
          <div>
            <strong>Preferências</strong>
            <p>
              Permitem lembrar seus produtos favoritos entre visitas. Desativar
              esta opção apaga os favoritos salvos.
            </p>
          </div>
          <input
            type="checkbox"
            role="switch"
            className="switch"
            aria-label="Lembrar favoritos entre visitas"
            checked={preferences}
            onChange={(event) => setPreferences(event.target.checked)}
          />
        </div>
        <p className="privacy-note">
          Não usamos cookies de publicidade nem ferramentas de rastreamento. Sem
          esta permissão, seus favoritos ficam apenas durante a visita.
        </p>
        <div className="modal-actions">
          <button className="button button-outline" onClick={() => save(false)}>
            Só essenciais
          </button>
          <button className="button" onClick={() => save(preferences)}>
            Salvar escolhas
          </button>
        </div>
      </Modal>
    </>
  );
}
