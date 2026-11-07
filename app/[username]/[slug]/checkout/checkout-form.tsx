"use client";

import { CalendarClock, Check, CreditCard, Loader2, Lock, ShieldCheck, Smartphone, Wallet } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { ProductImage } from "@/components/creator-page/product-art";
import { Turnstile } from "@/components/ui/turnstile";
import { IntakeFields } from "@/components/booking/intake-fields";
import { LocalDateTime } from "@/components/booking/local-date-time";
import { SlotPicker } from "@/components/booking/slot-picker";
import { browserTimezone } from "@/components/booking/timezone-select";
import type { IntakeConfig } from "@/lib/intake";
import { checkoutDeliveryBadge } from "@/lib/delivery";
import { sessionChangePolicyText, withdrawalInfoLine } from "@/lib/legal";
import { formatPrice } from "@/lib/money";
import type { CheckoutMethod } from "@/lib/payments";
import { PRODUCT_TYPE_LABEL, type ProductType } from "@/lib/types";
import { placeOrder, type CheckoutState } from "./actions";
import { CheckoutConsents, PrivacyNotice } from "./consents";
import type { WaiverKind } from "@/lib/legal";

type Product = {
  id: string;
  type: string;
  title: string;
  emoji: string | null;
  imageUrl: string | null;
  /** Lo que se cobra ahora (con la oferta si está activa; el servidor lo vuelve a calcular al pagar). */
  priceCents: number;
  /** Oferta activa: el precio normal (tachado) y su etiqueta. */
  sale?: { regularCents: number; label: string | null } | null;
  currency: string;
  billingInterval: string | null;
  durationMin: number | null;
  ctaLabel: string | null;
  deliveryMode: string;
  /** Casilla del desistimiento que pide esta compra (lib/legal.ts → waiverKindFor); null = ninguna. */
  waiverKind: WaiverKind | null;
  /** Taller en directo: fecha fija y plazas (null = sin límite). */
  workshop?: { startAt: string; ownerTz: string; seatsLeft: number | null } | null;
  /** Datos para la lectura que pide (null = nada). */
  intake?: IntakeConfig | null;
  /** Datos de nacimiento de su compra anterior (solo con su sesión verificada). */
  intakePrefill?: Record<string, string | boolean>;
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

/** Cómo se llama cada pasarela en el checkout. */
const METHOD_COPY: Record<CheckoutMethod["key"], { label: string; hint: string }> = {
  stripe: { label: "Tarjeta", hint: "Visa, Mastercard, Apple Pay o Google Pay" },
  simulated: { label: "Tarjeta", hint: "Visa, Mastercard, Apple Pay o Google Pay" },
  paypal: { label: "PayPal", hint: "Con tu cuenta de PayPal" },
};

export function CheckoutForm({
  product,
  payoutReady,
  methods,
  defaultMethod,
  initialOrderId,
  notice,
  prefill,
  demo,
  creatorName,
  seller,
  platformName,
}: {
  product: Product;
  payoutReady: boolean;
  /**
   * Métodos de pago (una pasarela cada uno). Con varios, la compradora elige. collectsCardOnSite:
   * true solo con el simulador; con Stripe la tarjeta se pide en su página y con PayPal, en PayPal.
   */
  methods: CheckoutMethod[];
  defaultMethod: CheckoutMethod["key"] | null;
  /** Pedido que se reintenta (vuelta desde la pasarela o desde el email). */
  initialOrderId?: string;
  notice?: string;
  prefill: { name: string; email: string };
  demo: boolean;
  creatorName: string;
  /**
   * name: nombre legal de la creadora (sus condiciones y su aviso de privacidad); line: «Vende: …»
   * según quién vende este producto (lib/legal.ts → sellerStatement); su página legal (/{usuario}/legal).
   */
  seller: { name: string; line: string; legalHref: string };
  /** null en la web personal (no hay plataforma de por medio). */
  platformName: string | null;
}) {
  const [state, action, pending] = useActionState<CheckoutState, FormData>(placeOrder, undefined);
  const [method, setMethod] = useState<"card" | "wallet">("card");
  const [payWith, setPayWith] = useState<CheckoutMethod["key"] | null>(defaultMethod);
  const chosen = methods.find((m) => m.key === payWith) ?? methods[0] ?? null;
  const collectsCardOnSite = !!chosen?.collectsCardOnSite;
  const isPaypal = chosen?.key === "paypal";
  const [slot, setSlot] = useState<string>("");
  const [buyerTz, setBuyerTz] = useState<string>("");
  const formRef = useRef<HTMLFormElement>(null);

  const [later, setLater] = useState(false);
  // Campos controlados: React resetea los formularios con acción tras cada envío y
  // no queremos que un pago rechazado borre el nombre y el email.
  const [name, setName] = useState(prefill.name);
  const [email, setEmail] = useState(prefill.email);
  // Captcha tras varios pagos rechazados: cada token sirve una vez, así que tras cada intento se
  // vuelve a montar la comprobación con un token nuevo.
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaRound, setCaptchaRound] = useState(0);
  const needsCaptcha = !!(state?.needsCaptcha && state.captchaSiteKey);
  const isSession = product.type === "SESSION";
  // Información previa sobre el desistimiento de talleres y membresías (además de la casilla).
  const withdrawalInfo = withdrawalInfoLine(product.waiverKind);
  const workshop = product.workshop ?? null;
  const full = !!workshop && workshop.seatsLeft !== null && workshop.seatsLeft <= 0;
  const price = formatPrice(product.priceCents, product.currency, product.billingInterval);

  useEffect(() => {
    setCaptchaToken("");
    setCaptchaRound((r) => r + 1);
  }, [state]);

  useEffect(() => {
    if (!buyerTz) setBuyerTz(browserTimezone(""));
  }, [buyerTz]);

  // El campo con el error de los datos para la lectura se enfoca y se lleva a la vista.
  useEffect(() => {
    if (!state?.field) return;
    const el = formRef.current?.querySelector<HTMLElement>(`[name="${state.field}"]`);
    el?.focus();
    el?.scrollIntoView({ block: "center" });
  }, [state]);

  const sessionReady = !isSession || !!workshop || later || !!slot;
  let n = 0;

  return (
    <form
      // onSubmit en lugar de action={}: React vacía el formulario tras cada envío y un pago rechazado
      // o un dato mal escrito desmarcaría las casillas (que siguen marcadas en el estado).
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="space-y-6"
    >
      <input type="hidden" name="productId" value={product.id} />
      <input type="hidden" name="orderId" value={state?.orderId ?? initialOrderId ?? ""} />
      {chosen && <input type="hidden" name="payWith" value={chosen.key} />}
      {collectsCardOnSite && <input type="hidden" name="method" value={method} />}
      <input type="hidden" name="slotStart" value={later || workshop ? "" : slot} />
      {isSession && <input type="hidden" name="buyerTz" value={buyerTz} />}
      <input type="hidden" name="turnstileToken" value={captchaToken} />

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
          <p className="cp-muted text-xs">{product.type === "MEMBERSHIP" ? "Comunidad" : PRODUCT_TYPE_LABEL[product.type as ProductType]}{isSession && product.durationMin ? ` · ${product.durationMin} min` : ""}</p>
          <p className="cp-display truncate text-[1.35rem]">{product.title}</p>
          <p className="text-sm font-semibold">
            {product.sale && <s className="cp-muted mr-1.5 font-normal">{formatPrice(product.sale.regularCents, product.currency)}</s>}
            {price}
          </p>
          {product.sale && (
            <p className="cp-gold text-xs font-semibold" data-sale>
              Oferta{product.sale.label ? ` · ${product.sale.label}` : ""}
              {product.type === "MEMBERSHIP" ? " · primer pago; después, el precio normal" : ""}
            </p>
          )}
        </div>
      </div>

      {isSession && workshop && (
        <section className="cp-card space-y-2 p-5">
          <SectionTitle n={++n} title="Fecha del taller" />
          <p className="text-[1.05rem] font-semibold">
            <LocalDateTime iso={workshop.startAt} ownerTz={workshop.ownerTz} />
          </p>
          <p className="cp-muted text-sm">
            {full ? "Completo: no quedan plazas." : workshop.seatsLeft === null ? "En directo por videollamada." : `Quedan ${workshop.seatsLeft} ${workshop.seatsLeft === 1 ? "plaza" : "plazas"}.`}
          </p>
        </section>
      )}

      {isSession && !workshop && (
        <section className="cp-card space-y-4 p-5">
          <SectionTitle n={++n} title="Elige fecha y hora" />
          <SlotPicker
            productId={product.id}
            orderId={state?.orderId ?? initialOrderId}
            value={slot}
            onChange={setSlot}
            onTimezoneChange={setBuyerTz}
            theme="creator"
            disabled={later}
            emptyText="No hay huecos disponibles ahora mismo. Puedes reservar y elegir la fecha más adelante."
          />
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm">
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
      </section>

      {product.intake && (
        <section className="cp-card space-y-4 p-5" id="datos">
          <SectionTitle n={++n} title="Datos para tu lectura" />
          <IntakeFields config={product.intake} initial={product.intakePrefill} ownerName={creatorName} errorField={state?.field} />
        </section>
      )}

      <section className="cp-card space-y-4 p-5">
        <SectionTitle n={++n} title="Método de pago" />
        {methods.length > 1 && (
          <div role="radiogroup" aria-label="Método de pago" className="grid grid-cols-2 gap-2">
            {methods.map((m) => {
              const on = chosen?.key === m.key;
              const Icon = m.key === "paypal" ? Wallet : CreditCard;
              return (
                <button
                  key={m.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPayWith(m.key)}
                  className="flex min-h-14 flex-col items-start justify-center gap-0.5 rounded-xl border px-3 py-2 text-left transition"
                  style={on ? { borderColor: "var(--c-accent)", boxShadow: "0 0 0 1px var(--c-accent)" } : { borderColor: "var(--c-line)" }}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <Icon className="h-4 w-4" /> {METHOD_COPY[m.key].label}
                  </span>
                  <span className="cp-muted text-[0.7rem] leading-snug">{METHOD_COPY[m.key].hint}</span>
                </button>
              );
            })}
          </div>
        )}
        {isPaypal ? (
          <p className="cp-muted flex items-start gap-2.5 text-sm">
            <Wallet className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Te llevaremos a PayPal para pagar con tu cuenta. Al terminar vuelves aquí y recibes el acceso al momento.</span>
          </p>
        ) : collectsCardOnSite ? (
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
        {demo && collectsCardOnSite && (
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
        {withdrawalInfo && (
          <p className="cp-faint -mt-2 px-1 text-xs" data-testid="withdrawal-info">
            {withdrawalInfo} ·{" "}
            <a href={`${seller.legalHref}#reembolsos`} target="_blank" rel="noopener" className="underline underline-offset-2">
              Cambios y reembolsos
            </a>
          </p>
        )}
        {isSession && !workshop && (
          <p className="cp-faint -mt-2 px-1 text-xs">
            {sessionChangePolicyText()}
            {product.waiverKind ? "" : ". Tienes 14 días desde la compra para desistir desde tu área: te devolvemos todo"} ·{" "}
            <a href={`${seller.legalHref}#reembolsos`} target="_blank" rel="noopener" className="underline underline-offset-2">
              Política de cambios
            </a>
          </p>
        )}
        <CheckoutConsents
          waiverKind={product.waiverKind}
          billingInterval={product.billingInterval}
          price={price}
          seller={{ name: seller.name, legalHref: seller.legalHref }}
          creatorDisplayName={creatorName}
        />
        {product.type === "MEMBERSHIP" && (
          <p className="cp-faint px-1 text-xs">
            {isPaypal
              ? "PayPal guardará tu autorización para cobrar las renovaciones; puedes cancelar cuando quieras desde tu cuenta."
              : "Guardaremos tu tarjeta de forma segura para las renovaciones; puedes cancelar cuando quieras desde tu cuenta."}
          </p>
        )}
        {needsCaptcha && <Turnstile key={captchaRound} siteKey={state!.captchaSiteKey!} onToken={setCaptchaToken} />}
        {(state?.error ?? (state ? null : notice)) && (
          <p role="alert" className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "#e8b4ab", background: "color-mix(in oklab, #e05a47 12%, transparent)" }}>
            {state?.error ?? notice}
          </p>
        )}
        {!payoutReady && <p className="cp-muted text-center text-sm">Las compras de este producto aún no están disponibles.</p>}
        {isSession && !sessionReady && <p className="cp-muted text-center text-xs">Elige una hora o marca «elegir la fecha después».</p>}
        {needsCaptcha && !captchaToken && <p className="cp-muted text-center text-xs">Comprobando tu conexión…</p>}
        <PayButton
          label={
            isPaypal
              ? `Pagar con PayPal · ${price}`
              : full
                ? "Completo"
                : isSession
                ? `Reservar y pagar · ${price}`
                : product.type === "MEMBERSHIP"
                  ? `Unirme · ${price}`
                  : `Pagar ${price}`
          }
          disabled={!payoutReady || !sessionReady || full || (needsCaptcha && !captchaToken)}
          pending={pending}
        />
        <div className="cp-faint flex items-center justify-center gap-4 text-xs">
          <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Pago cifrado</span>
          <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> {checkoutDeliveryBadge(product.type, product.deliveryMode)}</span>
          <span className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> Soporte directo</span>
        </div>
      </div>
    </form>
  );
}
