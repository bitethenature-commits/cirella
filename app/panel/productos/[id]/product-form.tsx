"use client";
import { Loader2 } from "lucide-react";
import { startTransition, useActionState, useCallback, useDeferredValue, useEffect, useRef, useState, type ReactNode } from "react";
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
import { computeSaleAmounts } from "@/lib/sale-amounts";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { IntakeConfigEditor } from "@/components/booking/intake-config-editor";
import type { IntakeConfig } from "@/lib/intake";
import { HORIZON_CHOICES, HORIZON_DEFAULT_DAYS, horizonLabel } from "@/lib/slots";
import { COURSE_CATEGORIES, COURSE_CATEGORY_LABEL, COURSE_CATEGORY_SEP, courseCategoriesOf, type CourseCategory } from "@/lib/course-categories";
import { SALE_LABEL_MAX } from "@/lib/offers";
import { addDaysToKey, labelToMinutes, zonedTimeToUtc } from "@/lib/tz";
import { useDesktop } from "@/components/panel/use-desktop";
import type { ProductPageProduct } from "@/components/creator-page/product-page-view";
import { updateProduct, type ActionState } from "../actions";
import { DesktopPreview, PreviewButton, PreviewSheet, type PreviewTab, type ProductPreviewContext } from "./product-preview";

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
  currency: string;
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
  /** Membresía «a página entera» (cada publicación, una página con anterior, siguiente, calendario y «Guardar»). */
  pagedReading: boolean;
};

const DELIVERY_OPTIONS: { mode: DeliveryMode; label: string; hint: string }[] = [
  {
    mode: "AUTOMATIC",
    label: "Archivos o enlaces · acceso inmediato",
    hint: "Tus clientas los descargan desde su cuenta justo después de pagar. Súbelos en «Archivos que se entregan», más abajo.",
  },
  { mode: "PERSONAL", label: "Lo preparo yo para cada clienta", hint: "Para lecturas e informes personalizados: se lo envías tú por email (la web no guarda el material)." },
];

const EMOJIS = ["🌙", "✨", "🔮", "🧬", "🔑", "💫", "🌿", "🧘", "🪷", "📖", "🎧", "☀️", "🌸", "🕯️"];

export function ProductForm({
  product,
  host,
  username,
  commissionBps,
  accessModes,
  preview,
  children,
}: {
  product: EditableProduct;
  host: string;
  username: string;
  commissionBps: number;
  /** Modos que se pueden elegir (lib/access-mode.ts → accessModesFor): en la plataforma, solo PAID. */
  accessModes: AccessMode[];
  /** Vista previa en vivo (product-preview.tsx): lo que no sale del formulario. */
  preview: ProductPreviewContext;
  /** Lo que va debajo del formulario (archivos, lecciones…), en la misma columna que él. */
  children?: ReactNode;
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
  const estimate = computeSaleAmounts(cents, commissionBps);
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

  // Vista previa en vivo: se lee el formulario entero (sin guardar ni pedir nada) tras cada cambio.
  const formRef = useRef<HTMLFormElement>(null);
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);
  const [live, setLive] = useState<{ product: ProductPageProduct; status: string } | null>(null);
  useEffect(() => {
    if (formRef.current) setLive(readPreview(formRef.current, product, preview, { image, emoji, access, mode, group, saleOn, price, salePrice, externalUrl }));
  }, [tick, product, preview, image, emoji, access, mode, group, saleOn, price, salePrice, externalUrl]);
  // Se repinta con un respiro: escribir no espera a la vista previa (como en el editor de la página).
  const shown = useDeferredValue(live);
  const desktop = useDesktop();
  const [sheet, setSheet] = useState(false);
  const [tab, setTab] = useState<PreviewTab>("card");
  const closeSheet = useCallback(() => setSheet(false), []);

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_384px] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_414px]">
    <div className="min-w-0">
    <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-line bg-white/60 px-4 py-2.5 lg:hidden">
      <p className="text-sm text-muted">Mira cómo queda mientras escribes.</p>
      <PreviewButton onClick={() => setSheet(true)} />
    </div>
    <form
      ref={formRef}
      // onSubmit en lugar de action={}: así un error de validación no borra lo escrito.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      // Cualquier cambio (también los botones de formato del texto) refresca la vista previa.
      onInput={bump}
      onChange={bump}
      onClick={bump}
      className="grid grid-cols-[minmax(0,1fr)] gap-5"
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
            <CourseCategoryPicker initial={product.courseCategory} />
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
              onChange={bump}
              onFormatChange={bump}
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
        <section className="card p-5">
          <label className="field-label">Imagen</label>
          <ImageUpload value={image} onChange={setImage} />
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
              <label className="field-label">Precio final (€){isMembership ? " por periodo" : ""}</label>
              <input name="price" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d,.]/g, ""))} inputMode="decimal" className="input text-lg font-semibold" placeholder="49" />
              <p className="field-hint">Se ve en tu página. La clienta te envía una solicitud y el pago lo acordáis por email.</p>
            </div>
            {isMembership && (
              <label className="flex items-start gap-2.5 rounded-2xl border border-line bg-paper p-3 text-sm sm:col-span-2">
                <input type="hidden" name="pagedReadingField" value="1" />
                <input type="checkbox" name="pagedReading" defaultChecked={product.pagedReading} className="mt-0.5 h-4 w-4 accent-[#0E1024]" />
                <span>
                  <span className="font-semibold">Lectura a página entera</span>
                  <span className="block text-xs text-muted">Para textos largos con fotos: cada publicación se lee como una página, con «Anterior» y «Siguiente», un calendario para ir a una fecha y «Guardar» (sale en sus Favoritos, la estrella del menú).</span>
                </span>
              </label>
            )}
            {isMembership && (
              <div>
                <label className="field-label">Periodo</label>
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
            <>
              <input type="hidden" name="deliveryMode" value="PERSONAL" />
              <p className="rounded-2xl bg-sand px-4 py-3 text-sm text-muted">Las lecturas se las envías tú por email: la web no guarda archivos. Aquí solo cuentas qué recibirá y cuándo.</p>
            </>
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

      <section className="card p-5">
        <label className="field-label">Enlace</label>
        <div className="flex items-center rounded-xl border border-line bg-white pl-3 text-sm">
          <span className="shrink-0 text-muted">{host}/{username}/</span>
          <input name="slug" defaultValue={product.slug} className="h-10 min-w-0 flex-1 bg-transparent pr-3 outline-none" />
        </div>
      </section>
      {/* En escritorio, siempre a la vista al bajar por el formulario. */}
      <section className="card z-10 flex flex-col gap-4 p-5 sm:flex-row sm:items-end lg:sticky lg:bottom-4 lg:p-4 lg:shadow-lift">
        <div className="sm:flex-1">
          <label className="field-label">Estado</label>
          <select name="status" defaultValue={product.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT"} className="input">
            <option value="PUBLISHED">Publicado en mi página</option>
            <option value="DRAFT">Borrador (oculto)</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary w-full sm:w-auto sm:min-w-40" disabled={isPending}>{isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</> : "Guardar"}</button>
      </section>
    </form>
    {children && <div className="mt-5 space-y-5">{children}</div>}
    </div>

    {/* Vista previa en vivo: columna fija en escritorio; en el móvil y la tableta, a pantalla completa. */}
    {desktop && shown && (
      <aside className="hidden lg:block">
        <DesktopPreview ctx={preview} product={shown.product} status={shown.status} tab={tab} onTab={setTab} />
      </aside>
    )}
    {sheet && !desktop && shown && <PreviewSheet ctx={preview} product={shown.product} status={shown.status} tab={tab} onTab={setTab} onClose={closeSheet} />}
    </div>
  );
}

type LiveState = { image: string | null; emoji: string; access: AccessMode; mode: DeliveryMode; group: boolean; saleOn: boolean; price: string; salePrice: string; externalUrl: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

/**
 * El producto tal y como quedaría con lo escrito ahora en el formulario (sin guardar), en los mismos
 * datos planos que pinta la página pública. Las fechas se leen en la zona de la dueña, como al guardar.
 */
/**
 * Temas del curso: casillas para marcar uno o varios (un curso puede ser, por ejemplo, Astrología +
 * Mi energía). Se guardan juntos en el campo oculto «courseCategory» («ASTROLOGIA+MI_ENERGIA»).
 */
function CourseCategoryPicker({ initial }: { initial: string | null }) {
  const [picked, setPicked] = useState<CourseCategory[]>(() => courseCategoriesOf(initial));
  const toggle = (c: CourseCategory) => setPicked((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : COURSE_CATEGORIES.filter((x) => x === c || prev.includes(x))));
  return (
    <fieldset>
      <legend className="field-label">Temas</legend>
      <input type="hidden" name="courseCategory" value={picked.join(COURSE_CATEGORY_SEP)} />
      <div className="flex flex-wrap gap-2">
        {COURSE_CATEGORIES.map((c) => (
          <label key={c} className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${picked.includes(c) ? "border-ink bg-ink text-cream" : "border-line hover:bg-sand"}`}>
            <input type="checkbox" name="courseCategoryPick" value={c} checked={picked.includes(c)} onChange={() => toggle(c)} className="sr-only" />
            {COURSE_CATEGORY_LABEL[c]}
          </label>
        ))}
      </div>
      <p className="field-hint">Marca uno o varios. Tu página de cursos los agrupa por tema; si marcas varios (por ejemplo, Astrología y Mi energía), el curso sale en su propio grupo con los iconos de los dos.</p>
    </fieldset>
  );
}

function readPreview(form: HTMLFormElement, base: EditableProduct, ctx: ProductPreviewContext, st: LiveState): { product: ProductPageProduct; status: string } {
  const fd = new FormData(form);
  const text = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" ? v : null;
  };
  const trimmed = (k: string) => text(k)?.trim() || null;
  const int = (k: string) => {
    const v = text(k)?.trim();
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) ? Math.round(n) : null;
  };
  const tz = base.ownerTimezone;
  const free = st.access === "FREE_EMAIL";
  const priceCents = free ? 0 : Math.max(0, parseMoneyToCents(st.price));
  const saleStart = text("saleStart") ?? "";
  const saleEnd = text("saleEnd") ?? "";
  const eventDate = text("eventDate") ?? "";
  const eventTime = text("eventTime") ?? "";
  const salePriceCents = st.saleOn && st.access === "PAID" && st.salePrice.trim() ? parseMoneyToCents(st.salePrice) : null;
  return {
    status: text("status") ?? base.status,
    product: {
      id: base.id,
      type: base.type,
      // La dirección guardada (no la que se escribe): los enlaces de la vista previa no cambian con cada tecla.
      slug: base.slug,
      title: trimmed("title") ?? "Sin título",
      emoji: st.emoji || null,
      summary: trimmed("summary"),
      description: text("description")?.trim() ? text("description") : null,
      descriptionFormat: text("descriptionFormat") || base.descriptionFormat,
      imageUrl: st.image,
      priceCents,
      currency: base.currency,
      billingInterval: base.type === "MEMBERSHIP" ? (text("billingInterval") ?? base.billingInterval ?? "month") : null,
      ctaLabel: trimmed("ctaLabel"),
      featured: base.featured,
      instructions: text("instructions") ?? base.instructions,
      deliveryMode: normalizeDeliveryMode(base.type, st.mode),
      accessMode: st.access,
      externalUrl: st.access === "EXTERNAL" ? st.externalUrl.trim() || null : null,
      externalLabel: trimmed("externalLabel"),
      durationMin: int("durationMin") ?? base.durationMin,
      meetingUrl: trimmed("meetingUrl") ?? base.meetingUrl,
      groupSession: base.type === "SESSION" && st.group,
      eventStartAt: st.group && DAY.test(eventDate) && TIME.test(eventTime) ? zonedTimeToUtc(eventDate, labelToMinutes(eventTime), tz) : null,
      capacity: st.group ? int("capacity") : null,
      salePriceCents,
      saleStartsAt: salePriceCents != null && DAY.test(saleStart) ? zonedTimeToUtc(saleStart, 0, tz) : null,
      // El último día cuenta entero: termina a las 00:00 del día siguiente (como al guardar).
      saleEndsAt: salePriceCents != null && DAY.test(saleEnd) ? zonedTimeToUtc(addDaysToKey(saleEnd, 1), 0, tz) : null,
      saleLabel: trimmed("saleLabel"),
      // Las casillas marcadas («A+B»): se leen directamente, el campo oculto aún no se ha actualizado.
      courseCategory: base.type === "COURSE" ? fd.getAll("courseCategoryPick").map(String).join(COURSE_CATEGORY_SEP) || null : base.courseCategory,
      moonCircle: st.group && fd.get("moonCircle") === "on",
      intake: base.intake,
      files: ctx.files,
      modules: ctx.modules,
      includes: ctx.includes,
      posts: ctx.posts,
    },
  };
}
