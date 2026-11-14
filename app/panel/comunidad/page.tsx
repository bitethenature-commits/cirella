import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, Check, ChevronLeft, X, ChevronRight, ExternalLink, Eye, FilePen, Pencil, Pin, PinOff, Send, Trash2, UserPlus, UsersRound } from "lucide-react";
import { EmptyState } from "@/components/ui/empty";
import { Flash } from "@/components/ui/flash";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { requireCreator } from "@/lib/auth";
import { datetimeLocalValue, MEMBER_POST_KIND_LABEL, type MemberPostKind } from "@/lib/community-rules";
import { uploadPolicy } from "@/lib/file-types";
import { nextMoonDates } from "@/lib/moon-dates";
import { monthParam, monthTitle, parseMonthParam, shiftMonth } from "@/lib/owner-calendar";
import { readPageConfig } from "@/lib/page-config";
import { isPersonalMode } from "@/lib/site-mode";
import { tzCity } from "@/lib/timezones";
import { dateKeyInTz, formatDate } from "@/lib/tz";
import { PostCardBody } from "@/app/cuenta/membresias/post-card";
import { Badge, PageHeader, Stat } from "../ui";
import { blockMember, deleteStudioPost, publishNow, renewMember, togglePin } from "./actions";
import type { MemberRow } from "./data";

/** Cuenta atrás de una membresía que se paga por email: verde, ámbar los últimos 5 días, roja vencida. */
function Countdown({ r }: { r: MemberRow }) {
  if (r.blocked) return <span className="rounded-full bg-[#f3dcd8] px-2.5 py-1 text-xs font-semibold text-[#8a3b31]">Bloqueada</span>;
  if (r.daysLeft === null) return null;
  const d = r.daysLeft;
  const text = d < 0 ? `Vencida hace ${-d} ${-d === 1 ? "día" : "días"}` : d === 0 ? "Vence hoy" : `Quedan ${d} ${d === 1 ? "día" : "días"}`;
  const tone = d < 0 ? "bg-[#f3dcd8] text-[#8a3b31]" : d <= 5 ? "bg-[#f7e7c4] text-[#6b4a0c]" : "bg-[#dcefe2] text-[#2f5f43]";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${tone}`} data-countdown={d}>{text}</span>;
}
import { CommentModeration } from "./comment-moderation";
import { Composer } from "./composer";
import { emptyComposerPost, loadCalendar, loadComposerPost, loadMembers, loadQueue, loadStats, loadTiers, loadWall } from "./data";

export const metadata: Metadata = { title: "Comunidad" };

const TABS = [
  { key: "muro", label: "Muro" },
  { key: "programadas", label: "Programadas" },
  { key: "calendario", label: "Calendario" },
  { key: "miembros", label: "Miembros" },
  { key: "datos", label: "Datos" },
] as const;
type Tab = (typeof TABS)[number]["key"];

type SP = { tab?: string; nivel?: string; editar?: string; nueva?: string; ok?: string; t?: string; mes?: string; antes?: string };

/**
 * Estudio «Comunidad»: el feed tal y como lo ven las miembros con el compositor encima (Muro),
 * programadas y borradores, calendario, miembros por nivel y datos de cada publicación. Las
 * publicaciones son de un nivel (una membresía) y los niveles de arriba las heredan (lib/tiers.ts).
 */
export default async function CommunityStudio({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { creator } = await requireCreator();
  const owner = { id: creator.id, userId: creator.userId, timezone: creator.timezone };
  const tz = creator.timezone;
  const now = new Date();
  const { tiers, composerTiers } = await loadTiers(owner, now);
  const tab: Tab = TABS.find((t) => t.key === sp.tab)?.key ?? "muro";
  const tierId = sp.nivel && tiers.some((t) => t.id === sp.nivel) ? sp.nivel : null;
  const q = (o: Partial<SP>) => {
    const p = new URLSearchParams();
    const merged: Partial<SP> = { tab, nivel: tierId ?? undefined, ...o };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/panel/comunidad?${p.toString()}`;
  };

  if (!tiers.length)
    return (
      <div>
        <PageHeader title="Comunidad" />
        <EmptyState icon={<UsersRound className="h-5 w-5" />} title="Todavía no tienes comunidad" action={<Link href="/panel/productos/nuevo" className="btn btn-primary">Crear una membresía</Link>}>
          Crea una membresía (o varias, como niveles) y aquí podrás publicar para tus miembros, programar, moderar los comentarios y ver quién está dentro.
        </EmptyState>
      </div>
    );

  const editing = sp.editar ? await loadComposerPost(owner, sp.editar) : null;
  if (sp.editar && !editing) notFound();
  const totalMembers = Math.max(...composerTiers.map((t) => t.readers), 0);
  const displayName = readPageConfig(creator.pagePublished ?? creator.pageDraft, creator.displayName).displayName || creator.displayName;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Comunidad"
        subtitle={`${tiers.map((t) => t.title).join(" · ")} · ${totalMembers} ${totalMembers === 1 ? "persona dentro" : "personas dentro"}`}
        actions={<ViewAsMenu tiers={tiers} />}
      />

      <nav className="-mx-1 mb-5 flex gap-1 overflow-x-auto px-1 pb-1" aria-label="Secciones de Comunidad">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={q({ tab: t.key, antes: undefined, editar: undefined, ok: undefined, t: undefined })}
            aria-current={tab === t.key ? "page" : undefined}
            className={`inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition ${tab === t.key ? "bg-ink text-cream" : "bg-sand/70 text-muted hover:text-ink"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab !== "miembros" && (
        <div className="mb-5 flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label="Filtrar por nivel">
          <span className="mr-1 font-semibold text-muted">{tab === "muro" ? "Ver como lo ve" : "Nivel"}</span>
          <TierChip href={q({ nivel: undefined, antes: undefined, ok: undefined, t: undefined })} active={!tierId}>{tab === "muro" ? "Todo" : "Todos"}</TierChip>
          {tiers.map((t) => (
            <TierChip key={t.id} href={q({ nivel: t.id, antes: undefined, ok: undefined, t: undefined })} active={tierId === t.id}>
              {t.emoji} {t.title}
            </TierChip>
          ))}
        </div>
      )}

      <Flash ok={sp.ok} />

      {tab === "muro" && (
        <Wall
          owner={owner}
          tiers={tiers}
          tierId={tierId}
          composer={
            <Composer
              key={editing?.post.id ?? `nueva-${sp.t ?? ""}`}
              post={editing?.post ?? emptyComposerPost(tierId ?? tiers[0].id)}
              notifiedNote={editing?.notifiedNote ?? null}
              tiers={composerTiers}
              timeZone={tz}
              minAt={datetimeLocalValue(now, tz)}
              limitsLabel={uploadPolicy(isPersonalMode()).label}
              moonDates={nextMoonDates(now, tz).map((m) => ({ label: m.label, title: m.title, date: m.date, time: m.time }))}
              ownerName={displayName.split(" ")[0]}
              startOpen={sp.nueva === "1"}
            />
          }
          before={sp.antes && !Number.isNaN(Date.parse(sp.antes)) ? new Date(sp.antes) : null}
          q={q}
        />
      )}
      {tab === "programadas" && <Queue owner={owner} tierId={tierId} />}
      {tab === "calendario" && <Calendar owner={owner} tierId={tierId} mes={sp.mes} q={q} />}
      {tab === "miembros" && <Members owner={owner} tiers={tiers} tierId={tierId} q={q} />}
      {tab === "datos" && <Data owner={owner} tierId={tierId} />}
    </div>
  );
}

type Owner = { id: string; userId: string; timezone: string };
type Tiers = Awaited<ReturnType<typeof loadTiers>>["tiers"];

function TierChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} aria-current={active ? "true" : undefined} className={`inline-flex min-h-9 items-center gap-1 rounded-full border px-3 font-semibold ${active ? "border-ink bg-ink text-cream" : "border-line bg-white text-ink/80 hover:border-ink/30"}`}>
      {children}
    </Link>
  );
}

/** «Ver como miembro»: abre su área de miembros como alguien de ese nivel (sin comprarlo). */
function ViewAsMenu({ tiers }: { tiers: Tiers }) {
  return (
    <details className="relative">
      <summary className="btn btn-outline btn-sm min-h-10 cursor-pointer list-none">
        <Eye className="h-4 w-4" /> Ver como miembro
      </summary>
      <div className="absolute left-0 z-30 mt-2 w-64 sm:left-auto sm:right-0 rounded-2xl border border-line bg-white p-2 shadow-lift">
        <p className="px-2 pb-1.5 pt-1 text-xs text-muted">Abre la comunidad como la ve alguien de:</p>
        {tiers.map((t) => (
          <Link key={t.id} href={`/panel/comunidad/ver-como?nivel=${t.id}`} className="flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold hover:bg-sand">
            <span aria-hidden>{t.emoji}</span> {t.title}
            {t.includes.length > 0 && <span className="ml-auto text-xs font-normal text-muted">+{t.includes.length} {t.includes.length === 1 ? "nivel" : "niveles"}</span>}
          </Link>
        ))}
      </div>
    </details>
  );
}

// ── Muro ──

async function Wall({ owner, tiers, tierId, composer, before, q }: { owner: Owner; tiers: Tiers; tierId: string | null; composer: React.ReactNode; before: Date | null; q: (o: Partial<SP>) => string }) {
  const wall = await loadWall(owner, tiers, tierId, before);
  const tier = tierId ? tiers.find((t) => t.id === tierId) : null;
  return (
    <div className="space-y-4">
      {composer}
      {tier && (
        <p className="text-sm text-muted">
          Así lo ve alguien de «{tier.title}»{tier.includes.length ? `: lo suyo y lo de ${tier.includes.map((id) => `«${tiers.find((t) => t.id === id)?.title}»`).join(" y ")}` : ""}.
        </p>
      )}
      {wall.posts.length === 0 && <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">{before ? "No hay publicaciones anteriores." : "Todavía no hay nada publicado aquí. Empieza con una bienvenida."}</p>}
      {wall.posts.map((post) => (
        <article key={post.id} className="card p-5 sm:p-6" data-studio-post={post.id}>
          <PostCardBody post={post} timeZone={owner.timezone} tier={post.product.title} views={wall.views.get(post.id) ?? 0} />
          <div className="mt-3 flex flex-wrap gap-1">
            <Link href={`/cuenta/membresias/${post.productId}/${post.id}`} className="btn btn-ghost btn-sm min-h-10"><ExternalLink className="h-4 w-4" /> Abrir</Link>
            <Link href={`/panel/comunidad?editar=${post.id}#publicar`} className="btn btn-ghost btn-sm min-h-10"><Pencil className="h-4 w-4" /> Editar</Link>
            <form action={togglePin}>
              <input type="hidden" name="postId" value={post.id} />
              <button className="btn btn-ghost btn-sm min-h-10">{post.pinned ? <><PinOff className="h-4 w-4" /> Quitar de arriba</> : <><Pin className="h-4 w-4" /> Fijar arriba</>}</button>
            </form>
            <ConfirmForm action={deleteStudioPost} message="¿Eliminar esta publicación? Se borrarán también sus archivos y comentarios.">
              <input type="hidden" name="postId" value={post.id} />
              <input type="hidden" name="tab" value="muro" />
              <button className="btn btn-ghost btn-sm min-h-10 hover:text-rose"><Trash2 className="h-4 w-4" /> Eliminar</button>
            </ConfirmForm>
          </div>
          <div className="mt-2">
            <CommentModeration postId={post.id} comments={wall.comments.get(post.id) ?? []} fresh={wall.fresh.has(post.id)} />
          </div>
        </article>
      ))}
      {wall.nextBefore && <Link href={q({ antes: wall.nextBefore, ok: undefined, t: undefined })} className="btn btn-outline min-h-11 w-full">Ver publicaciones anteriores</Link>}
      {before && <Link href={q({ antes: undefined })} className="block text-center text-sm font-semibold text-muted hover:text-ink">Volver a lo último</Link>}
    </div>
  );
}

// ── Programadas y borradores ──

async function Queue({ owner, tierId }: { owner: Owner; tierId: string | null }) {
  const { scheduled, drafts } = await loadQueue(owner, tierId);
  const row = (p: (typeof drafts)[number], chip: React.ReactNode) => (
    <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3" data-queue-post={p.id}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{p.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          {chip}
          <span>{p.product.title}</span>
          <span>· {MEMBER_POST_KIND_LABEL[p.kind as MemberPostKind] ?? "Publicación"}</span>
          {p._count.files > 0 && <span>· {p._count.files} {p._count.files === 1 ? "archivo" : "archivos"}</span>}
          {p.notify && <span>· avisa por email</span>}
          {p.pinnedAt && <span className="inline-flex items-center gap-0.5">· <Pin className="h-3 w-3" /> fijada</span>}
        </p>
      </div>
      <div className="flex flex-wrap gap-1">
        <Link href={`/panel/comunidad?editar=${p.id}#publicar`} className="btn btn-ghost btn-sm min-h-10"><Pencil className="h-4 w-4" /> Editar</Link>
        <Link href={`/cuenta/membresias/${p.productId}/${p.id}`} className="btn btn-ghost btn-sm min-h-10"><Eye className="h-4 w-4" /> Vista previa</Link>
        <ConfirmForm action={publishNow} message="¿Publicarla ahora? La verán tus miembros desde este momento.">
          <input type="hidden" name="postId" value={p.id} />
          <button className="btn btn-outline btn-sm min-h-10"><Send className="h-4 w-4" /> Publicar ahora</button>
        </ConfirmForm>
        <ConfirmForm action={deleteStudioPost} message="¿Eliminar esta publicación? Se borrarán también sus archivos.">
          <input type="hidden" name="postId" value={p.id} />
          <input type="hidden" name="tab" value="programadas" />
          <button className="btn btn-ghost btn-sm min-h-10 hover:text-rose" aria-label={`Eliminar ${p.title}`}><Trash2 className="h-4 w-4" /></button>
        </ConfirmForm>
      </div>
    </li>
  );
  return (
    <div className="space-y-6">
      <section aria-labelledby="h-programadas">
        <h2 id="h-programadas" className="mb-2 flex items-center gap-2 font-semibold"><CalendarClock className="h-4 w-4" /> Programadas ({scheduled.length})</h2>
        <p className="mb-3 text-sm text-muted">Nadie las ve hasta su hora (de {tzCity(owner.timezone)}). Entonces salen en el feed y, si lo pediste, se avisa por email.</p>
        {scheduled.length ? (
          <ul className="card divide-y divide-line">{scheduled.map((p) => row(p, <span className="rounded-full border border-[#ecdcb8] bg-[#fbf5e8] px-2 py-0.5 text-[0.7rem] font-semibold text-[#7a5a1c]">{p.label}</span>))}</ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">No tienes nada programado. Al publicar, elige «Programar».</p>
        )}
      </section>
      <section aria-labelledby="h-borradores">
        <h2 id="h-borradores" className="mb-2 flex items-center gap-2 font-semibold"><FilePen className="h-4 w-4" /> Borradores ({drafts.length})</h2>
        {drafts.length ? (
          <ul className="card divide-y divide-line">{drafts.map((p) => row(p, <span className="rounded-full border border-line bg-sand/70 px-2 py-0.5 text-[0.7rem] font-semibold">Borrador · {formatDate(p.updatedAt, { day: "numeric", month: "short" }, owner.timezone)}</span>))}</ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">Sin borradores.</p>
        )}
      </section>
    </div>
  );
}

// ── Calendario ──

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

async function Calendar({ owner, tierId, mes, q }: { owner: Owner; tierId: string | null; mes?: string; q: (o: Partial<SP>) => string }) {
  const todayKey = dateKeyInTz(new Date(), owner.timezone);
  const month = parseMonthParam(mes, todayKey);
  const days = await loadCalendar(owner, month, tierId);
  const current = monthParam(month) === todayKey.slice(0, 7);
  return (
    <section aria-label="Calendario de publicaciones">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="display mr-auto text-[1.6rem] leading-none">{monthTitle(month)}</h2>
        <Link href={q({ mes: monthParam(shiftMonth(month, -1)) })} scroll={false} className="grid h-11 w-11 place-items-center rounded-full border border-line bg-white hover:bg-sand" aria-label="Mes anterior">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        {!current && <Link href={q({ mes: undefined })} scroll={false} className="btn btn-outline btn-sm h-11">Hoy</Link>}
        <Link href={q({ mes: monthParam(shiftMonth(month, 1)) })} scroll={false} className="grid h-11 w-11 place-items-center rounded-full border border-line bg-white hover:bg-sand" aria-label="Mes siguiente">
          <ChevronRight className="h-5 w-5" />
        </Link>
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="grid grid-cols-7 border-b border-line bg-paper text-center text-[0.68rem] font-semibold uppercase tracking-wider text-muted" aria-hidden>
          {WEEKDAYS.map((w) => <div key={w} className="py-1.5">{w}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => (
            <div
              key={d.key}
              data-day={d.key}
              className={`relative flex min-h-[4.75rem] min-w-0 flex-col gap-0.5 border-line p-1 sm:min-h-[6.5rem] sm:p-1.5 ${i % 7 ? "border-l" : ""} ${i >= 7 ? "border-t" : ""} ${d.inMonth ? "" : "bg-paper/70 text-faint"}`}
            >
              <span className="flex items-center justify-between gap-0.5">
                <span className={`grid h-6 min-w-6 place-items-center rounded-full text-xs font-semibold tabular-nums ${d.key === todayKey ? "bg-ink text-cream" : ""}`}>{Number(d.key.slice(8))}</span>
                {d.moon && <span className="text-[0.8rem] leading-none" title={d.moonLabel ?? undefined} aria-label={d.moonLabel ?? undefined}>{d.moon === "new" ? "🌑" : "🌕"}</span>}
              </span>
              {d.entries.map((e) => (
                <Link
                  key={`${e.id}-${e.live ? "l" : "p"}`}
                  href={e.state === "SCHEDULED" ? `/panel/comunidad?editar=${e.id}#publicar` : `/cuenta/membresias/${e.productId}/${e.id}`}
                  title={`${e.time} · ${e.title} (${e.tier})${e.live ? " · encuentro en directo" : e.state === "SCHEDULED" ? " · programada" : ""}`}
                  className={`block truncate rounded-md px-1 py-0.5 text-[0.62rem] font-semibold leading-tight sm:text-[0.68rem] ${
                    e.live ? "bg-lavender-deep text-white" : e.state === "SCHEDULED" ? "border border-dashed border-[#d9bf86] bg-[#fbf5e8] text-[#7a5a1c]" : "bg-[#e7f3ec] text-[#2f5f43]"
                  }`}
                  data-cal-entry={e.state}
                >
                  <span className="hidden sm:inline">{e.time} </span>{e.title}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted" aria-label="Leyenda">
        <li className="flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-[#e7f3ec]" /> Publicada</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-5 rounded border border-dashed border-[#d9bf86] bg-[#fbf5e8]" /> Programada</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-lavender-deep" /> Ceremonia, círculo o directo</li>
        <li className="flex items-center gap-1.5"><span aria-hidden>🌑</span> Luna nueva</li>
        <li className="flex items-center gap-1.5"><span aria-hidden>🌕</span> Luna llena</li>
      </ul>
      <p className="mt-1.5 text-xs text-faint">Horas de {tzCity(owner.timezone)}. Toca una programada para editarla.</p>
    </section>
  );
}

// ── Miembros ──

const STATUS: Record<"active" | "canceled" | "expired", { label: string; tone: "success" | "warning" | "neutral" }> = {
  active: { label: "Activa", tone: "success" },
  canceled: { label: "Cancelada", tone: "warning" },
  expired: { label: "Terminada", tone: "neutral" },
};

async function Members({ owner, tiers, tierId, q }: { owner: Owner; tiers: Tiers; tierId: string | null; q: (o: Partial<SP>) => string }) {
  const tier = tiers.find((t) => t.id === tierId) ?? tiers[tiers.length - 1];
  const rows = await loadMembers(owner, tier.id);
  const counts = { active: rows.filter((r) => r.status === "active").length, canceled: rows.filter((r) => r.status === "canceled").length, expired: rows.filter((r) => r.status === "expired").length };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label="Nivel">
        {tiers.map((t) => (
          <TierChip key={t.id} href={q({ nivel: t.id })} active={t.id === tier.id}>{t.emoji} {t.title}</TierChip>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Activas" value={counts.active} />
        <Stat label="Canceladas" value={counts.canceled} hint="Hasta fin de periodo" />
        <Stat label="Terminadas" value={counts.expired} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          Cuenta atrás de cada una: 5 días antes le llega un email para renovar y el día que vence se bloquea sola. Tick verde = ha pagado (otro periodo); X = bloquear ya.
        </p>
        <p className="text-sm text-muted">
          En «{tier.title}» directamente{tier.includedBy.length ? `. Quienes están en ${tier.includedBy.map((id) => `«${tiers.find((t) => t.id === id)?.title}»`).join(" y ")} también leen lo de este nivel` : ""}.
        </p>
        <Link href="/panel/solicitudes/dar" className="btn btn-outline btn-sm min-h-10"><UserPlus className="h-4 w-4" /> Dar acceso a mano</Link>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">Nadie en «{tier.title}» todavía.</p>
      ) : (
        <ul className="card divide-y divide-line" aria-label={`Miembros de ${tier.title}`}>
          {rows.map((r) => (
            <li key={r.userId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3" data-member={r.status}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.name}</p>
                <p className="truncate text-xs text-muted">{r.email}</p>
              </div>
              <div className="text-xs text-muted sm:w-40">
                <p>Desde el {r.since}</p>
                <p>{r.until}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Countdown r={r} />
                {!r.subscription && (
                  <>
                    <ConfirmForm action={renewMember} message={`¿${r.name} ha pagado? Se renueva otro periodo y le llega un email.`}>
                      <input type="hidden" name="accessId" value={r.accessId} />
                      <input type="hidden" name="nivel" value={tier.id} />
                      <button className="grid h-10 w-10 place-items-center rounded-full bg-[#2f8a55] text-white transition hover:brightness-110" title="Ha pagado: renovar" aria-label={`${r.name} ha pagado: renovar`}>
                        <Check className="h-5 w-5" strokeWidth={3} />
                      </button>
                    </ConfirmForm>
                    {!r.blocked && (
                      <ConfirmForm action={blockMember} message={`¿Bloquear la membresía de ${r.name}? Dejará de entrar ahora mismo.`}>
                        <input type="hidden" name="accessId" value={r.accessId} />
                        <input type="hidden" name="nivel" value={tier.id} />
                        <button className="grid h-10 w-10 place-items-center rounded-full bg-[#c0473a] text-white transition hover:brightness-110" title="No ha pagado: bloquear" aria-label={`${r.name} no ha pagado: bloquear`}>
                          <X className="h-5 w-5" strokeWidth={3} />
                        </button>
                      </ConfirmForm>
                    )}
                  </>
                )}
                <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                <span className={`text-xs ${r.manual ? "font-semibold text-ink" : "text-muted"}`}>{r.origin}</span>
                {r.customerId && <Link href={`/panel/clientes/${r.customerId}`} className="btn btn-ghost btn-sm min-h-10" aria-label={`Ver ficha de ${r.name} en Clientes`}>Ficha</Link>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Datos ──

async function Data({ owner, tierId }: { owner: Owner; tierId: string | null }) {
  const { posts, totals } = await loadStats(owner, tierId);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Vistas" value={totals.views} hint="Personas que la abrieron" />
        <Stat label="Me gusta" value={totals.likes} />
        <Stat label="Comentarios" value={totals.comments} />
      </div>
      {posts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">Cuando publiques, aquí verás cómo le va a cada publicación.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-2.5 font-semibold">Publicación</th>
                <th className="px-2 py-2.5 text-right font-semibold">Vistas</th>
                <th className="px-2 py-2.5 text-right font-semibold">Me gusta</th>
                <th className="px-2 py-2.5 text-right font-semibold">Coment.</th>
                <th className="px-4 py-2.5 text-right font-semibold">Aviso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {posts.map((p) => (
                <tr key={p.id} data-stats-post={p.id}>
                  <td className="max-w-0 px-4 py-2.5">
                    <Link href={`/cuenta/membresias/${p.productId}/${p.id}`} className="block truncate font-semibold hover:underline">{p.pinnedAt && <Pin className="mr-1 inline h-3 w-3" />}{p.title}</Link>
                    <span className="text-xs text-muted">{p.product.title} · {formatDate(p.publishedAt, { day: "numeric", month: "short" }, owner.timezone)}</span>
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{p._count.views}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{p._count.likes}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{p._count.comments}</td>
                  <td className="px-4 py-2.5 text-right text-xs text-muted">{p.notify && p.notifiedAt ? `${p.notifiedCount} emails` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-faint">Vistas: personas distintas que abrieron la publicación desde su área (sin contarte a ti). Se cuentan desde que existe el estudio.</p>
    </div>
  );
}
