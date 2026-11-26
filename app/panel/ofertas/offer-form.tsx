"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatMoney, parseMoneyToCents } from "@/lib/money";
import { SALE_LABEL_MAX } from "@/lib/offers";
import { saveOffer, type OfferState } from "./actions";
import { Tr, useT } from "@/lib/i18n/client";

/** Un producto que se puede poner en oferta, con su oferta de ahora (si tiene) ya escrita para el formulario. */
export type OfferProduct = {
  id: string;
  title: string;
  kind: string;
  priceCents: number;
  membership: boolean;
  sale: { price: string; label: string; start: string; end: string } | null;
};

/**
 * «Nueva oferta»: qué se pone en oferta, a qué precio, con qué etiqueta («Early Bird») y entre qué días. Al elegir
 * un producto que ya tiene oferta, sale la suya para cambiarla.
 */
export function OfferForm({ products, initial }: { products: OfferProduct[]; initial: string | null }) {
  const t = useT();
  const [state, action] = useActionState<OfferState, FormData>(saveOffer, undefined);
  const [id, setId] = useState(initial ?? "");
  const product = products.find((p) => p.id === id) ?? null;
  return (
    <form action={action} className="space-y-4">
      {state?.error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <Tr s={state.error} />
        </p>
      )}
      {state?.ok && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <Tr s={state.ok} />
        </p>
      )}
      <div>
        <label className="field-label" htmlFor="offer-product"><Tr s={"Qué pones en oferta"} /></label>
        <select id="offer-product" name="productId" value={id} onChange={(e) => setId(e.target.value)} className="input" required>
          <option value="" disabled><Tr s={"Elige un curso, una sesión, una lectura o una membresía…"} /></option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} · {p.kind} · {formatMoney(p.priceCents)}
              {p.sale ? t(" (ya en oferta)") : ""}
            </option>
          ))}
        </select>
      </div>
      {/* Con `key`, al cambiar de producto los campos salen con su oferta (o vacíos). */}
      {product && <OfferFields key={product.id} product={product} />}
    </form>
  );
}

function OfferFields({ product }: { product: OfferProduct }) {
  const t = useT();
  const [price, setPrice] = useState(product.sale?.price ?? "");
  const cents = parseMoneyToCents(price);
  const valid = cents > 0 && cents < product.priceCents;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="offer-price"><Tr s={"Precio de oferta (€)"} /></label>
          <input id="offer-price" name="salePrice" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d,.]/g, ""))} inputMode="decimal" className="input" placeholder="39" required />
          <p className="field-hint">{valid ? `−${Math.round((1 - cents / product.priceCents) * 100)} % sobre ${formatMoney(product.priceCents)}` : `Menos de ${formatMoney(product.priceCents)}, su precio normal`}</p>
        </div>
        <div>
          <label className="field-label" htmlFor="offer-label"><Tr s={"Etiqueta"} />{" "}<span className="font-normal text-muted"><Tr s={"(opcional)"} /></span>
          </label>
          <input id="offer-label" name="saleLabel" defaultValue={product.sale?.label ?? ""} maxLength={SALE_LABEL_MAX} className="input" placeholder={t("Early Bird")} />
        </div>
        <div>
          <label className="field-label" htmlFor="offer-start"><Tr s={"Empieza"} />{" "}<span className="font-normal text-muted"><Tr s={"(vacío = ya)"} /></span>
          </label>
          <input id="offer-start" name="saleStart" type="date" defaultValue={product.sale?.start ?? ""} className="input h-11" />
        </div>
        <div>
          <label className="field-label" htmlFor="offer-end"><Tr s={"Termina"} />{" "}<span className="font-normal text-muted"><Tr s={"(último día; vacío = sin fin)"} /></span>
          </label>
          <input id="offer-end" name="saleEnd" type="date" defaultValue={product.sale?.end ?? ""} className="input h-11" />
        </div>
      </div>
      <p className="field-hint"><Tr s={"Sale en el desplegable «Ofertas» de tu portada con el precio normal tachado, y también en su página y al pagar."} />{product.membership ? t(" En una membresía, el precio de oferta es el del primer pago: las renovaciones van al precio normal.") : ""}
      </p>
      <SubmitButton className="btn btn-primary" pendingLabel={t("Guardando…")}>
        {product.sale ? t("Guardar los cambios") : t("Poner en oferta")}
      </SubmitButton>
    </>
  );
}
