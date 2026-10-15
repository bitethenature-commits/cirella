import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUp, Pencil, Plus, TicketPercent } from "lucide-react";
import { EmptyState } from "@/components/ui/empty";
import { Flash } from "@/components/ui/flash";
import { requireCreator } from "@/lib/auth";
import { CODE_STATE_LABEL, codeState, expiryLabel, shopHost } from "@/lib/discount-codes";
import { tenantDb } from "@/lib/tenant";
import { CODE_EVENT_TYPES } from "@/lib/types";
import { Badge, PageHeader } from "../ui";
import { moveDiscountCode, toggleDiscountCode } from "./actions";

export const metadata: Metadata = { title: "Códigos de descuento" };

const TONE = { ACTIVE: "success", INACTIVE: "neutral", EXPIRED: "warning" } as const;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Códigos de descuento de otras marcas: lista, orden, visibilidad y cuántas veces se usan. */
export default async function DiscountCodesPage({ searchParams }: { searchParams: Promise<{ guardado?: string; borrado?: string }> }) {
  const { creator } = await requireCreator();
  const sp = await searchParams;
  const db = tenantDb(creator.id);
  const [codes, events] = await Promise.all([
    db.discountCode.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    // Clics de los últimos 30 días (sin cookies; el id del código va en productId, ver lib/types.ts).
    db.analyticsEvent.groupBy({
      by: ["productId", "type"],
      where: { type: { in: [...CODE_EVENT_TYPES] }, createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
      _count: { _all: true },
    }),
  ]);
  const count = (id: string, type: string) => events.find((e) => e.productId === id && e.type === type)?._count._all ?? 0;
  const now = new Date();

  return (
    <div>
      <PageHeader
        title="Códigos de descuento"
        subtitle="Descuentos en marcas que recomiendas. En tu página se pueden copiar con un toque y llevan a la tienda."
        actions={
          <Link href="/panel/codigos/nuevo" className="btn btn-primary">
            <Plus className="h-4 w-4" /> Nuevo código
          </Link>
        }
      />
      {sp.guardado && <Flash ok="Código añadido. Ya se ve en tu página." />}
      {sp.borrado && <Flash ok="Código borrado." />}

      {codes.length === 0 ? (
        <EmptyState
          icon={<TicketPercent className="h-5 w-5" />}
          title="Añade tu primer código"
          action={<Link href="/panel/codigos/nuevo" className="btn btn-primary">Nuevo código</Link>}
        >
          La marca, el código, una frase y el enlace a la tienda. Si caduca, deja de verse solo.
        </EmptyState>
      ) : (
        <ul className="space-y-2.5">
          {codes.map((c, i) => {
            const state = codeState(c, now);
            const expiry = expiryLabel(c.expiresAt, creator.timezone);
            return (
              <li key={c.id} className="card flex items-center gap-3 p-3 sm:gap-4">
                <div className="flex flex-col">
                  {(["up", "down"] as const).map((dir) => (
                    <form key={dir} action={moveDiscountCode}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="dir" value={dir} />
                      <button
                        disabled={dir === "up" ? i === 0 : i === codes.length - 1}
                        className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-25"
                        aria-label={dir === "up" ? `Subir ${c.brand}` : `Bajar ${c.brand}`}
                      >
                        {dir === "up" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                      </button>
                    </form>
                  ))}
                </div>
                <Link href={`/panel/codigos/${c.id}`} className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 font-semibold">
                    <span className="truncate">{c.brand}</span>
                    <code className="rounded bg-sand px-1.5 py-0.5 font-mono text-xs">{c.code}</code>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {[shopHost(c.url), expiry, `${plural(count(c.id, "CODE_COPY"), "copia", "copias")} · ${plural(count(c.id, "CODE_CLICK"), "clic", "clics")} en 30 días`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <div className="mt-1.5">
                    <Badge tone={TONE[state]}>{CODE_STATE_LABEL[state]}</Badge>
                  </div>
                </Link>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  {state !== "EXPIRED" && (
                    <form action={toggleDiscountCode} className="hidden sm:block">
                      <input type="hidden" name="id" value={c.id} />
                      <button className="btn btn-ghost btn-sm">{c.active ? "Ocultar" : "Mostrar"}</button>
                    </form>
                  )}
                  <Link href={`/panel/codigos/${c.id}`} className="btn btn-outline btn-sm">
                    <Pencil className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Editar</span>
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-6 text-xs text-muted">
        El orden de esta lista es el de tu página. Los caducados y los ocultos no se ven. La sección se puede mover u ocultar desde{" "}
        <Link href="/panel/pagina" className="underline underline-offset-2">Mi página → Secciones</Link>.
      </p>
    </div>
  );
}
