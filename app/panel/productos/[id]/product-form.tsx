"use client";
import { Loader2 } from "lucide-react";
import { startTransition, useActionState, useState } from "react";
import { Flash } from "@/components/ui/flash";
import { PAID_SESSION_MAX_NOTICE_DAYS, PAID_SESSION_MIN_NOTICE_DAYS, paidSessionNoticeDays } from "@/lib/withdrawal";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  ACCESS_MODE_HINT,
  ACCESS_MODE_LABEL,
  accessModeOptions,
  asAccessMode,
  defaultExternalLabel,
  EXTERNAL_LABEL_MAX,
  HIDDEN_PAID_HINT,
  HIDDEN_PAID_LABEL,
  type AccessMode,
} from "@/lib/access-mode";
import { MIN_PERSONAL_INSTRUCTIONS, normalizeDeliveryMode, type DeliveryMode } from "@/lib/delivery";
import { formatMoney, parseMoneyToCents } from "@/lib/money";
import { estimateNet, type TaxMode, type VatStatus } from "@/lib/tax";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { IntakeConfigEditor } from "@/components/booking/intake-config-editor";
import type { IntakeConfig } from "@/lib/intake";
import { HORIZON_CHOICES, HORIZON_DEFAULT_DAYS, horizonLabel } from "@/lib/slots";
import { COURSE_CATEGORIES, COURSE_CATEGORY_LABEL } from "@/lib/course-categories";
import { SALE_LABEL_MAX } from "@/lib/offers";
import { updateProduct, type ActionState } from "../actions";

export type EditableProduct = {
  id: string;
  type: string;
  title: string;
  emoji: string | null;
  summary: string | null;
  description: string | null;
  /** null = texto de antes | "MD" = con formato (lib/rich-text.ts). */
  descriptionFormat: string | null;
  imageUrl: string | null;
  priceCents: number;
  ctaLabel: string | null;
  status: string;
  featured: boolean;
  instructions: string | null;
  slug: string;
  durationMin: number | null;
  bufferMin: number | null;
  minNoticeHours: number | null;
  meetingUrl: string | null;
  billingInterval: string | null;
  deliveryMode: string;
  accessMode: string;
  externalUrl: string | null;
  externalLabel: string | null;
  horizonDays: number | null;
  groupSession: boolean;
  /** Fecha y hora del taller en la zona de la dueña (YYYY-MM-DD, HH:MM). */
  eventDate: string;
  eventTime: string;
  capacity: number | null;
  intake: IntakeConfig;
  /** Tiene reservas: un taller ya no se puede convertir en sesión individual ni al revés. */
  hasBookings: boolean;
  /** Su texto de privacidad es personalizado (aviso al pedir datos de nacimiento). */
  customPrivacy: boolean;
  ownerTimezone: string;
  /** Oferta (lib/offers.ts): precio y días de inicio y fin (último día incluido) en su zona. */
  salePrice: string;
  saleStart: string;
  saleEnd: string;
  saleLabel: string | null;
  salePriceCents: number | null;
  /** Curso: método (lib/course-categories.ts). Taller: círculo de la luna. */
  courseCategory: string | null;
  moonCircle: boolean;
};

const DELIVERY_OPTIONS: { mode: DeliveryMode; label: string; hint: string }[] = [
  {
    mode: "AUTOMATIC",
    label: "Archivos o enlaces · acceso inmediato",
    hint: "Tus clientas los descargan desde su cuenta justo después de pagar. Súbelos en «Archivos que se entregan», más abajo.",
  },
  { mode: "PERSONAL", label: "Lo preparo yo para cada clienta", hint: "Para lecturas e informes personalizados: tú se lo envías después." },
];

const EMOJIS = ["🌙", "✨", "🔮", "🧬", "🔑", "💫", "🌿", "🧘", "🪷", "📖", "🎧", "☀️", "🌸", "🕯️"];

export function ProductForm({
  product,
  host,
  username,
  commissionBps,
  taxPreview,
  accessModes,
}: {
  product: EditableProduct;
  host: string;
  username: string;
  commissionBps: number;
  /** Para «Recibes X»: el IVA depende de la política de la plataforma y de tu situación de IVA. */
  taxPreview: { mode: TaxMode; country: string; vatStatus: VatStatus };
  /** Modos que se pueden elegir (lib/access-mode.ts → accessModesFor): en la plataforma, solo PAID. */
  accessModes: AccessMode[];
}) {
  const [state, action, isPending] = useActionState<ActionState, FormData>(updateProduct, undefined);
  const [image, setImage] = useState(product.imageUrl);
  const [emoji, setEmoji] = useState(product.emoji ?? "");
  const [price, setPrice] = useState(product.priceCents ? String(product.priceCents / 100).replace(".", ",") : "");
  const cents = parseMoneyToCents(price);
  const isSession = product.type === "SESSION";
  const isMembership = product.type === "MEMBERSHIP";
  const isDigital = product.type === "DIGITAL";
  const [mode, setMode] = useState<DeliveryMode>(normalizeDeliveryMode(product.type, product.deliveryMode));
  const personal = isDigital && mode === "PERSONAL";
  const estimate = estimateNet({ priceCents: cents, commissionBps, productType: product.type, deliveryMode: mode, mode: taxPreview.mode, creator: taxPreview });
  // Cómo se consigue. Siempre parte del modo que tiene: un producto de pago en la web personal
  // aparece como «Oculto» (sigue así hasta que se elija otra opción, nunca se regala al guardar).
  const current = asAccessMode(product.accessMode);
  const hiddenPaid = current === "PAID" && !accessModes.includes("PAID");
  const options = accessModeOptions(accessModes, current);
  const [access, setAccess] = useState<AccessMode>(accessModes.includes(current) || (accessModes.length === 1 && accessModes[0] === "PAID") ? current : hiddenPaid ? "PAID" : accessModes[0]);
  const choosable = accessModes.length > 1 || !accessModes.includes("PAID");
  const optionLabel = (m: AccessMode) => (hiddenPaid && m === "PAID" ? HIDDEN_PAID_LABEL : ACCESS_MODE_LABEL[m]);
  const optionHint = (m: AccessMode) => (hiddenPaid && m === "PAID" ? HIDDEN_PAID_HINT : ACCESS_MODE_HINT[m]);
  const free = access === "FREE_EMAIL";
  const external = access === "EXTERNAL";
  const [externalUrl, setExternalUrl] = useState(product.externalUrl ?? "");
  const externalSession = external && isSession;
  const [group, setGroup] = useState(product.groupSession);
  const asksData = isSession || personal;
  const [saleOn, setSaleOn] = useState(product.salePriceCents != null);
  const [salePrice, setSalePrice] = useState(product.salePrice);
  const saleCents = parseMoneyToCents(salePrice);

  return (
    <form
      // onSubmit en lugar de action={}: así un error de validación no borra lo escrito.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="grid gap-5 lg:grid-cols-[1fr_320px]"
    >
      <input type="hidden" name="id" value={product.id} />
      <input type="hidden" name="imageUrl" value={image ?? ""} />
      <input type="hidden" name="emoji" value={emoji} />

      <div className="space-y-5">
        <Flash ok={state?.ok} error={state?.error} />
        <section className="card space-y-4 p-5 sm:p-6">
          <div>
            <label className="field-label">Título</label>
            <input name="title" defaultValue={product.title} className="input" required maxLength={100} />
          </div>
          {product.type === "COURSE" && (
            <div>
              <label className="field-label" htmlFor="course-category">Método</label>
              <select id="course-category" name="courseCategory" defaultValue={product.courseCategory ?? ""} className="input">
                <option value="">Sin método</option>
                {COURSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {COURSE_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
              <p className="field-hint">Tu página de cursos los agrupa por método.</p>
            </div>
          )}
          <div>
            <label className="field-label">Descripción corta <span className="font-normal text-muted">(aparece en la tarjeta)</span></label>
            <textarea name="summary" defaultValue={product.summary ?? ""} className="input" rows={2} maxLength={240} />
          </div>
          <div>
            <label className="field-label" htmlFor="product-description">Descripción completa</label>
            <RichTextEditor
              id="product-description"
              name="description"
              formatName="descriptionFormat"
              defaultValue={product.description ?? ""}
              initialFormat={product.descriptionFormat}
              maxLength={5000}
              tools="full"
              images
              tone="account"
              headingLevel={3}
              listMarker="star"
              legacy="description"
              rows={7}
              placeholder={"Qué es, para quién es y qué incluye.\n\nIncluye:\n- Primer punto\n- Segundo punto"}
            />
          </div>
          <div>
            <label className="field-label">Icono</label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS.map((e) => (
                <button key={e} type="button" onClick={() => setEmoji(e)} className={`grid h-9 w-9 place-items-center rounded-lg border text-base ${emoji === e ? "border-ink bg-white" : "border-line bg-white/50"}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>
        </section>

        {choosable && <input type="hidden" name="accessMode" value={access} />}
        {choosable && (
          <section id="acceso" className="card scroll-mt-24 space-y-4 p-5 sm:p-6">
            <h3 className="font-semibold">Cómo se consigue</h3>
            {options.length > 1 ? (
              <div className={`grid gap-2.5 ${options.length > 2 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`} role="radiogroup" aria-label="Cómo se consigue">
                {options.map((m) => (
                  <label
                    key={m}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-sm transition ${access === m ? "border-ink bg-white ring-1 ring-ink" : "border-line bg-white hover:border-ink/30"}`}
                  >
                    <input type="radio" name="accessModeChoice" value={m} checked={access === m} onChange={() => setAccess(m)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#0E1024]" />
                    <span>
                      <span className="block font-semibold">{optionLabel(m)}</span>
                      <span className="mt-1 block text-xs text-muted">{optionHint(m)}</span>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">
                <strong className="text-ink">{optionLabel(access)}.</strong> {optionHint(access)}
              </p>
            )}
            {hiddenPaid && access === "PAID" && (
              <p className="rounded-xl bg-sand px-3 py-2 text-xs text-muted">Este producto se cobraba en la web. En tu web no se cobra nada: elige «{ACCESS_MODE_LABEL[accessModes[0]]}»{accessModes.length > 1 ? ` o «${ACCESS_MODE_LABEL[accessModes[1]]}»` : ""} y guarda para que se vea.</p>
            )}
          </section>
        )}

        {free ? (
          <section className="card space-y-4 p-5 sm:p-6">
            <h3 className="font-semibold">Precio</h3>
            <input type="hidden" name="price" value="0" />
            <p className="text-sm text-muted"><strong className="text-ink">Gratis.</strong> Quien deje su nombre y su email recibe el acceso al momento y un email con su enlace.</p>
            <div className="sm:max-w-xs">
              <label className="field-label">Texto del botón</label>
              <input name="ctaLabel" defaultValue={product.ctaLabel ?? ""} className="input" maxLength={30} placeholder="Quiero el acceso gratis" />
            </div>
          </section>
        ) : external ? (
          <section className="card space-y-4 p-5 sm:p-6">
            <h3 className="font-semibold">Dónde se paga</h3>
            <div>
              <label className="field-label" htmlFor="externalUrl">Enlace de la web de pago o reserva</label>
              <input id="externalUrl" name="externalUrl" type="url" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} className="input" placeholder="https://pay.hotmart.com/…" required />
              <p className="field-hint">Hotmart, PayPal, Bizum, Calendly… El botón de tu página abre este enlace.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label" htmlFor="externalLabel">Texto del botón</label>
                <input id="externalLabel" name="externalLabel" defaultValue={product.externalLabel ?? ""} className="input" maxLength={EXTERNAL_LABEL_MAX} placeholder={defaultExternalLabel(product.type, externalUrl)} />
              </div>
              <div>
                <label className="field-label">Precio <span className="font-normal text-muted">(opcional, informativo)</span>{isMembership ? " por periodo" : ""}</label>
                <input name="price" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d,.]/g, ""))} inputMode="decimal" className="input" placeholder="Sin precio" />
                <p className="field-hint">Se muestra en tu página con «Pago en …». Si lo dejas vacío, solo se ve el botón.</p>
              </div>
            </div>
            {isMembership && <input type="hidden" name="billingInterval" value={product.billingInterval ?? "month"} />}
          </section>
        ) : (
        <section className="card space-y-4 p-5 sm:p-6">
          <h3 className="font-semibold">Precio</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label">Precio final (€{hiddenPaid ? "" : ", IVA incluido"}){isMembership ? " por periodo" : ""}</label>
              <input name="price" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d,.]/g, ""))} inputMode="decimal" className="input text-lg font-semibold" placeholder="49" />
              {cents >= 100 && !hiddenPaid && (
                <p className="field-hint">
                  Recibes {formatMoney(estimate.netCents, "EUR", { decimals: true })} por venta en España (
                  {estimate.taxCents > 0 ? `IVA ${formatMoney(estimate.taxCents, "EUR", { decimals: true })} · ` : ""}comisión {(commissionBps / 100).toLocaleString("es-ES")} %).
                </p>
              )}
            </div>
            {isMembership && (
              <div>
                <label className="field-label">Cobro</label>
                <select name="billingInterval" defaultValue={product.billingInterval ?? "month"} className="input">
                  <option value="month">Mensual</option>
                  <option value="year">Anual</option>
                </select>
              </div>
            )}
            <div>
              <label className="field-label">Texto del botón</label>
              <input name="ctaLabel" defaultValue={product.ctaLabel ?? ""} className="input" maxLength={30} placeholder="Comprar" />
            </div>
          </div>
          {/* Oferta (lib/offers.ts): el checkout cobra el precio de oferta mientras está activa. */}
          <div className="rounded-2xl border border-line bg-paper p-4" id="oferta">
            <input type="hidden" name="saleForm" value="1" />
            <label className="flex items-center gap-2.5 text-sm font-semibold">
              <input type="checkbox" name="saleOn" checked={saleOn} onChange={(e) => setSaleOn(e.target.checked)} className="h-4 w-4 accent-[#0E1024]" />
              Poner en oferta
            </label>
            {saleOn && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="sale-price">Precio de oferta (€)</label>
                  <input id="sale-price" name="salePrice" value={salePrice} onChange={(e) => setSalePrice(e.target.value.replace(/[^\d,.]/g, ""))} inputMode="decimal" className="input" placeholder="39" />
                  {saleCents > 0 && cents > 0 && saleCents < cents && <p className="field-hint">−{Math.round((1 - saleCents / cents) * 100)} % sobre {formatMoney(cents)}</p>}
                </div>
                <div>
                  <label className="field-label" htmlFor="sale-label">Etiqueta <span className="font-normal text-muted">(opcional)</span></label>
                  <input id="sale-label" name="saleLabel" defaultValue={product.saleLabel ?? ""} maxLength={SALE_LABEL_MAX} className="input" placeholder="Early Bird" />
                </div>
                <div>
                  <label className="field-label" htmlFor="sale-start">Empieza <span className="font-normal text-muted">(vacío = ya)</span></label>
                  <input id="sale-start" name="saleStart" type="date" defaultValue={product.saleStart} className="input h-11" />
                </div>
                <div>
                  <label className="field-label" htmlFor="sale-end">Termina <span className="font-normal text-muted">(último día; vacío = sin fin)</span></label>
                  <input id="sale-end" name="saleEnd" type="date" defaultValue={product.saleEnd} className="input h-11" />
                </div>
                <p className="field-hint sm:col-span-2">
                  Se ve con el precio normal tachado en tu página, en la ficha y al pagar.{isMembership ? " En una membresía, el precio de oferta es el del primer pago: las renovaciones van al precio normal." : ""}
                </p>
              </div>
            )}
          </div>
        </section>
        )}

        {isSession && externalSession && (
          <section className="card space-y-4 p-5 sm:p-6">
            <h3 className="font-semibold">Sesión</h3>
            <div className="sm:max-w-[12rem]">
              <label className="field-label">Duración (min)</label>
              <input name="durationMin" type="number" min={10} max={480} defaultValue={product.durationMin ?? 60} className="input" />
            </div>
            <p className="field-hint">La fecha, la hora y la videollamada las gestiona la web de reservas.</p>
          </section>
        )}

        {isSession && !externalSession && (
          <section id="sesion" className="card scroll-mt-24 space-y-4 p-5 sm:p-6">
            <h3 className="font-semibold">{group ? "Taller en directo" : "Sesión"}</h3>
            <input type="hidden" name="groupSession" value={group ? "on" : ""} />
            <div role="radiogroup" aria-label="Tipo de sesión" className="inline-flex rounded-full bg-sand p-1 text-sm">
              {[
                { v: false, label: "Individual" },
                { v: true, label: "Taller en grupo" },
              ].map((o) => (
                <button
                  key={String(o.v)}
                  type="button"
                  role="radio"
                  aria-checked={group === o.v}
                  disabled={product.hasBookings && group !== o.v}
                  onClick={() => setGroup(o.v)}
                  className={`h-9 rounded-full px-4 font-medium transition disabled:opacity-40 ${group === o.v ? "bg-white shadow-soft" : "text-muted"}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {product.hasBookings && <p className="field-hint">Ya tiene reservas: no se puede cambiar entre individual y taller.</p>}
            {group ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="event-date">Fecha</label>
                  <input id="event-date" name="eventDate" type="date" defaultValue={product.eventDate} className="input h-11" />
                </div>
                <div>
                  <label className="field-label" htmlFor="event-time">Hora (tu zona: {product.ownerTimezone.split("/").pop()?.replace(/_/g, " ")})</label>
                  <input id="event-time" name="eventTime" type="time" step={300} defaultValue={product.eventTime} className="input h-11" />
                </div>
                <div>
                  <label className="field-label" htmlFor="event-duration">Duración (min)</label>
                  <input id="event-duration" name="durationMin" type="number" min={10} max={480} defaultValue={product.durationMin ?? 90} className="input h-11" />
                </div>
                <div>
                  <label className="field-label" htmlFor="event-capacity">Plazas <span className="font-normal text-muted">(vacío = sin límite)</span></label>
                  <input id="event-capacity" name="capacity" type="number" min={1} max={500} defaultValue={product.capacity ?? ""} className="input h-11" />
                </div>
                <input type="hidden" name="bufferMin" value={product.bufferMin ?? 15} />
                <input type="hidden" name="minNoticeHours" value={0} />
                <label className="flex items-center gap-2.5 text-sm sm:col-span-2">
                  <input type="checkbox" name="moonCircle" defaultChecked={product.moonCircle} className="h-4 w-4 accent-[#0E1024]" />
                  Es un círculo de la luna (sale en tu portada para apuntarse sin ser miembro)
                </label>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="field-label">Duración (min)</label>
                  <input name="durationMin" type="number" min={10} max={480} defaultValue={product.durationMin ?? 60} className="input h-11" />
                </div>
                <div>
                  <label className="field-label">Margen entre sesiones</label>
                  <input name="bufferMin" type="number" min={0} max={240} defaultValue={product.bufferMin ?? 15} className="input h-11" />
                </div>
                {access === "PAID" ? (
                  <div>
                    <label className="field-label" htmlFor="notice-days">Antelación mínima (días desde la compra)</label>
                    <input
                      id="notice-days"
                      name="minNoticeDays"
                      type="number"
                      min={PAID_SESSION_MIN_NOTICE_DAYS}
                      max={PAID_SESSION_MAX_NOTICE_DAYS}
                      defaultValue={paidSessionNoticeDays(product)}
                      className="input h-11"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="field-label">Antelación mínima (h)</label>
                    <input name="minNoticeHours" type="number" min={0} max={720} defaultValue={Math.min(product.minNoticeHours ?? 24, 720)} className="input h-11" />
                  </div>
                )}
                {access === "PAID" && (
                  <p className="field-hint sm:col-span-2">
                    Las sesiones que se pagan en la web se pueden reservar a partir del día {PAID_SESSION_MIN_NOTICE_DAYS} desde la compra: así nunca caen dentro de los 14 días en los que tu clienta puede desistir. Las que das tú a mano no siguen esta regla.
                  </p>
                )}
                <div>
                  <label className="field-label" htmlFor="horizon">Se puede reservar hasta</label>
                  <select id="horizon" name="horizonDays" defaultValue={String(product.horizonDays ?? HORIZON_DEFAULT_DAYS)} className="input h-11">
                    {HORIZON_CHOICES.map((d) => (
                      <option key={d} value={d}>{horizonLabel(d)} por delante</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            <div>
              <label className="field-label" htmlFor="meeting">Enlace de Zoom</label>
              <input id="meeting" name="meetingUrl" type="url" inputMode="url" defaultValue={product.meetingUrl ?? ""} className="input h-11" placeholder="https://us02web.zoom.us/j/…" />
              <p className="field-hint">Se envía con la confirmación y los recordatorios. Puedes poner otro en cada reserva. {group ? "" : "Tus días y horarios se configuran en Reservas → Tu horario."}</p>
            </div>
          </section>
        )}

        {asksData && !externalSession && (
          <section id="datos" className="card scroll-mt-24 space-y-4 p-5 sm:p-6">
            <h3 className="font-semibold">Datos que pides</h3>
            <IntakeConfigEditor initial={product.intake} customPrivacy={product.customPrivacy} />
          </section>
        )}

        {externalSession ? (
          <>
            <input type="hidden" name="deliveryMode" value="AUTOMATIC" />
            <input type="hidden" name="instructions" value={product.instructions ?? ""} />
          </>
        ) : (
        <section id={isDigital ? "entrega" : undefined} className="card scroll-mt-24 space-y-4 p-5 sm:p-6">
          <h3 className="font-semibold">{isDigital ? "Entrega" : free ? "Después de apuntarse" : "Después de la compra"}</h3>
          {isDigital ? (
            <div className="grid gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="Cómo se entrega">
              {DELIVERY_OPTIONS.map((o) => (
                <label
                  key={o.mode}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-sm transition ${mode === o.mode ? "border-ink bg-white ring-1 ring-ink" : "border-line bg-white hover:border-ink/30"}`}
                >
                  <input type="radio" name="deliveryMode" value={o.mode} checked={mode === o.mode} onChange={() => setMode(o.mode)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#0E1024]" />
                  <span>
                    <span className="block font-semibold">{o.label}</span>
                    <span className="mt-1 block text-xs text-muted">{o.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <input type="hidden" name="deliveryMode" value="AUTOMATIC" />
          )}
          <div>
            {personal ? (
              <label className="field-label" htmlFor="instructions">¿Qué recibirá y cuándo?</label>
            ) : (
              <label className="field-label" htmlFor="instructions">Instrucciones para tu clienta <span className="font-normal text-muted">(opcional)</span></label>
            )}
            <textarea
              id="instructions"
              name="instructions"
              defaultValue={product.instructions ?? ""}
              className="input"
              rows={3}
              maxLength={1000}
              minLength={personal ? MIN_PERSONAL_INSTRUCTIONS : undefined}
              placeholder={
                personal
                  ? "Te enviaré la interpretación en PDF por email en un máximo de 3 días. Después de pagar, responde al email con tu pregunta."
                  : "Ej.: Responde al email con tu fecha, hora y lugar de nacimiento."
              }
            />
            {personal && <p className="field-hint">Lo verá en la ficha del producto, en el email {free || external ? "de acceso" : "de compra"} y en su cuenta. Tú se lo envías por email.</p>}
          </div>
        </section>
        )}
      </div>

      <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
        <section className="card space-y-4 p-5">
          <div>
            <label className="field-label">Estado</label>
            <select name="status" defaultValue={product.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT"} className="input">
              <option value="PUBLISHED">Publicado en mi página</option>
              <option value="DRAFT">Borrador (oculto)</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={isPending}>{isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</> : "Guardar"}</button>
        </section>
        <section className="card p-5">
          <label className="field-label">Imagen</label>
          <ImageUpload value={image} onChange={setImage} />
        </section>
        <section className="card p-5">
          <label className="field-label">Enlace</label>
          <div className="flex items-center rounded-xl border border-line bg-white pl-3 text-sm">
            <span className="shrink-0 text-muted">{host}/{username}/</span>
            <input name="slug" defaultValue={product.slug} className="h-10 min-w-0 flex-1 bg-transparent pr-3 outline-none" />
          </div>
        </section>
      </aside>
    </form>
  );
}
