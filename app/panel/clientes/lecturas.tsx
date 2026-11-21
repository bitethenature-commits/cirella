import Link from "next/link";
import { ChevronRight, Sparkles, Square, SquareCheck } from "lucide-react";
import { tenantDb } from "@/lib/tenant";
import { formatDate } from "@/lib/tz";
import { markReadingSent, unmarkReadingSent } from "../solicitudes/reservas-actions";

/** Las lecturas «Lo preparo yo» pagadas: las que quedan por enviar y las ya hechas. */
const READINGS = { status: "PAID", productType: "DIGITAL", product: { deliveryMode: "PERSONAL" } } as const;

/**
 * Lecturas por enviar, en pequeño (a la derecha de las Solicitudes, en Personas): persona y lectura, para
 * marcar como hecha. Las hechas pasan a «Hechas» (el historial), de donde se pueden recuperar.
 */
export async function ReadingsChecklist({ creatorId, tz }: { creatorId: string; tz: string }) {
  const db = tenantDb(creatorId);
  const [todo, done, doneCount] = await Promise.all([
    db.order.findMany({ where: { ...READINGS, deliveredAt: null }, orderBy: { paidAt: "asc" }, take: 50, select: { id: true, buyerName: true, buyerEmail: true, productTitle: true, paidAt: true } }),
    db.order.findMany({ where: { ...READINGS, deliveredAt: { not: null } }, orderBy: { deliveredAt: "desc" }, take: 20, select: { id: true, buyerName: true, buyerEmail: true, productTitle: true, deliveredAt: true } }),
    db.order.count({ where: { ...READINGS, deliveredAt: { not: null } } }),
  ]);
  const day = (d: Date | null) => (d ? formatDate(d, { day: "numeric", month: "short" }, tz) : "");
  return (
    <section className="card p-4" aria-label="Lecturas por enviar">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="h-4 w-4 text-muted" /> Lecturas por enviar
        {todo.length > 0 && <span className="ml-auto rounded-full bg-ink px-2 py-0.5 text-[0.7rem] font-bold text-cream">{todo.length}</span>}
      </h2>
      {todo.length === 0 ? (
        <p className="mt-2 text-xs text-muted">Nada por enviar.</p>
      ) : (
        <ul className="mt-2 space-y-0.5">
          {todo.map((o) => (
            <li key={o.id} className="flex items-start gap-2 text-[0.84rem]">
              <form action={markReadingSent}>
                <input type="hidden" name="orderId" value={o.id} />
                <button className="mt-0.5 grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-sand hover:text-ink" aria-label={`Marcar como hecha: ${o.productTitle} de ${o.buyerName ?? o.buyerEmail}`} title="Marcar como hecha">
                  <Square className="h-4 w-4" />
                </button>
              </form>
              <Link href={`/panel/ventas/${o.id}`} className="min-w-0 flex-1 py-0.5 hover:underline">
                <span className="block truncate font-medium">{o.buyerName ?? o.buyerEmail}</span>
                <span className="block truncate text-xs text-muted">
                  {o.productTitle}
                  {o.paidAt ? ` · desde el ${day(o.paidAt)}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {doneCount > 0 && (
        <details className="group mt-3 border-t border-line pt-2">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-semibold text-muted hover:text-ink">
            <ChevronRight className="h-3.5 w-3.5 transition group-open:rotate-90" /> Hechas ({doneCount})
          </summary>
          <ul className="mt-1.5 space-y-0.5">
            {done.map((o) => (
              <li key={o.id} className="flex items-start gap-2 text-[0.84rem] text-muted">
                <form action={unmarkReadingSent}>
                  <input type="hidden" name="orderId" value={o.id} />
                  <button className="mt-0.5 grid h-6 w-6 place-items-center rounded-md hover:bg-sand hover:text-ink" aria-label={`Recuperar: ${o.productTitle} de ${o.buyerName ?? o.buyerEmail}`} title="Recuperar (vuelve a por enviar)">
                    <SquareCheck className="h-4 w-4" />
                  </button>
                </form>
                <Link href={`/panel/ventas/${o.id}`} className="min-w-0 flex-1 py-0.5 hover:underline">
                  <span className="block truncate line-through decoration-1">{o.buyerName ?? o.buyerEmail}</span>
                  <span className="block truncate text-xs">
                    {o.productTitle} · hecha el {day(o.deliveredAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {doneCount > done.length && <p className="mt-1 text-[0.7rem] text-muted">Se ven las {done.length} últimas.</p>}
        </details>
      )}
    </section>
  );
}
