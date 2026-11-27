"use client";

import { ArrowLeft, Loader2, Mail, Moon, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { ProductImage } from "@/components/creator-page/product-art";
import { IntakeFields } from "@/components/booking/intake-fields";
import { LocalDateTime } from "@/components/booking/local-date-time";
import { SlotPicker } from "@/components/booking/slot-picker";
import { browserTimezone } from "@/components/booking/timezone-select";
import type { IntakeConfig } from "@/lib/intake";
import { formatPrice } from "@/lib/money";
import { PRODUCT_TYPE_LABEL, type ProductType } from "@/lib/types";
import { readingLabel } from "@/lib/course-categories";
import { sendRequest, type RequestState } from "./actions";
import { Tr, useT } from "@/lib/i18n/client";

type Product = {
  id: string;
  type: string;
  title: string;
  courseCategory?: string | null;
  emoji: string | null;
  imageUrl: string | null;
  priceCents: number;
  sale?: { regularCents: number; label: string | null } | null;
  currency: string;
  billingInterval: string | null;
  durationMin: number | null;
  /** Taller en directo: fecha fija y plazas (null = sin límite). */
  workshop?: { startAt: string; ownerTz: string; seatsLeft: number | null } | null;
  intake?: IntakeConfig | null;
  intakePrefill?: Record<string, string | boolean>;
};

/** Cómo funciona, en tres gestos. */
const STEPS = [
  { icon: Mail, title: "Me escribes", text: "Este mensaje me llega a mí." },
  { icon: Moon, title: "Te respondo", text: "Por email, con calma y en persona." },
  { icon: Sparkles, title: "Lo cerramos", text: "Te cuento cómo pagar y recibes tu acceso." },
];

/**
 * Solicitud como una carta: la web no cobra. La clienta escribe a la dueña (mensaje, sus datos y, en
 * una sesión, el día y la hora); le llega por email y al panel, y lo hablan por email.
 */
export function RequestForm({
  product,
  creatorName,
  avatarUrl,
  seller,
  productHref,
}: {
  product: Product;
  creatorName: string;
  avatarUrl: string | null;
  seller: { name: string; legalHref: string };
  productHref: string;
}) {
  const t = useT();
  const [state, action, pending] = useActionState<RequestState, FormData>(sendRequest, undefined);
  const [slot, setSlot] = useState("");
  const [buyerTz, setBuyerTz] = useState("");
  const [later, setLater] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [privacy, setPrivacy] = useState(false);
  // Marcada de entrada: quien no las quiera, la quita.
  const [newsletter, setNewsletter] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);
  const isSession = product.type === "SESSION";
  const workshop = product.workshop ?? null;
  const full = !!workshop && workshop.seatsLeft !== null && workshop.seatsLeft <= 0;
  const price = product.priceCents > 0 ? formatPrice(product.priceCents, product.currency, product.billingInterval) : null;
  const first = creatorName.split(" ")[0];

  useEffect(() => {
    if (!buyerTz) setBuyerTz(browserTimezone(""));
  }, [buyerTz]);

  useEffect(() => {
    if (!state?.field) return;
    const el = formRef.current?.querySelector<HTMLElement>(`[name="${state.field}"]`);
    el?.focus();
    el?.scrollIntoView({ block: "center" });
  }, [state]);

  useEffect(() => {
    if (state?.sent) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [state]);

  if (state?.sent) {
    return (
      <div className="cp-letter px-6 py-12 text-center sm:px-10" role="status" data-request-sent>
        <div className="cp-envelope" aria-hidden>
          <div className="cp-envelope-body" />
          <div className="cp-envelope-letter" />
          <div className="cp-envelope-flap" />
          <div className="cp-envelope-seal">✦</div>
        </div>
        <p className="cp-eyebrow mt-8"><Tr s={"Mensaje enviado"} /></p>
        <h1 className="cp-display mt-3 text-[2.4rem]"><Tr s={"Te escribiré pronto"} /></h1>
        <p className="cp-muted mx-auto mt-4 max-w-sm leading-relaxed"><Tr s={"Gracias,"} />{" "}<Tr s={name.split(" ")[0]} /><Tr s={". Ya tengo tu mensaje. Te responderé a"} />{" "}<strong style={{ color: "var(--c-text)" }}>{state.sent.email}</strong>{" "}<Tr s={"para contarte los detalles y cómo hacer el pago."} />{slot && !later ? t(" Tu hora queda guardada mientras lo hablamos.") : ""}
        </p>
        <p className="cp-letter-greeting mt-6"><Tr s={"Con cariño,"} />{" "}<Tr s={first} /></p>
        <p className="cp-faint mt-6 text-xs"><Tr s={"Si no ves mi email en unas horas, mira en la carpeta de spam."} /></p>
        <Link href={productHref} className="cp-btn-ghost mt-8">
          <ArrowLeft className="h-4 w-4" />{" "}<Tr s={"Volver"} /></Link>
      </div>
    );
  }

  const sessionReady = !isSession || !!workshop || later || !!slot;

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="space-y-8"
      autoComplete="off"
    >
      <input type="hidden" name="productId" value={product.id} />
      <input type="hidden" name="slotStart" value={later || workshop ? "" : slot} />
      {isSession && <input type="hidden" name="buyerTz" value={buyerTz} />}

      {/* Cabecera: quien recibe la carta */}
      <header className="text-center">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={t(creatorName)} className="cp-avatar-ring mx-auto" />
        ) : (
          <span className="cp-avatar-ring cp-display mx-auto grid place-items-center text-[2rem]" style={{ color: "var(--c-bg)" }}>
            <Tr s={first[0]} />
          </span>
        )}
        <p className="cp-eyebrow mt-5"><Tr s={"Escríbeme"} /></p>
        <h1 className="cp-display mt-2 text-[2.5rem] sm:text-[2.9rem]"><Tr s={"Hablemos de tu camino"} /></h1>
        <p className="cp-muted mx-auto mt-3 max-w-md leading-relaxed"><Tr s={"Aquí no se paga nada. Cuéntame qué buscas y te responderé yo misma por email para cerrar los detalles."} /></p>
      </header>

      {/* Cómo funciona */}
      <ol className="grid grid-cols-3 gap-2 text-center">
        {STEPS.map((s) => (
          <li key={s.title} className="flex flex-col items-center gap-2">
            <span className="cp-step-dot">
              <s.icon className="h-4 w-4" />
            </span>
            <span className="text-[0.82rem] font-semibold"><Tr s={s.title} /></span>
            <span className="cp-faint hidden text-[0.72rem] leading-snug sm:block"><Tr s={s.text} /></span>
          </li>
        ))}
      </ol>

      {/* Lo que pide */}
      <div className="cp-card flex items-center gap-4 p-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden" style={{ borderRadius: "calc(var(--r-card) * 0.6)" }}>
          <ProductImage src={product.imageUrl} emoji={product.emoji} title={product.title} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="cp-eyebrow !text-[0.6rem]">
            {product.type === "MEMBERSHIP" ? t("Comunidad") : product.type === "DIGITAL" ? readingLabel(product) : PRODUCT_TYPE_LABEL[product.type as ProductType]}
            {isSession && product.durationMin ? ` · ${product.durationMin} min` : ""}
          </p>
          <p className="cp-display truncate text-[1.25rem]">{product.title}</p>
        </div>
        {price && (
          <p className="shrink-0 text-right text-sm font-semibold">
            {product.sale && <s className="cp-muted block text-xs font-normal">{formatPrice(product.sale.regularCents, product.currency)}</s>}
            {price}
          </p>
        )}
      </div>

      {/* La carta */}
      <section className="cp-letter space-y-7 px-5 py-8 sm:px-9 sm:py-10">
        <div>
          <label htmlFor="message" className="cp-letter-greeting block"><Tr s={"Querida"} />{" "}<Tr s={first} />,
          </label>
          <textarea
            id="message"
            name="message"
            rows={5}
            maxLength={2000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="cp-letter-text mt-2"
            placeholder={t("Cuéntame qué te mueve a pedirlo, qué momento estás viviendo o cualquier duda…")}
          />
        </div>

        {isSession && workshop && (
          <div className="rounded-2xl px-4 py-3" style={{ background: "color-mix(in oklab, var(--c-gold) 8%, transparent)" }}>
            <p className="cp-eyebrow"><Tr s={"El encuentro es el"} /></p>
            <p className="mt-1 text-[1.05rem] font-semibold">
              <LocalDateTime iso={workshop.startAt} ownerTz={workshop.ownerTz} />
            </p>
            <p className="cp-muted text-sm">{full ? t("Completo: no quedan plazas.") : workshop.seatsLeft === null ? t("En directo por videollamada.") : `Quedan ${workshop.seatsLeft} ${workshop.seatsLeft === 1 ? "plaza" : "plazas"}.`}</p>
          </div>
        )}

        {isSession && !workshop && (
          <div className="space-y-3">
            <p className="cp-letter-greeting !text-[1.2rem]"><Tr s={"¿Cuándo te viene bien?"} /></p>
            <p className="cp-faint -mt-1 text-xs"><Tr s={"Elige un hueco: te lo guardo mientras lo hablamos."} /></p>
            <SlotPicker
              productId={product.id}
              value={slot}
              onChange={setSlot}
              onTimezoneChange={setBuyerTz}
              theme="creator"
              disabled={later}
              emptyText={t("Ahora no tengo huecos libres. Escríbeme y buscamos el día juntas.")}
            />
            <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm">
              <input type="checkbox" checked={later} onChange={(e) => setLater(e.target.checked)} className="h-4 w-4 accent-[var(--c-accent)]" /><Tr s={"Prefiero que hablemos la fecha por email"} /></label>
          </div>
        )}

        {product.intake && (
          <div className="space-y-4" id="datos">
            <p className="cp-letter-greeting !text-[1.2rem]"><Tr s={"Para preparar tu lectura"} /></p>
            <IntakeFields config={product.intake} initial={product.intakePrefill} ownerName={creatorName} errorField={state?.field} />
          </div>
        )}

        <div className="space-y-4">
          <p className="cp-letter-greeting !text-[1.2rem]"><Tr s={"Con cariño,"} /></p>
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <label className="block">
              <span className="cp-faint text-[0.7rem] uppercase tracking-[0.18em]"><Tr s={"Tu nombre"} /></span>
              <input name="name" required minLength={2} autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} className="cp-letter-field" placeholder={t("Cómo te llamas")} />
            </label>
            <label className="block">
              <span className="cp-faint text-[0.7rem] uppercase tracking-[0.18em]"><Tr s={"Tu email"} /></span>
              <input name="email" type="email" required autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} className="cp-letter-field" placeholder={t("Donde te respondo")} />
            </label>
          </div>
        </div>
      </section>

      <div className="space-y-3">
        <label className="flex min-h-11 cursor-pointer items-start gap-2.5 px-1 py-1 text-xs leading-relaxed" style={{ color: "var(--c-muted)" }}>
          <input type="checkbox" name="privacy" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--c-accent)]" />
          <span><Tr s={"Acepto que"} />{" "}{seller.name}{" "}<Tr s={"use mis datos para responder a este mensaje."} />{" "}
            <a href={`${seller.legalHref}#privacidad`} target="_blank" rel="noopener" className="underline underline-offset-2" style={{ color: "var(--c-text)" }}><Tr s={"Privacidad"} /></a>
          </span>
        </label>
        <label className="flex min-h-11 cursor-pointer items-start gap-2.5 px-1 py-1 text-xs leading-relaxed" style={{ color: "var(--c-muted)" }}>
          <input type="checkbox" name="newsletter" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--c-accent)]" />
          <span><Tr s={"Quiero recibir también las novedades de"} />{" "}<Tr s={creatorName} />.</span>
        </label>
        {state?.error && (
          <p role="alert" className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "#e8b4ab", background: "color-mix(in oklab, #e05a47 12%, transparent)" }}>
            <Tr s={state.error} />
          </p>
        )}
        {isSession && !sessionReady && <p className="cp-muted text-center text-xs"><Tr s={"Elige un hueco o marca «hablemos la fecha por email»."} /></p>}
        {!privacy && <p className="cp-faint text-center text-xs"><Tr s={"Marca la casilla de privacidad para poder enviarlo."} /></p>}
        <button type="submit" disabled={pending || !sessionReady || full || !privacy} className="cp-btn h-14 w-full text-base disabled:opacity-60">
          {pending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />{" "}<Tr s={"Enviando tu mensaje…"} /></>
          ) : full ? (
            t("Completo")
          ) : (
            <>
              <Send className="h-4 w-4" />{" "}<Tr s={"Enviar mi mensaje a"} />{" "}<Tr s={first} />
            </>
          )}
        </button>
        <p className="cp-faint text-center text-xs"><Tr s={"Sin pagar nada aquí · te respondo en persona por email"} /></p>
      </div>
    </form>
  );
}
