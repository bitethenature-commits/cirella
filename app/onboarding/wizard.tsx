"use client";

import { ArrowLeft, ArrowRight, Check, CreditCard, Loader2, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CreatorPageView, type PublicProduct } from "@/components/creator-page/creator-page-view";
import { TemplatePreview } from "@/components/template-preview";
import { ImageUpload } from "@/components/ui/image-upload";
import { saveLegalIdentity } from "@/app/panel/ajustes/legal/actions";
import { LegalIdentityFields } from "@/app/panel/ajustes/legal/legal-identity-fields";
import { deliveryIssue, digitalContentText, MIN_PERSONAL_INSTRUCTIONS } from "@/lib/delivery";
import type { LegalIdentity } from "@/lib/legal";
import { formatMoney, parseMoneyToCents } from "@/lib/money";
import type { PageConfig } from "@/lib/page-config";
import type { PayoutView } from "@/lib/payouts";
import { computeSaleAmounts } from "@/lib/sale-amounts";
import { TEMPLATES, type TemplateKey } from "@/lib/templates";
import { DEFAULT_CTA, PRODUCT_TYPE_HINT, PRODUCT_TYPE_LABEL, PRODUCT_TYPES, type ProductType } from "@/lib/types";
import {
  checkUsername,
  connectPayments,
  publishOnboarding,
  saveAvatar,
  saveCategory,
  saveDelivery,
  saveFirstProduct,
  saveProfile,
  saveTemplate,
  saveUsername,
} from "./actions";
import { DeliveryStep, type DeliveryState } from "./delivery-step";

export type WizardInit = {
  step: number;
  host: string;
  username: string;
  config: PageConfig;
  categoryId: string | null;
  categories: { id: string; name: string; emoji: string | null; defaultTemplate: string }[];
  templates: TemplateKey[];
  product: { productId: string | null; type: ProductType; title: string; summary: string; emoji: string | null; imageUrl: string | null; price: string; durationMin: number };
  /** Cómo se entrega el primer producto (paso 8). */
  delivery: { mode: "AUTOMATIC" | "PERSONAL"; instructions: string; files: { id: string; name: string; kind: string; sizeBytes: number | null }[] };
  allowedTypes: ProductType[];
  commissionBps: number;
  planName: string;
  /** Estado de la cuenta de cobro (lib/payouts.ts → payoutView). */
  payout: PayoutView;
  demo: boolean;
  creatorId: string | null;
  /** Ya aceptó los Términos del servicio (paso 2). */
  termsAccepted: boolean;
  /** Identidad legal de quien vende: obligatoria antes de conectar la cuenta de cobro (paso 9). */
  legal: { defaults: Partial<LegalIdentity>; contactFallback: string; complete: boolean };
};

/** Pasos del alta: 1 es /registro y el asistente va del 2 al 10. */
const TOTAL = 10;
const EMOJIS = ["🌙", "✨", "🔮", "🧬", "🔑", "💫", "🌿", "🧘", "🪷", "📖", "🎧", "☀️"];
const PRICE_SUGGESTIONS = [19, 29, 49, 79, 120];

export function OnboardingWizard({ init }: { init: WizardInit }) {
  const [step, setStep] = useState(init.step);
  const [username, setUsername] = useState(init.username);
  const [usernameStatus, setUsernameStatus] = useState<{ ok: boolean; msg?: string } | null>(null);
  const [cfg, setCfg] = useState<PageConfig>(init.config);
  const [categoryId, setCategoryId] = useState(init.categoryId);
  const [product, setProduct] = useState(init.product);
  const [delivery, setDelivery] = useState<DeliveryState>({
    choice: init.delivery.mode === "PERSONAL" ? "PERSONAL" : init.delivery.files.length ? "FILES" : null,
    instructions: init.delivery.instructions,
    files: init.delivery.files,
  });
  const payout = init.payout;
  const payoutActive = payout.status === "ACTIVE";
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [acceptTerms, setAcceptTerms] = useState(init.termsAccepted);
  const legalForm = useRef<HTMLFormElement>(null);

  // Comprobación de disponibilidad del nombre de usuario (con retardo)
  useEffect(() => {
    if (step !== 2 || !username) return setUsernameStatus(null);
    const t = setTimeout(async () => {
      const r = await checkUsername(username);
      setUsernameStatus(r.ok ? { ok: true } : { ok: false, msg: r.error });
    }, 350);
    return () => clearTimeout(t);
  }, [username, step]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string; data?: Record<string, unknown> }>, onOk?: (data?: Record<string, unknown>) => void) => {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) return setError(r.error ?? "Algo ha fallado");
      onOk?.(r.data);
      setStep((s) => Math.min(TOTAL, s + 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const next = () => {
    switch (step) {
      case 2:
        return run(() => saveUsername(username, acceptTerms), (d) => setUsername(String(d?.username ?? username)));
      case 3:
        return run(() => saveAvatar(cfg.avatarUrl));
      case 4:
        return run(() => saveProfile({ displayName: cfg.displayName, tagline: cfg.tagline, bio: cfg.bio, avatarUrl: cfg.avatarUrl }));
      case 5:
        if (!categoryId) return setError("Elige una categoría");
        return run(
          () => saveCategory(categoryId),
          (d) => {
            const suggested = d?.suggestedTemplate as TemplateKey | undefined;
            if (suggested && init.templates.includes(suggested) && cfg.template === init.config.template) setCfg((c) => ({ ...c, template: suggested }));
          },
        );
      case 6:
        return run(() => saveTemplate(cfg.template));
      case 7:
        // Producto y precio en un solo paso: se crea (o se actualiza) ya con su precio.
        return run(
          () =>
            saveFirstProduct({
              productId: product.productId,
              type: product.type,
              title: product.title,
              summary: product.summary,
              emoji: product.emoji,
              imageUrl: product.imageUrl,
              price: product.price,
              durationMin: product.type === "SESSION" ? product.durationMin : null,
            }),
          (d) => setProduct((p) => ({ ...p, productId: String(d?.productId) })),
        );
      case 8:
        return run(() =>
          saveDelivery({
            productId: product.productId ?? "",
            choice: product.type !== "DIGITAL" ? "LATER" : (delivery.choice ?? (delivery.files.length ? "FILES" : "LATER")),
            instructions: delivery.instructions,
          }),
        );
      case 9: {
        // «Quién vende» se guarda también al seguir sin conectar los cobros: si no, lo escrito se
        // perdería y tendría que repetirlo en el panel. Email, país y tipo vienen rellenos: solo
        // cuenta como empezado si ha escrito algo en los demás campos.
        const form = legalForm.current;
        if (!form) return setStep(10);
        if (form.checkValidity()) return run(() => saveLegalIdentity(new FormData(form)));
        const data = new FormData(form);
        const typed = ["legalName", "legalTaxId", "legalAddress", "legalPostalCode", "legalCity"].some((n) => String(data.get(n) ?? "").trim());
        if (typed) {
          form.reportValidity();
          return setError("Completa tus datos legales o déjalos en blanco para hacerlo más tarde");
        }
        return setStep(10);
      }
      case 10:
        setError(null);
        start(async () => {
          const r = await publishOnboarding();
          if (r && !r.ok) setError(r.error);
        });
        return;
    }
  };

  const canContinue =
    (step === 2 && usernameStatus?.ok && acceptTerms) ||
    step === 3 ||
    (step === 4 && cfg.displayName.trim().length > 0) ||
    (step === 5 && !!categoryId) ||
    step === 6 ||
    (step === 7 && product.title.trim().length >= 2 && parseMoneyToCents(product.price) >= 100) ||
    (step === 8 &&
      (product.type !== "DIGITAL" ||
        delivery.files.length > 0 ||
        (delivery.choice === "PERSONAL" && delivery.instructions.trim().length >= MIN_PERSONAL_INSTRUCTIONS) ||
        delivery.choice === "LATER")) ||
    step === 9 ||
    step === 10;

  // Qué recibirá quien compre, para el resumen final: la misma regla que al publicar (lib/delivery.ts).
  // Un curso recién creado aún no tiene lecciones; se preparan en el panel.
  const deliverable = !deliveryIssue({
    type: product.type,
    deliveryMode: delivery.choice === "PERSONAL" ? "PERSONAL" : "AUTOMATIC",
    instructions: delivery.instructions,
    files: delivery.files.length,
    lessons: 0,
    posts: 0,
  })?.blocking;
  const deliveryLabel =
    product.type === "DIGITAL" && delivery.choice === "PERSONAL"
      ? "Entrega: lo preparas tú"
      : delivery.files.length > 0 && product.type === "DIGITAL"
        ? (digitalContentText(delivery.files) ?? "Entrega lista")
        : product.type === "SESSION"
          ? "Reservas con día y hora"
          : product.type === "MEMBERSHIP"
            ? "Espacio privado para tus miembros"
            : product.type === "COURSE"
              ? "Lecciones pendientes (en tu panel)"
              : "Entrega pendiente";

  const priceCents = parseMoneyToCents(product.price);
  const estimate = computeSaleAmounts(priceCents, init.commissionBps);

  const previewProducts: PublicProduct[] = useMemo(
    () =>
      product.title
        ? [
            {
              id: "preview",
              type: product.type,
              slug: "preview",
              title: product.title,
              emoji: product.emoji,
              summary: product.summary,
              imageUrl: product.imageUrl,
              priceCents: priceCents || 0,
              currency: "EUR",
              billingInterval: product.type === "MEMBERSHIP" ? "month" : null,
              ctaLabel: DEFAULT_CTA[product.type],
              featured: false,
              meta: product.type === "SESSION" ? `${product.durationMin} min` : null,
            },
          ]
        : [],
    [product, priceCents],
  );

  const preview = (
    <CreatorPageView
      creatorId={init.creatorId ?? "preview"}
      username={username || "tunombre"}
      config={cfg}
      products={previewProducts}
      allowCustom={false}
      showPoweredBy
      platformName="Cirella"
      preview
    />
  );

  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[1fr_minmax(420px,0.8fr)]">
      <div className="flex min-h-dvh min-w-0 flex-col">
        {/* Progreso */}
        <div className="sticky top-0 z-20 border-b border-line bg-paper/90 px-5 py-3 backdrop-blur sm:px-10">
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(2, s - 1))}
              disabled={step === 2 || pending}
              className="grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-sand disabled:opacity-30"
              aria-label="Atrás"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand">
              <div className="h-full rounded-full bg-ink transition-all duration-500" style={{ width: `${(step / TOTAL) * 100}%` }} />
            </div>
            <span className="w-12 text-right text-xs tabular-nums text-muted">
              {step}/{TOTAL}
            </span>
          </div>
        </div>

        <div className="mx-auto w-full max-w-xl flex-1 px-5 pb-32 pt-8 sm:px-10 sm:pt-12">
          <div key={step} className="animate-fade-up">
            {step === 2 && (
              <Step title="Elige tu nombre de usuario" text="Será tu enlace para la bio de Instagram, TikTok o Telegram.">
                <label className="flex h-14 items-center rounded-2xl border border-line bg-white pl-4 text-base focus-within:border-lavender-deep focus-within:ring-4 focus-within:ring-lavender-deep/10">
                  <span className="text-muted">{init.host}/</span>
                  <input
                    autoFocus
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
                    placeholder="tunombre"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="h-full min-w-0 flex-1 bg-transparent pr-4 font-medium outline-none"
                  />
                  {usernameStatus && (
                    <span className={`mr-4 text-xs font-medium ${usernameStatus.ok ? "text-success" : "text-rose"}`}>
                      {usernameStatus.ok ? "✓ Disponible" : ""}
                    </span>
                  )}
                </label>
                {usernameStatus && !usernameStatus.ok && <p className="mt-2 text-sm text-rose">{usernameStatus.msg}</p>}
                <p className="mt-3 text-xs text-muted">Usa el mismo nombre que en Instagram para que te encuentren fácilmente.</p>
                <label className="mt-6 flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border border-line bg-white p-4 text-sm leading-relaxed">
                  <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-ink" />
                  <span>
                    Acepto los{" "}
                    <a href="/terminos" target="_blank" rel="noopener" className="font-semibold underline underline-offset-2">Términos del servicio</a> y el{" "}
                    <a href="/terminos#encargo" target="_blank" rel="noopener" className="font-semibold underline underline-offset-2">Encargo de tratamiento de datos</a> de
                    Cirella y he leído la{" "}
                    <a href="/privacidad" target="_blank" rel="noopener" className="font-semibold underline underline-offset-2">Política de privacidad</a>.
                  </span>
                </label>
              </Step>
            )}

            {step === 3 && (
              <Step title="Sube tu foto" text="Una foto donde se te vea la cara genera confianza. Puedes cambiarla cuando quieras.">
                <ImageUpload shape="circle" value={cfg.avatarUrl} onChange={(url) => setCfg((c) => ({ ...c, avatarUrl: url }))} label="Elegir foto" />
                {!cfg.avatarUrl && <p className="mt-6 text-center text-sm text-muted">¿Ahora no? Pulsa «Continuar» y la añades más tarde.</p>}
              </Step>
            )}

            {step === 4 && (
              <Step title="¿Cómo te presentas?" text="Tu nombre y una línea que explique a qué te dedicas.">
                <div className="space-y-4">
                  <div>
                    <label className="field-label">Nombre</label>
                    <input className="input" value={cfg.displayName} onChange={(e) => setCfg((c) => ({ ...c, displayName: e.target.value }))} placeholder="Ana Luna" maxLength={80} />
                  </div>
                  <div>
                    <label className="field-label">Descripción corta</label>
                    <input className="input" value={cfg.tagline} onChange={(e) => setCfg((c) => ({ ...c, tagline: e.target.value }))} placeholder="Astrología · Human Design · Gene Keys" maxLength={120} />
                  </div>
                  <div>
                    <label className="field-label">Sobre ti <span className="font-normal text-muted">(opcional)</span></label>
                    <textarea className="input" rows={4} value={cfg.bio} onChange={(e) => setCfg((c) => ({ ...c, bio: e.target.value }))} placeholder="Acompaño a mujeres a…" maxLength={600} />
                  </div>
                </div>
              </Step>
            )}

            {step === 5 && (
              <Step title="¿A qué te dedicas?" text="Adaptaremos el diseño y los textos a tu sector.">
                <div className="grid grid-cols-2 gap-2.5">
                  {init.categories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategoryId(c.id)}
                      className={`flex items-center gap-2.5 rounded-2xl border px-3.5 py-3.5 text-left text-sm transition ${
                        categoryId === c.id ? "border-ink bg-ink text-cream" : "border-line bg-white hover:border-ink/30"
                      }`}
                    >
                      <span className="text-lg">{c.emoji}</span>
                      <span className="font-medium">{c.name}</span>
                    </button>
                  ))}
                </div>
              </Step>
            )}

            {step === 6 && (
              <Step title="Elige tu estilo" text="Podrás cambiarlo cuando quieras sin perder nada.">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {init.templates.map((t) => (
                    <button key={t} type="button" onClick={() => setCfg((c) => ({ ...c, template: t }))} className="text-left">
                      <div className={`overflow-hidden rounded-2xl ring-offset-2 ring-offset-paper transition ${cfg.template === t ? "ring-2 ring-ink" : "ring-1 ring-line"}`}>
                        <TemplatePreview template={t} name={cfg.displayName || "Tu nombre"} tagline={cfg.tagline || "Tu especialidad"} />
                      </div>
                      <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold">
                        {cfg.template === t && <Check className="h-4 w-4" />} {TEMPLATES[t].name}
                      </p>
                    </button>
                  ))}
                </div>
              </Step>
            )}

            {step === 7 && (
              <Step title="Tu primer producto" text="Empieza por lo que más vendes por mensaje privado: qué es y cuánto cuesta.">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {PRODUCT_TYPES.map((t) => {
                    const locked = !init.allowedTypes.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        disabled={locked}
                        onClick={() => setProduct((p) => ({ ...p, type: t }))}
                        className={`relative rounded-2xl border p-4 text-left transition ${
                          product.type === t ? "border-ink bg-white ring-1 ring-ink" : "border-line bg-white hover:border-ink/30"
                        } ${locked ? "opacity-55" : ""}`}
                      >
                        <p className="text-sm font-semibold">{PRODUCT_TYPE_LABEL[t]}</p>
                        <p className="mt-1 text-xs text-muted">{PRODUCT_TYPE_HINT[t]}</p>
                        {locked && (
                          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-sand px-2 py-0.5 text-[0.65rem] font-semibold">
                            <Lock className="h-3 w-3" /> {t === "SESSION" ? "Creator" : "Pro"}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-6 space-y-4">
                  <div>
                    <label className="field-label">Nombre del producto</label>
                    <input className="input" value={product.title} onChange={(e) => setProduct((p) => ({ ...p, title: e.target.value }))} placeholder="Lectura de Astrología" maxLength={100} />
                  </div>
                  <div>
                    <label className="field-label">Descripción breve</label>
                    <textarea className="input" rows={3} value={product.summary} onChange={(e) => setProduct((p) => ({ ...p, summary: e.target.value }))} placeholder="Qué recibe tu clienta y por qué le va a ayudar." maxLength={240} />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="onb-price">Precio</label>
                    <div className="flex h-16 items-center rounded-3xl border border-line bg-white px-5 focus-within:border-lavender-deep">
                      <input
                        id="onb-price"
                        inputMode="decimal"
                        value={product.price}
                        onChange={(e) => setProduct((p) => ({ ...p, price: e.target.value.replace(/[^\d,.]/g, "") }))}
                        placeholder="49"
                        className="h-full min-w-0 flex-1 bg-transparent text-3xl font-semibold tracking-tight outline-none"
                      />
                      <span className="text-xl text-muted">€{product.type === "MEMBERSHIP" ? "/mes" : ""}</span>
                    </div>
                    <p className="field-hint">Es el precio final que paga tu clienta.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {PRICE_SUGGESTIONS.map((v) => (
                        <button key={v} type="button" onClick={() => setProduct((p) => ({ ...p, price: String(v) }))} className="chip h-8 bg-white ring-1 ring-line hover:ring-ink/30">
                          {v} €
                        </button>
                      ))}
                    </div>
                    {priceCents >= 100 && (
                      <div className="mt-4 rounded-2xl bg-sand/70 p-4 text-sm">
                        <p>
                          Recibirás <strong>{formatMoney(estimate.netCents, "EUR", { decimals: true })}</strong> por cada venta.
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          {`Plan ${init.planName}: comisión del ${(init.commissionBps / 100).toLocaleString("es-ES")} %. `}
                          Baja al 2 % con el plan Pro.
                        </p>
                      </div>
                    )}
                  </div>
                  {product.type === "SESSION" && (
                    <div>
                      <label className="field-label">Duración de la sesión</label>
                      <div className="flex flex-wrap gap-2">
                        {[30, 45, 60, 75, 90].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setProduct((p) => ({ ...p, durationMin: d }))}
                            className={`chip h-9 px-4 ${product.durationMin === d ? "!bg-ink !text-cream" : "bg-white ring-1 ring-line"}`}
                          >
                            {d} min
                          </button>
                        ))}
                      </div>
                      <p className="field-hint">Tu horario disponible lo ajustas luego en «Reservas».</p>
                    </div>
                  )}
                  <div>
                    <label className="field-label">Icono</label>
                    <div className="flex flex-wrap gap-2">
                      {EMOJIS.map((e) => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => setProduct((p) => ({ ...p, emoji: e }))}
                          className={`grid h-10 w-10 place-items-center rounded-xl border text-lg transition ${product.emoji === e ? "border-ink bg-white" : "border-line bg-white/60"}`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="field-label">Imagen <span className="font-normal text-muted">(opcional)</span></label>
                    <ImageUpload value={product.imageUrl} onChange={(url) => setProduct((p) => ({ ...p, imageUrl: url }))} />
                  </div>
                </div>
              </Step>
            )}

            {step === 8 && (
              <Step title="¿Cómo lo entregas?" text={`Lo que recibe quien compre «${product.title}».`}>
                <DeliveryStep productId={product.productId} type={product.type} title={product.title} value={delivery} onChange={setDelivery} />
              </Step>
            )}

            {step === 9 && (
              <Step title="Datos de cobro" text="La ley exige mostrar quién vende. Estos datos aparecerán en tu aviso legal y en los recibos.">
                {/* Datos legales (lib/legal.ts): sin ellos no se puede conectar la cuenta de cobro. */}
                {!payoutActive && payout.cta && (
                  <form ref={legalForm} onSubmit={(e) => e.preventDefault()} className="card mb-4 p-6">
                    <p className="mb-4 font-semibold">Quién vende</p>
                    <LegalIdentityFields defaults={init.legal.defaults} contactFallback={init.legal.contactFallback} />
                  </form>
                )}
                <div className="card p-6">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-full bg-ink text-cream">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold">Cuenta de cobro</p>
                      <p className="text-xs text-muted">Tarjeta, Apple Pay y Google Pay</p>
                    </div>
                  </div>
                  {payoutActive ? (
                    <p className="mt-5 flex items-center gap-2 rounded-xl bg-[#f1f8f3] px-3 py-2.5 text-sm font-medium text-success">
                      <Check className="h-4 w-4" /> Activada · ya puedes recibir pagos
                    </p>
                  ) : payout.status === "NONE" || payout.status === "PENDING" ? (
                    <div className="mt-5 space-y-3 text-sm">
                      <p>Te llevamos a Stripe, la plataforma de pagos con la que cobrarás. Ten a mano tu DNI o NIE, tu IBAN y tu dirección: son unos 5 minutos.</p>
                      <p className="text-muted">
                        Normalmente la verificación es inmediata. A veces Stripe revisa un documento y tarda uno o dos días hábiles: puedes publicar tu página mientras tanto y te avisaremos cuando puedas vender.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-xl bg-[#f8efdc] px-4 py-3 text-sm text-[#8a6420]">
                      <p className="font-semibold">{payout.title}</p>
                      <p className="mt-1">{payout.body}</p>
                    </div>
                  )}
                  {!payoutActive && payout.cta && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          setError(null);
                          const form = legalForm.current;
                          if (form) {
                            if (!form.checkValidity()) {
                              form.reportValidity();
                              return setError("Completa tus datos legales para activar los cobros");
                            }
                            const saved = await saveLegalIdentity(new FormData(form));
                            if (!saved.ok) return setError(saved.error);
                          }
                          const r = await connectPayments();
                          if (!r.ok) return setError(r.error);
                          if (typeof r.data?.url === "string") window.location.href = r.data.url;
                        })
                      }
                      className="btn btn-primary mt-5 w-full"
                    >
                      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {payout.cta}
                    </button>
                  )}
                  <p className="mt-4 flex items-start gap-2 text-xs text-muted">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                    {init.demo
                      ? "Modo demostración: Stripe se simula y no se pide ningún documento real."
                      : "Stripe guarda tus datos bancarios y de identidad; Cirella no los ve."}
                  </p>
                </div>
                {(payout.status === "NONE" || payout.status === "PENDING") && (
                  <p className="mt-4 text-center text-xs text-muted">Puedes hacerlo más tarde, pero hasta entonces nadie podrá comprar.</p>
                )}
              </Step>
            )}

            {step === 10 && (
              <Step title="Todo listo ✨" text="Revisa tu página y publícala. Podrás editarla siempre que quieras.">
                <ul className="space-y-2.5 text-sm">
                  {[
                    [`${init.host}/${username}`, true],
                    [cfg.avatarUrl ? "Foto de perfil" : "Foto de perfil (pendiente)", !!cfg.avatarUrl],
                    [`Estilo ${TEMPLATES[cfg.template].name}`, true],
                    [product.title ? `${product.title} · ${formatMoney(priceCents)}` : "Primer producto", !!product.productId],
                    [deliveryLabel, deliverable],
                    [payoutActive ? "Pagos activados" : payout.status === "VERIFYING" ? "Pagos en verificación" : "Pagos sin conectar", payoutActive],
                  ].map(([label, ok]) => (
                    <li key={String(label)} className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3">
                      <span className={`grid h-6 w-6 place-items-center rounded-full ${ok ? "bg-ink text-cream" : "bg-sand text-muted"}`}>
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      {label}
                    </li>
                  ))}
                </ul>
                {product.productId && !deliverable && (
                  <p className="mt-4 rounded-xl bg-[#fdf7ec] px-4 py-3 text-sm text-[#8a6420]">
                    «{product.title}» se guardará como borrador hasta que añadas qué entregas. Tu página se publica igualmente.
                  </p>
                )}
                <div className="mt-6 overflow-hidden rounded-3xl border border-line lg:hidden" style={{ height: 520 }}>
                  <div className="pointer-events-none origin-top-left" style={{ width: 390, transform: "scale(0.82)" }}>
                    {preview}
                  </div>
                </div>
              </Step>
            )}

            {error && <p className="mt-6 rounded-xl bg-[#fdf3f1] px-4 py-3 text-sm text-[#8a3b31]">{error}</p>}
          </div>
        </div>

        {/* Acciones */}
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 px-5 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4 backdrop-blur lg:right-auto lg:w-[calc(100%-max(420px,44.44%))]">
          <div className="mx-auto flex max-w-xl gap-3">
            <button
              type="button"
              onClick={next}
              disabled={!canContinue || pending}
              className="btn btn-primary btn-lg flex-1"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : step === 10 ? <Sparkles className="h-4 w-4" /> : null}
              {step === 10 ? "Publicar mi página" : step === 9 && payout.status === "NONE" ? "Lo haré más tarde" : "Continuar"}
              {step < 10 && !pending && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Vista previa en vivo (escritorio) */}
      <aside className="sticky top-0 hidden h-dvh items-center justify-center overflow-hidden bg-ink lg:flex">
        <div className="starfield absolute inset-0 opacity-40" />
        <div className="relative">
          <p className="mb-4 text-center text-xs uppercase tracking-[0.2em] text-cream/50">Vista previa en vivo</p>
          <div className="rounded-[2.6rem] border border-white/15 bg-black/60 p-2.5 shadow-2xl">
            <div className="relative h-[640px] w-[320px] overflow-y-auto overflow-x-hidden rounded-[2.1rem] scrollbar-none">
              <div className="pointer-events-none origin-top-left" style={{ width: 390, transform: "scale(0.8205)" }}>
                {preview}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Step({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <section>
      <h1 className="display text-[2.4rem] leading-[1.05] sm:text-[2.9rem]">{title}</h1>
      <p className="mt-2 text-[0.95rem] text-muted">{text}</p>
      <div className="mt-8">{children}</div>
    </section>
  );
}
