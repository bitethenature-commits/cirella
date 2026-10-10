"use client";

import { useState } from "react";
import { termsCheckboxText, WAIVER_TEXT, waiverKindFor } from "@/lib/legal";

const TERMS = "condiciones de venta";
const REFUNDS = "política de cambios y reembolsos";

function Check({ name, checked, onChange, children }: { name: string; checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-2.5 px-1 py-1 text-xs leading-relaxed" style={{ color: "var(--c-muted)" }}>
      <input type="checkbox" name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--c-accent)]" />
      <span>{children}</span>
    </label>
  );
}

/**
 * Casillas del checkout: condiciones de venta (obligatoria, sin marcar de inicio), renuncia al
 * desistimiento según el producto y novedades por email (opcional). Controladas: React resetea
 * los formularios con acción tras cada envío y un pago rechazado no debe desmarcarlas.
 * Las valida lib/checkout-consents.ts en el servidor.
 */
export function CheckoutConsents({
  productType,
  billingInterval,
  price,
  seller,
  creatorDisplayName,
}: {
  productType: string;
  billingInterval: string | null;
  price: string;
  seller: { name: string; legalHref: string };
  creatorDisplayName: string;
}) {
  const [terms, setTerms] = useState(false);
  const [waiver, setWaiver] = useState(false);
  const [newsletter, setNewsletter] = useState(false);
  const kind = waiverKindFor(productType);

  // El texto sale de lib/legal.ts (el mismo que se valida y se cita en el recibo); aquí solo se
  // enlazan las dos políticas.
  const text = termsCheckboxText({ sellerName: seller.name, billingInterval, price });
  const [beforeTerms, afterTerms] = text.split(TERMS);
  const [between, afterRefunds] = afterTerms.split(REFUNDS);
  const link = (section: string, label: string) => (
    <a href={`${seller.legalHref}#${section}`} target="_blank" rel="noopener" className="underline underline-offset-2" style={{ color: "var(--c-text)" }}>
      {label}
    </a>
  );

  return (
    <div className="space-y-1">
      <Check name="acceptTerms" checked={terms} onChange={setTerms}>
        {beforeTerms}
        {link("condiciones", TERMS)}
        {between}
        {link("reembolsos", REFUNDS)}
        {afterRefunds}
      </Check>
      {kind && (
        <Check name="waiver" checked={waiver} onChange={setWaiver}>
          {WAIVER_TEXT[kind]}
        </Check>
      )}
      <Check name="newsletter" checked={newsletter} onChange={setNewsletter}>
        Quiero recibir novedades y ofertas de {creatorDisplayName} por email (opcional). Puedes darte de baja cuando quieras.
      </Check>
    </div>
  );
}

/** Primera capa de información de privacidad, bajo el email (RGPD art. 13). */
export function PrivacyNotice({ sellerName, legalHref, platformName }: { sellerName: string; legalHref: string; platformName: string }) {
  return (
    <p className="cp-faint mt-1.5 text-xs leading-relaxed">
      Responsable: {sellerName}. Usamos tu nombre y email para gestionar tu compra y darte acceso; {platformName} los trata por encargo suyo. Puedes
      acceder, rectificar o suprimir tus datos. Más información en la{" "}
      <a href={`${legalHref}#privacidad`} target="_blank" rel="noopener" className="underline underline-offset-2">
        política de privacidad
      </a>
      .
    </p>
  );
}
