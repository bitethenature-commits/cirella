"use client";

import { CalendarClock, Check, CreditCard, Loader2, Lock, ShieldCheck, Smartphone } from "lucide-react";
import { startTransition, useActionState, useEffect, useState } from "react";
import { BillingFields, VatBreakdown, type BillingPrefill, type CheckoutTaxInfo } from "@/components/checkout/billing-fields";
import { ProductImage } from "@/components/creator-page/product-art";
import type { DaySlots } from "@/lib/booking";
import { sessionChangePolicyText } from "@/lib/legal";
import { formatPrice } from "@/lib/money";
import { decideTax, vatIncluded } from "@/lib/tax";
import { PRODUCT_TYPE_LABEL, type ProductType } from "@/lib/types";
import { placeOrder, type CheckoutState } from "./actions";
import { CheckoutConsents, PrivacyNotice } from "./consents";

type Product = {
  id: string;
  type: string;
  title: string;
  emoji: string | null;
  imageUrl: string | null;
  priceCents: number;
  currency: string;
  billingInterval: string | null;
  durationMin: number | null;
  ctaLabel: string | null;
};

function PayButton({ label, disabled, pending }: { label: string; disabled?: boolean; pending: boolean }) {
  return (
    <button type="submit" disabled={pending || disabled} className="cp-btn h-14 w-full text-base disabled:opacity-60">
      {pending ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" /> Procesando pago…
        </>
      ) : (
        <>
          <Lock className="h-4 w-4" /> {label}
        </>
      )}
    </button>
  );
}

function SectionTitle({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="flex items-center gap-3 text-[0.95rem] font-semibold">
      <span className="grid h-6 w-6 place-items-center rounded-full text-xs" style={{ background: "var(--c-accent)", color: "var(--c-accent-text)" }}>
        {n}
      </span>
      {title}
    </h2>
  );
}

export function CheckoutForm({
  product,
  payoutReady,
  collectsCardOnSite,
  initialOrderId,
  notice,
  prefill,
  demo,
  creatorName,
  seller,
  platformName,
  taxInfo,
  canInvoice,
  defaultCountry,
  billingPrefill,
}: {
  product: Product;
  payoutReady: boolean;
  /** true solo con el simulador; con Stripe la tarjeta se pide en su página. */
  collectsCardOnSite: boolean;
  /** Pedido que se reintenta (vuelta desde la pasarela o desde el email). */
  initialOrderId?: string;
  notice?: string;
  prefill: { name: string; email: string };
  demo: boolean;
  creatorName: string;
  /** Quién vende: nombre fiscal, «Nombre · NIF …» y su página legal (/{usuario}/legal). */
  seller: { name: string; line: string; legalHref: string };
  platformName: string;
  /** Política de IVA y situación de la creadora: el desglose se calcula aquí según el país elegido. */
  taxInfo: CheckoutTaxInfo;
  /** ¿Se puede pedir factura con NIF? (vende Cirella, o la creadora repercute IVA y tiene sus datos). */
  canInvoice: boolean;
  /** País de la IP o del idioma del navegador. */
  defaultCountry: string;
  billingPrefill?: BillingPrefill;
}) {
  const [state, action, pending] = useActionState<CheckoutState, FormData>(placeOrder, undefined);
  const [method, setMethod] = useState<"card" | "wallet">("card");
  const [slots, setSlots] = useState<{ days: DaySlots[]; timezone: string } | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string>("");
  const [later, setLater] = useState(false);
  // Campos controlados: React resetea los formularios con acción tras cada envío y
  // no queremos que un pago rechazado borre el nombre y el email.
  const [name, setName] = useState(prefill.name);
  const [email, setEmail] = useState(prefill.email);
  const [country, setCountry] = useState(defaultCountry);
  const isSession = product.type === "SESSION";
  const price = formatPrice(product.priceCents, product.currency, product.billingInterval);
  const withVat = vatIncluded(
    decideTax({
      mode: taxInfo.mode,
      productType: product.type,
      buyerCountry: country,
      creator: { country: taxInfo.creatorCountry, vatStatus: taxInfo.creatorVatStatus, vatExemptionNote: taxInfo.creatorVatNote },
    }),
  );

  useEffect(() => {
    if (!isSession) return;
    fetch(`/api/slots?productId=${product.id}`)
      .then((r) => r.json())
      .then((d) => {
        setSlots(d);
        if (d.days?.[0]) setDay(d.days[0].date);
      })
      .catch(() => setSlots({ days: [], timezone: "" }));
  }, [isSession, product.id]);

  const selectedDay = slots?.days.find((d) => d.date === day);
  const sessionReady = !isSession || later || !!slot;
  let n = 0;

  return (
    <form
      // onSubmit en lugar de action={}: React vacía el formulario tras cada envío y un pago rechazado
      // o un NIF mal escrito desmarcaría las casillas (que siguen marcadas en el estado).
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="space-y-6"
    >
      <input type="hidden" name="productId" value={product.id} />
      <input type="hidden" name="orderId" value={state?.orderId ?? initialOrderId ?? ""} />
      {collectsCardOnSite && <input type="hidden" name="method" value={method} />}
      <input type="hidden" name="slotStart" value={later ? "" : slot} />

      <div>
        <p className="cp-eyebrow">Checkout seguro</p>
        <h1 className="cp-display mt-2 text-[2.2rem]">Completa tu compra</h1>
        <p className="cp-muted mt-2 text-xs">
          Vende: {seller.line} ·{" "}
          <a href={`${seller.legalHref}#condiciones`} target="_blank" rel="noopener" className="underline underline-offset-2">
            Condiciones
          </a>
        </p>
      </div>

      {/* Resumen */}
      <div className="cp-card flex items-center gap-4 p-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden" style={{ borderRadius: "calc(var(--r-card) * 0.6)" }}>
          <ProductImage src={product.imageUrl} emoji={product.emoji} title={product.title} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="cp-muted text-xs">{PRODUCT_TYPE_LABEL[product.type as ProductType]}{isSession && product.durationMin ? ` · ${product.durationMin} min` : ""}</p>
          <p className="cp-display truncate text-[1.35rem]">{product.title}</p>
          <p className="text-sm font-semibold">
            {price}
            {withVat && <span className="cp-muted font-normal"> · IVA incluido</span>}
          </p>
        </div>
      </div>

      {isSession && (
        <section className="cp-card space-y-4 p-5">
          <SectionTitle n={++n} title="Elige fecha y hora" />
          {!slots ? (
            <p className="cp-muted flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Cargando disponibilidad…</p>
          ) : slots.days.length === 0 ? (
            <p className="cp-muted text-sm">No hay huecos disponibles ahora mismo. Puedes reservar y elegir la fecha más adelante.</p>
          ) : (
            <div className={later ? "pointer-events-none opacity-40" : ""}>
              <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 scrollbar-none">
                {slots.days.map((d) => (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => {
                      setDay(d.date);
                      setSlot("");
                    }}
                    className="flex w-[3.9rem] shrink-0 flex-col items-center rounded-2xl border py-2.5 transition"
                    style={
                      day === d.date
                        ? { background: "var(--c-accent)", color: "var(--c-accent-text)", borderColor: "transparent" }
                        : { borderColor: "var(--c-line)" }
                    }
                  >
                    <span className="text-[0.65rem] uppercase tracking-wider opacity-75">{d.weekday}</span>
                    <span className="text-xl font-semibold leading-tight">{d.day}</span>
                    <span className="text-[0.65rem] opacity-75">{d.month}</span>
                  </button>
                ))}
              </div>
              {selectedDay && (
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {selectedDay.slots.map((s) => (
                    <button
                      key={s.start}
                      type="button"
                      onClick={() => setSlot(s.start)}
                      className="h-11 rounded-xl border text-sm font-medium tabular-nums transition"
                      style={
                        slot === s.start
                          ? { background: "var(--c-text)", color: "var(--c-bg)", borderColor: "transparent" }
                          : { borderColor: "var(--c-line)" }
                      }
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
              <p className="cp-faint mt-3 text-xs">Horario de {creatorName} ({slots.timezone.replace("_", " ")})</p>
            </div>
          )}
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input type="checkbox" checked={later} onChange={(e) => setLater(e.target.checked)} className="h-4 w-4 accent-[var(--c-accent)]" />
            Prefiero elegir la fecha después del pago
          </label>
        </section>
      )}

      <section className="cp-card space-y-4 p-5">
        <SectionTitle n={++n} title="Tus datos" />
        <div>
          <label className="mb-1.5 block text-xs font-medium" htmlFor="name">Nombre</label>
          <input id="name" name="name" required minLength={2} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="cp-input" placeholder="Tu nombre" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="cp-input" placeholder="tu@email.com" />
          <p className="cp-faint mt-1.5 text-xs">Aquí recibirás el acceso. No necesitas crear una cuenta ni contraseña.</p>
          <PrivacyNotice sellerName={seller.name} legalHref={seller.legalHref} platformName={platformName} />
        </div>
        <BillingFields country={country} onCountryChange={setCountry} canInvoice={canInvoice} prefill={billingPrefill} />
      </section>

      <section className="cp-card space-y-4 p-5">
        <SectionTitle n={++n} title="Método de pago" />
        {collectsCardOnSite ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "card" as const, label: "Tarjeta", icon: CreditCard },
                { key: "wallet" as const, label: "Apple / Google Pay", icon: Smartphone },
              ].map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMethod(m.key)}
                  className="flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition"
                  style={method === m.key ? { borderColor: "var(--c-accent)", boxShadow: "0 0 0 1px var(--c-accent)" } : { borderColor: "var(--c-line)" }}
                >
                  <m.icon className="h-4 w-4" /> {m.label}
                </button>
              ))}
            </div>
            {method === "card" ? (
              <div className="space-y-3">
                <input name="cardNumber" inputMode="numeric" autoComplete="cc-number" className="cp-input tabular-nums" placeholder="Número de tarjeta" defaultValue={demo ? "4242 4242 4242 4242" : ""} />
                <div className="grid grid-cols-2 gap-3">
                  <input inputMode="numeric" autoComplete="cc-exp" className="cp-input" placeholder="MM/AA" defaultValue={demo ? "12/29" : ""} />
                  <input inputMode="numeric" autoComplete="cc-csc" className="cp-input" placeholder="CVC" defaultValue={demo ? "123" : ""} />
                </div>
              </div>
            ) : (
              <p className="cp-muted text-sm">Confirmarás el pago con Face ID, huella o tu código en el siguiente paso.</p>
            )}
          </>
        ) : (
          <p className="cp-muted flex items-start gap-2.5 text-sm">
            <CreditCard className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Pagarás con tarjeta, Apple Pay o Google Pay en la página segura de Stripe. Si tu banco lo pide, confirmarás el pago en su app.</span>
          </p>
        )}
        {demo && (
          <p className="rounded-xl px-3 py-2 text-xs" style={{ background: "color-mix(in oklab, var(--c-gold) 16%, transparent)" }}>
            Modo demostración: no se cobra dinero real. Usa <span className="font-mono">4000 0000 0000 0002</span> para simular un pago rechazado y{" "}
            <span className="font-mono">4000 0027 6000 3184</span> para simular la confirmación en la app del banco.
          </p>
        )}
      </section>

      <div className="space-y-4">
        <div className="flex items-baseline justify-between px-1">
          <span className="cp-muted text-sm">Total</span>
          <span className="text-2xl font-semibold tracking-tight">{price}</span>
        </div>
        <VatBreakdown amountCents={product.priceCents} currency={product.currency} productType={product.type} taxInfo={taxInfo} country={country} platformName={platformName} />
        {isSession && (
          <p className="cp-faint -mt-2 px-1 text-xs">
            {sessionChangePolicyText()} ·{" "}
            <a href={`${seller.legalHref}#reembolsos`} target="_blank" rel="noopener" className="underline underline-offset-2">
              Política de cambios
            </a>
          </p>
        )}
        <CheckoutConsents
          productType={product.type}
          billingInterval={product.billingInterval}
          price={price}
          seller={{ name: seller.name, legalHref: seller.legalHref }}
          creatorDisplayName={creatorName}
        />
        {product.type === "MEMBERSHIP" && (
          <p className="cp-faint px-1 text-xs">Guardaremos tu tarjeta de forma segura para las renovaciones; puedes cancelar cuando quieras desde tu cuenta.</p>
        )}
        {(state?.error ?? (state ? null : notice)) && (
          <p role="alert" className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "#e8b4ab", background: "color-mix(in oklab, #e05a47 12%, transparent)" }}>
            {state?.error ?? notice}
          </p>
        )}
        {!payoutReady && <p className="cp-muted text-center text-sm">Las compras de este producto aún no están disponibles.</p>}
        {isSession && !sessionReady && <p className="cp-muted text-center text-xs">Elige una hora o marca «elegir la fecha después».</p>}
        <PayButton label={isSession ? `Reservar y pagar · ${price}` : product.type === "MEMBERSHIP" ? `Unirme · ${price}` : `Pagar ${price}`} disabled={!payoutReady || !sessionReady} pending={pending} />
        <div className="cp-faint flex items-center justify-center gap-4 text-xs">
          <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Pago cifrado</span>
          <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Acceso inmediato</span>
          <span className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> Soporte directo</span>
        </div>
      </div>
    </form>
  );
}
