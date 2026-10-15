import Link from "next/link";
import { Download, UsersRound } from "lucide-react";
import { EmptyState } from "@/components/ui/empty";
import { formatNumber } from "@/lib/money";
import { formatDate } from "@/lib/tz";
import { Badge, PageHeader, Stat } from "../ui";
import { listSignups, signupProducts, SIGNUPS_PAGE } from "./signups-data";

const RANGES = [
  ["month", "Este mes"],
  ["30d", "Últimos 30 días"],
  ["all", "Total"],
] as const;

/**
 * «Inscripciones»: quién se ha apuntado a qué (gratis con email) y a quién has dado acceso tú. En la
 * web personal es la página de «Ventas»; en la plataforma, una pestaña más cuando las hay.
 */
export async function SignupsView({
  creatorId,
  timezone,
  range,
  since,
  productId,
  personal,
}: {
  creatorId: string;
  timezone: string;
  range: string;
  since: Date | null;
  productId: string | null;
  personal: boolean;
}) {
  const [{ rows, total }, products] = await Promise.all([listSignups(creatorId, { since, productId, take: SIGNUPS_PAGE }), signupProducts(creatorId)]);
  const people = new Set(rows.map((r) => r.email)).size;
  const newsletter = new Set(rows.filter((r) => r.newsletter).map((r) => r.email)).size;
  const fromForm = rows.filter((r) => r.origin === "Formulario").length;
  // Enlaces que conservan el resto de filtros.
  const qs = (over: Record<string, string | null>) => {
    const p = new URLSearchParams();
    if (!personal) p.set("estado", "inscripciones");
    const merged = { rango: range, producto: productId, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `?${p.toString()}`;
  };
  const csv = `/panel/ventas/csv${qs({}).replace("?", "?tipo=inscripciones&")}`;

  return (
    <div>
      <PageHeader
        title="Inscripciones"
        subtitle="Quién se ha apuntado a qué, con su email y si quiere recibir tus novedades."
        actions={
          <>
            <div className="inline-flex rounded-full bg-sand p-1 text-xs sm:text-sm">
              {RANGES.map(([k, l]) => (
                <Link key={k} href={qs({ rango: k })} className={`rounded-full px-3 py-1.5 font-medium transition ${range === k ? "bg-white shadow-soft" : "text-muted hover:text-ink"}`}>
                  {l}
                </Link>
              ))}
            </div>
            <a href={csv} className="btn btn-outline btn-sm" download>
              <Download className="h-4 w-4" /> Descargar CSV
            </a>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Inscripciones" value={formatNumber(total)} accent />
        <Stat label="Personas" value={formatNumber(people)} hint={total > rows.length ? `En las ${rows.length} últimas` : undefined} />
        <Stat label="Con el formulario" value={formatNumber(fromForm)} hint="El resto se lo diste tú" />
        <Stat label="Quieren novedades" value={formatNumber(newsletter)} hint="Marcaron la casilla" />
      </div>
      {products.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <Link href={qs({ producto: null })} className={`rounded-full px-3 py-1.5 text-sm ${!productId ? "bg-ink text-cream" : "bg-sand text-muted hover:text-ink"}`}>
            Todos
          </Link>
          {products.map((p) => (
            <Link key={p.id} href={qs({ producto: p.id })} className={`rounded-full px-3 py-1.5 text-sm ${productId === p.id ? "bg-ink text-cream" : "bg-sand text-muted hover:text-ink"}`}>
              {p.emoji} {p.title} · {p.count}
            </Link>
          ))}
        </div>
      )}
      <div className="card overflow-hidden">
        <div className="hidden grid-cols-[1.2fr_1.3fr_0.8fr_0.7fr_0.6fr] gap-4 border-b border-line bg-paper px-5 py-2.5 text-xs font-semibold text-muted md:grid">
          <span>Persona</span>
          <span>Producto</span>
          <span>Fecha</span>
          <span>Origen</span>
          <span className="text-right">Acceso</span>
        </div>
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.orderId}>
              <Link
                href={`/panel/ventas/${r.orderId}`}
                className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-4 py-3.5 text-sm transition hover:bg-paper md:grid-cols-[1.2fr_1.3fr_0.8fr_0.7fr_0.6fr] md:items-center md:px-5"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{r.name ?? r.email}</span>
                  <span className="block truncate text-xs text-muted">
                    {r.name ? r.email : ""}
                    {r.newsletter ? `${r.name ? " · " : ""}Quiere novedades` : ""}
                  </span>
                </span>
                <span className="hidden min-w-0 truncate md:block">{r.productEmoji} {r.productTitle}</span>
                <span className="hidden text-muted md:block">{r.paidAt ? formatDate(r.paidAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }, timezone) : "—"}</span>
                <span className="hidden text-muted md:block">{r.origin}</span>
                <span className="flex items-center justify-end gap-2">
                  <Badge tone={r.active ? "success" : "neutral"}>{r.active ? "Con acceso" : "Retirado"}</Badge>
                </span>
                <span className="col-span-2 truncate text-xs text-muted md:hidden">
                  {r.productEmoji} {r.productTitle} · {r.paidAt ? formatDate(r.paidAt, { day: "numeric", month: "short" }, timezone) : "—"} · {r.origin}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {rows.length === 0 && (
          <div className="p-6">
            <EmptyState icon={<UsersRound className="h-5 w-5" />} title="Nadie se ha apuntado en este periodo">
              Cuando alguien deje su email en un producto gratis, o le des acceso desde un producto, aparecerá aquí.
            </EmptyState>
          </div>
        )}
      </div>
      {total > rows.length && <p className="mt-3 text-xs text-muted">Se muestran las {rows.length} más recientes. El CSV las incluye todas.</p>}
    </div>
  );
}
