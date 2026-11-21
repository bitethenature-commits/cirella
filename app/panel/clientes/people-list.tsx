import Link from "next/link";
import { Check, Search, Star, Users, X } from "lucide-react";
import { DeleteButton } from "@/components/ui/delete-button";
import { communityTiers } from "@/lib/community-tiers";
import { DECLINED, REQUESTED } from "@/lib/requests";
import { isPersonalMode } from "@/lib/site-mode";
import { tenantDb } from "@/lib/tenant";
import { addDaysToKey, dateKeyInTz, formatDate, timeInTz } from "@/lib/tz";
import { Pager, PersonDot } from "../ui";
import { deleteSubscriber } from "../newsletter/suscriptoras/actions";
import { deleteCustomerAction } from "./actions";

const PAGE = 100;
const HERE = "/panel/clientes";

/** Lo último de una persona, dicho como un mensaje. */
type Last = { productTitle: string; status: string; createdAt: Date; paymentProvider: string; metadata: unknown };
function lastText(o: Last): string {
  const t = `«${o.productTitle}»`;
  if (o.status === REQUESTED) return `Te pide ${t}`;
  if (o.status === DECLINED) return `Pidió ${t} · descartada`;
  if (o.status === "REFUNDED") return `${t} · reembolsada`;
  if ((o.metadata as { request?: boolean } | null)?.request) return `Pidió ${t} · confirmada`;
  if (o.paymentProvider === "manual") return `Le diste ${t}`;
  if (o.paymentProvider === "free") return `Se apuntó a ${t}`;
  return `Compró ${t}`;
}

/** «hace 5 min», «14:05» (hoy), «ayer», «12 nov», «12 nov 2025». */
function whenText(d: Date, now: Date, tz: string) {
  const mins = Math.floor((now.getTime() - d.getTime()) / 60_000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const today = dateKeyInTz(now, tz);
  const key = dateKeyInTz(d, tz);
  if (key === today) return timeInTz(d, tz);
  if (key === addDaysToKey(today, -1)) return "ayer";
  return formatDate(d, key.slice(0, 4) === today.slice(0, 4) ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" }, tz).replace(".", "");
}

const SHOWN = [REQUESTED, DECLINED, "PAID", "REFUNDED"];

/** Cómo está en la newsletter, dicho corto (para el título de la marca). */
const NEWSLETTER_STATE: Record<string, string> = {
  CONFIRMED: "Suscrita a tu newsletter",
  PENDING: "No ha confirmado la newsletter",
  UNSUBSCRIBED: "Se dio de baja de la newsletter",
  BOUNCED: "Su email rebota: no recibe la newsletter",
  COMPLAINED: "Marcó la newsletter como spam",
};

/** Una fila: alguien con ficha (Customer) o alguien que solo está en la newsletter (Subscriber). */
type Entry = { kind: "customer" | "subscriber"; id: string; name: string | null; email: string; createdAt: Date };

/**
 * Todas las personas, como una bandeja de mensajes: arriba la de lo último que ha pedido o hecho (o por
 * nombre, A–Z), con el buscador. Junto al nombre: si está en la newsletter (✓ verde o ✗ roja), las estrellas
 * de su membresía (1, 2 o 3) y cuántas inscripciones tiene. También salen las que solo se apuntaron a la
 * newsletter (sin ficha): al pulsarlas se abre su página de newsletter.
 */
export async function PeopleList({ creatorId, tz, q, az, page, label }: { creatorId: string; tz: string; q: string; az: boolean; page: number; label: string }) {
  const db = tenantDb(creatorId);
  // Para ordenar hace falta saber de todas cuándo fue lo último (una web personal: unos cientos de personas).
  const [customers, subscribers, lastByEmail] = await Promise.all([
    db.customer.findMany({ select: { id: true, name: true, email: true, createdAt: true } }),
    // Sin las direcciones bloqueadas (esas están en Ajustes mail › Bloqueadas).
    db.subscriber.findMany({ where: { OR: [{ unsubscribeVia: null }, { unsubscribeVia: { not: "BLOCK" } }] }, select: { id: true, name: true, email: true, createdAt: true, status: true } }),
    db.order.groupBy({ by: ["buyerEmail"], where: { status: { in: SHOWN } }, _max: { createdAt: true } }),
  ]);
  // La newsletter solo existe en la web personal.
  const newsletter = isPersonalMode();
  const subOf = new Map(subscribers.map((s) => [s.email.toLowerCase(), s]));
  const hasFicha = new Set(customers.map((c) => c.email.toLowerCase()));
  const everyone: Entry[] = [
    ...customers.map((c) => ({ kind: "customer" as const, ...c })),
    ...subscribers.filter((s) => !hasFicha.has(s.email.toLowerCase())).map((s) => ({ kind: "subscriber" as const, id: s.id, name: s.name, email: s.email, createdAt: s.createdAt })),
  ];
  const needle = q.toLowerCase();
  const all = needle ? everyone.filter((e) => e.email.toLowerCase().includes(needle) || (e.name ?? "").toLowerCase().includes(needle)) : everyone;

  const lastAt = new Map<string, number>();
  for (const g of lastByEmail) {
    const k = g.buyerEmail.toLowerCase();
    const t = g._max.createdAt?.getTime() ?? 0;
    if (t > (lastAt.get(k) ?? 0)) lastAt.set(k, t);
  }
  const activity = (e: Entry) => Math.max(lastAt.get(e.email.toLowerCase()) ?? 0, e.createdAt.getTime());
  const sorted = az
    ? [...all].sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email, "es", { sensitivity: "base" }))
    : [...all].sort((a, b) => activity(b) - activity(a));
  const shown = sorted.slice((page - 1) * PAGE, page * PAGE);
  const ids = shown.filter((e) => e.kind === "customer").map((e) => e.id);

  // Lo de las que se ven: su foto, su membresía, sus inscripciones y lo último suyo (por su cuenta o por su
  // email: las solicitudes no tienen ficha).
  const now = new Date();
  const [fichas, tiers, counts, orders] = await Promise.all([
    ids.length ? db.customer.findMany({ where: { id: { in: ids } }, select: { id: true, userId: true, user: { select: { avatarUrl: true } } } }) : [],
    communityTiers(creatorId),
    ids.length ? db.order.groupBy({ by: ["customerId"], where: { customerId: { in: ids }, status: "PAID" }, _count: { _all: true } }) : [],
    shown.length
      ? db.order.findMany({
          where: { status: { in: SHOWN }, OR: [...(ids.length ? [{ customerId: { in: ids } }] : []), ...shown.map((e) => ({ buyerEmail: { equals: e.email, mode: "insensitive" as const } }))] },
          orderBy: { createdAt: "desc" },
          select: { buyerEmail: true, productTitle: true, status: true, createdAt: true, paymentProvider: true, metadata: true },
        })
      : [],
  ]);
  const tierOf = new Map(tiers.map((t) => [t.id, t]));
  const userIds = fichas.map((f) => f.userId);
  const memberships =
    userIds.length && tiers.length
      ? await db.access.findMany({
          where: { userId: { in: userIds }, productId: { in: [...tierOf.keys()] }, status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          select: { userId: true, productId: true },
        })
      : [];
  // Su nivel más alto (1, 2 o 3 estrellas).
  const starsOf = new Map<string, { level: number; title: string }>();
  for (const m of memberships) {
    const t = tierOf.get(m.productId);
    if (t && t.level > (starsOf.get(m.userId)?.level ?? 0)) starsOf.set(m.userId, { level: t.level, title: t.title });
  }
  const fichaOf = new Map(fichas.map((f) => [f.id, f]));
  const countOf = new Map(counts.map((c) => [c.customerId, c._count._all]));
  const lastOf = new Map<string, Last>();
  const asked = new Set<string>();
  for (const o of orders) {
    const key = o.buyerEmail.toLowerCase();
    if (!lastOf.has(key)) lastOf.set(key, o);
    if (o.status === REQUESTED) asked.add(key);
  }

  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ ...(q ? { q } : {}), ...(az ? { orden: "az" } : {}), ...extra });
    return p.size ? `${HERE}?${p}` : HERE;
  };
  const sortLink = (on: boolean) => `rounded-full px-3 py-1.5 text-sm font-medium transition ${on ? "bg-ink text-cream" : "text-muted hover:text-ink"}`;

  return (
    <section className="mt-12" aria-label={label}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-2.5 font-serif text-[1.5rem] font-semibold leading-tight">
          <span className="panel-emblem h-10 w-10">
            <Users className="h-5 w-5" />
          </span>
          {label}
          <span className="font-sans text-sm font-normal text-muted">{all.length}</span>
        </h2>
        <nav aria-label="Orden" className="ml-auto flex rounded-full border border-line bg-white/70 p-1">
          <Link href={q ? `${HERE}?${new URLSearchParams({ q })}` : HERE} className={sortLink(!az)} aria-current={!az ? "page" : undefined}>
            Recientes
          </Link>
          <Link href={`${HERE}?${new URLSearchParams({ ...(q ? { q } : {}), orden: "az" })}`} className={sortLink(az)} aria-current={az ? "page" : undefined}>
            A–Z
          </Link>
        </nav>
      </div>
      <form action={HERE} className="mb-4 flex max-w-sm items-center gap-2 rounded-full border border-line bg-white px-4">
        {az && <input type="hidden" name="orden" value="az" />}
        <Search className="h-4 w-4 text-muted" />
        <input name="q" defaultValue={q} placeholder="Buscar por nombre o email" className="h-10 flex-1 bg-transparent text-sm outline-none" />
      </form>

      {shown.length === 0 ? (
        <p className="card p-6 text-sm text-muted">{q ? "Nadie con ese nombre o email." : "Todavía no hay nadie. Cuando alguien se apunte, te pida algo o le des acceso, aparecerá aquí."}</p>
      ) : (
        <div className="card divide-y divide-line">
          {shown.map((e) => {
            const key = e.email.toLowerCase();
            const ficha = e.kind === "customer" ? fichaOf.get(e.id) : undefined;
            const sub = subOf.get(key);
            const last = lastOf.get(key);
            const fresh = asked.has(key);
            const stars = ficha ? starsOf.get(ficha.userId) : undefined;
            const n = e.kind === "customer" ? (countOf.get(e.id) ?? 0) : null;
            const subscribed = sub?.status === "CONFIRMED";
            const who = e.name ?? e.email;
            const when = last && last.createdAt > e.createdAt ? last.createdAt : e.createdAt;
            const preview = last
              ? lastText(last)
              : e.kind === "subscriber"
                ? `Se apuntó a tu newsletter${sub?.status === "PENDING" ? " · sin confirmar" : ""}`
                : "Se registró en tu web";
            return (
              <div key={`${e.kind}-${e.id}`} className={`flex items-center pr-2 ${fresh ? "bg-[#fbf3e2]/60" : ""}`}>
                <Link
                  href={e.kind === "customer" ? `/panel/clientes/${e.id}` : `/panel/newsletter/suscriptoras/${e.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 transition hover:bg-paper sm:px-5"
                >
                  <span className="relative shrink-0">
                    {ficha?.user.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ficha.user.avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
                    ) : (
                      <PersonDot name={e.name} email={e.email} className="h-11 w-11" />
                    )}
                    {fresh && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#B4473C]" aria-label="Solicitud sin contestar" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                      <span className={`min-w-0 max-w-full truncate ${fresh ? "font-bold" : "font-semibold"}`}>{who}</span>
                      {newsletter && (<span className="inline-flex items-center gap-0.5 text-xs text-muted" title={sub ? (NEWSLETTER_STATE[sub.status] ?? "No está en tu newsletter") : "No está en tu newsletter"}>
                        Newsletter
                        {subscribed ? <Check className="h-3.5 w-3.5 text-[#2f8a5b]" strokeWidth={3} aria-label="sí" /> : <X className="h-3.5 w-3.5 text-[#B4473C]" strokeWidth={3} aria-label="no" />}
                      </span>)}
                      {stars && (
                        <span className="inline-flex items-center gap-px text-[#c9962e]" title={`Membresía: ${stars.title}`} aria-label={`Membresía ${stars.title}: ${stars.level} ${stars.level === 1 ? "estrella" : "estrellas"}`}>
                          {Array.from({ length: Math.min(3, stars.level) }, (_, i) => (
                            <Star key={i} className="h-3.5 w-3.5 fill-current" />
                          ))}
                        </span>
                      )}
                      {n != null && (
                        <span className="text-xs text-muted">
                          {n} {n === 1 ? "inscripción" : "inscripciones"}
                        </span>
                      )}
                      <span className={`ml-auto shrink-0 text-xs ${fresh ? "font-semibold text-ink" : "text-muted"}`}>{whenText(when, now, tz)}</span>
                    </span>
                    <span className={`block truncate text-sm ${fresh ? "text-ink" : "text-muted"}`}>{preview}</span>
                  </span>
                </Link>
                {e.kind === "customer" ? (
                  <DeleteButton action={deleteCustomerAction} id={e.id} what={who} message={`¿Borrar a ${who} con todas sus ventas, inscripciones, reservas y accesos? Deja de entrar en lo que tenía. No se puede deshacer.`} />
                ) : (
                  <DeleteButton action={deleteSubscriber} id={e.id} what={who} message={`¿Borrar a ${e.email} de tu newsletter, sin dejar rastro? No se puede deshacer.`} />
                )}
              </div>
            );
          })}
        </div>
      )}
      <Pager page={page} total={all.length} perPage={PAGE} href={(p) => qs({ p: String(p) })} />
    </section>
  );
}
