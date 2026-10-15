"use client";
import { Loader2 } from "lucide-react";
import { startTransition, useActionState, useState } from "react";
import { Flash } from "@/components/ui/flash";
import { ImageUpload } from "@/components/ui/image-upload";
import { MIN_PERSONAL_INSTRUCTIONS, normalizeDeliveryMode, type DeliveryMode } from "@/lib/delivery";
import { formatMoney, parseMoneyToCents } from "@/lib/money";
import { estimateNet, type TaxMode, type VatStatus } from "@/lib/tax";
import { updateProduct, type ActionState } from "../actions";

export type EditableProduct = {
  id: string;
  type: string;
  title: string;
  emoji: string | null;
  summary: string | null;
  description: string | null;
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
}: {
  product: EditableProduct;
  host: string;
  username: string;
  commissionBps: number;
  /** Para «Recibes X»: el IVA depende de la política de la plataforma y de tu situación de IVA. */
  taxPreview: { mode: TaxMode; country: string; vatStatus: VatStatus };
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
            <label className="field-label">Descripción completa</label>
            <textarea name="description" defaultValue={product.description ?? ""} className="input" rows={7} maxLength={5000} placeholder={"Qué es, para quién es y qué incluye.\n\nIncluye:\n• Primer punto\n• Segundo punto"} />
            <p className="field-hint">Empieza las líneas con «•» para mostrarlas como lista.</p>
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

        <section className="card space-y-4 p-5 sm:p-6">
          <h3 className="font-semibold">Precio</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label">Precio final (€, IVA incluido){isMembership ? " por periodo" : ""}</label>
              <input name="price" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d,.]/g, ""))} inputMode="decimal" className="input text-lg font-semibold" placeholder="49" />
              {cents >= 100 && (
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

        {isSession && (
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

        <section id={isDigital ? "entrega" : undefined} className="card scroll-mt-24 space-y-4 p-5 sm:p-6">
          <h3 className="font-semibold">{isDigital ? "Entrega" : "Después de la compra"}</h3>
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
            {personal && <p className="field-hint">Lo verá en la ficha del producto, en el email de compra y en su cuenta. Tú se lo envías por email.</p>}
          </div>
        </section>
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
