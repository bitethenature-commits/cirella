"use client";
import { Loader2 } from "lucide-react";
import { startTransition, useActionState, useState } from "react";
import { Flash } from "@/components/ui/flash";
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
          <section className="card space-y-4 p-5 sm:p-6">
            <h3 className="font-semibold">Sesión</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="field-label">Duración (min)</label>
                <input name="durationMin" type="number" min={10} max={480} defaultValue={product.durationMin ?? 60} className="input" />
              </div>
              <div>
                <label className="field-label">Margen entre sesiones</label>
                <input name="bufferMin" type="number" min={0} max={240} defaultValue={product.bufferMin ?? 15} className="input" />
              </div>
              <div>
                <label className="field-label">Antelación mínima (h)</label>
                <input name="minNoticeHours" type="number" min={0} max={720} defaultValue={product.minNoticeHours ?? 24} className="input" />
              </div>
            </div>
            <div>
              <label className="field-label">Enlace de videollamada</label>
              <input name="meetingUrl" type="url" defaultValue={product.meetingUrl ?? ""} className="input" placeholder="https://meet.google.com/…" />
              <p className="field-hint">Se envía a la clienta con la confirmación. Tus días y horarios se configuran en Reservas.</p>
            </div>
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
          <label className="flex items-center gap-2.5 text-sm">
            <input type="checkbox" name="featured" defaultChecked={product.featured} className="h-4 w-4 accent-[#0E1024]" />
            Destacar en mi página
          </label>
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
