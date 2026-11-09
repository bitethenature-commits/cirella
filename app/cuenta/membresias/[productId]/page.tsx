import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen, Mail } from "lucide-react";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { lastDayText } from "@/lib/access-end";
import { markFirstAccess, requireBuyerFor } from "@/lib/buyer-access";
import { loadFeed, memberPostKinds } from "@/lib/community";
import { LayoutGrid } from "lucide-react";
import { KIND_STYLE, kindStyle } from "../kind-style";
import { FilterLink } from "../filter-link";
import { creatorBrief } from "@/lib/customer";
import { prisma } from "@/lib/db";
import { accessSource, includedMembershipIds, includedProductIds } from "@/lib/membership-access";
import { formatPrice } from "@/lib/money";
import { cancelMembership, resumeMembership } from "../../actions";
import { PostCard } from "../post-card";
import { payRenewalNow, setCommunityEmails } from "./actions";
import { formatDate, zonedParts } from "@/lib/tz";
import { moonState } from "@/lib/lunar-sky";
import { EIGHT_PHASES } from "@/components/models/data/moon";
import { SIGNS } from "@/components/models/data/astrology";
import { MemberCard, MemberHero, Ornament, greetingFor, phraseOfDay } from "../vip";
import { ownerViewAs } from "@/lib/view-as";
import { ViewAsBanner } from "../view-as-banner";

const shortDate = (d: Date) => formatDate(d, { day: "numeric", month: "long" });

export default async function MembershipFeed({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ pago?: string; error?: string; antes?: string; avisos?: string; ver?: string; dia?: string }>;
}) {
  const { productId } = await params;
  const sp = await searchParams;
  const { user, scoped, isOwner } = await requireBuyerFor({ productId }, `/cuenta/membresias/${productId}`);
  // «Ver como miembro» (estudio Comunidad): la dueña mira como alguien de ese nivel. Lo que su nivel no
  // incluye no lo ve (vuelve a la comunidad de su nivel), y no ve borradores ni programadas.
  const viewAs = await ownerViewAs({ creatorId: user.creator?.id, isOwner });
  if (viewAs && !viewAs.reach.includes(productId)) redirect(`/cuenta/membresias/${viewAs.id}`);
  const ownerView = isOwner && !viewAs;
  const sub = await prisma.subscription.findFirst({
    where: { userId: user.id, productId, status: { in: ["ACTIVE", "PAST_DUE"] } },
    orderBy: { createdAt: "desc" },
  });
  const pastDue = sub?.status === "PAST_DUE";
  // Con la renovación pendiente de pago se puede entrar a pagarla aunque el periodo de gracia haya vencido.
  // La fecha de fin se comprueba ahora mismo: pasado el periodo pagado o la fecha que puso la dueña, no entra.
  const source = isOwner ? null : await accessSource(user.id, productId);
  const access = isOwner || !!source;
  if (!access && !pastDue) redirect("/cuenta/membresias");
  // Ver las publicaciones es empezar a acceder: desde aquí vale su renuncia al desistimiento.
  if (source) await markFirstAccess(user.id, source.productId);
  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId }, include: { creator: true } });
  const c = creatorBrief(product.creator);
  const before = sp.antes && !Number.isNaN(Date.parse(sp.antes)) ? new Date(sp.antes) : null;
  // Cada nivel enseña solo lo suyo; los niveles que incluye (lib/tiers.ts) se abren con sus botones de arriba.
  const lowerTiers = access ? await includedMembershipIds(productId) : [];
  const tz = product.creator.timezone;
  // Filtros por tipo («Podcast», «Ceremonias», «Masterclases»…) encima de la lista, de lo más nuevo a lo más
  // antiguo. «Todo» la enseña entera.
  // Los textos no tienen filtro: son lo propio de Esencia.
  const kinds = access ? (await memberPostKinds(productId, ownerView)).filter((k) => k !== "TEXT").sort((a, b) => Object.keys(KIND_STYLE).indexOf(a) - Object.keys(KIND_STYLE).indexOf(b)) : [];
  const tabs = kinds.length > 1;
  const ver = tabs && sp.ver && kinds.includes(sp.ver) ? sp.ver : null;
  const feed = access ? await loadFeed({ productId, viewer: { userId: user.id, isOwner: ownerView }, before, kinds: ver ? [ver] : undefined }) : { posts: [], nextBefore: null };
  const tabHref = (v: string | null) => (v ? `/cuenta/membresias/${productId}?ver=${v}` : `/cuenta/membresias/${productId}`);
  const courseIds = access ? await includedProductIds(productId) : [];
  const tierRows = lowerTiers.length ? await prisma.product.findMany({ where: { id: { in: lowerTiers } }, select: { id: true, title: true, emoji: true } }) : [];
  const courses = courseIds.length
    ? await prisma.product.findMany({ where: { id: { in: courseIds }, type: "COURSE", status: { not: "ARCHIVED" } }, select: { id: true, title: true, emoji: true, imageUrl: true, _count: { select: { lessons: { where: { published: true } } } } } })
    : [];
  const customer = isOwner ? null : await prisma.customer.findUnique({ where: { creatorId_userId: { creatorId: product.creatorId, userId: user.id } }, select: { postEmailsOptOutAt: true } });
  // Acceso con fecha de fin sin suscripción (dado a mano o un programa de 3 meses).
  const endsAt = !sub && source?.expiresAt ? source.expiresAt : null;
  // Lo VIP: el saludo por la hora (en la zona de la autora), la Luna de hoy, la frase del día y la tarjeta.
  const now = new Date();
  const firstName = (user.name ?? "").trim().split(/\s+/)[0] || null;
  const greeting = ownerView ? null : `${greetingFor(zonedParts(now, tz).hour)}${firstName ? `, ${firstName}` : ""}`;
  const sky = moonState(now);
  const moonSign = SIGNS[Math.floor((((sky.moonLon % 360) + 360) % 360) / 30)];
  const moon = { elong: sky.elong, phase: EIGHT_PHASES[Math.floor(sky.elong / 45) % 8], sign: moonSign.name, glyph: `${moonSign.glyph}\uFE0E` };
  const accessRow = source ? await prisma.access.findUnique({ where: { id: source.accessId }, select: { createdAt: true } }) : null;
  const since = accessRow ? formatDate(accessRow.createdAt, { month: "long", year: "numeric" }, tz) : null;
  const tierName = source?.via ? `${product.title} · por ${source.via.title}` : product.title;
  return (
    <div className="mx-auto max-w-3xl">
      {viewAs && <ViewAsBanner creatorId={product.creatorId} tier={viewAs} />}
      {!scoped && !viewAs && (
        <Link href="/cuenta/membresias" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Mis membresías
        </Link>
      )}
      <div className="mt-5">
        <MemberHero eyebrow="Tu comunidad privada" title={product.title} summary={product.summary} imageUrl={product.imageUrl} greeting={greeting} moon={moon} quote={phraseOfDay(now)} />
      </div>
      {access && (
        <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-stretch">
          <MemberCard name={ownerView ? c.displayName : (user.name ?? user.email)} tier={tierName} emoji={product.emoji} since={since} note={ownerView ? "Vista de la autora" : null} />
          <div className="vip-glass flex flex-col justify-center rounded-[1.4rem] p-5 text-sm leading-relaxed text-ink/80">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-gold">Tu espacio sagrado</p>
            <p className="mt-2">Todo lo de aquí es solo para miembros. Tómate tu tiempo: enciende una vela, respira y entra cuando te apetezca.</p>
          </div>
        </div>
      )}

      <div className="mt-5">
        <Flash ok={sp.pago === "ok" ? "Pago recibido. ¡Gracias!" : null} error={sp.error} />
      </div>
      {sub && pastDue && (
        <div className="rounded-2xl border border-[#ecdcb8] bg-[#fbf5e8] p-5 text-[#7a5a1c]">
          <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> No hemos podido renovar tu membresía</p>
          <p className="mt-1.5 text-sm">
            {sub.nextRenewalAttemptAt && access
              ? `Mantienes el acceso hasta el ${shortDate(sub.nextRenewalAttemptAt)}. Volveremos a intentarlo ese día o puedes pagar ahora.`
              : "Paga la renovación para recuperar el acceso."}
          </p>
          <form action={payRenewalNow} className="mt-4">
            <input type="hidden" name="productId" value={productId} />
            <SubmitButton className="btn btn-primary btn-sm" pendingLabel="Abriendo el pago…">
              Pagar ahora · {formatPrice(sub.priceCents, "EUR")}
            </SubmitButton>
          </form>
        </div>
      )}

      {ownerView && (
        <div className="rounded-2xl border border-line bg-sand/60 px-4 py-3 text-sm">
          Así ven tu comunidad tus miembros. Los borradores y las programadas solo los ves tú.{" "}
          <Link href={`/panel/comunidad?nivel=${productId}`} className="font-semibold underline-offset-2 hover:underline">Volver a Comunidad</Link>
        </div>
      )}
      {endsAt && (
        <div className="rounded-2xl border border-line p-4 text-sm">
          <p className="font-semibold">Tu acceso termina el {lastDayText(endsAt, product.creator.timezone)}</p>
          <p className="mt-0.5 text-muted">Hasta ese día (incluido) puedes entrar cuando quieras{courses.length ? ", también a los cursos que incluye" : ""}.</p>
        </div>
      )}
      {!endsAt && source?.via && <p className="text-sm text-muted">Incluida en «{source.via.title}».</p>}


      {courses.length > 0 && (
        <section className="mt-8">
          <h2 className="eyebrow !text-ink">Incluido en tu membresía</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {courses.map((co) => (
              <Link key={co.id} href={`/cuenta/cursos/${co.id}`} className="card flex min-h-11 items-center gap-3 p-4 transition hover:shadow-lift">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sand text-xl">{co.emoji ?? <BookOpen className="h-5 w-5" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{co.title}</span>
                  <span className="text-xs text-muted">Curso · {co._count.lessons} {co._count.lessons === 1 ? "lección" : "lecciones"}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {access && <Ornament className="mt-10" />}
      {tabs && (
        <nav className="mt-6 flex flex-wrap justify-center gap-2" aria-label="Filtrar">
          {[null, ...kinds].map((k) => {
            const on = ver === k;
            const st = k ? kindStyle(k) : null;
            return (
              <FilterLink
                key={k ?? "todo"}
                href={tabHref(k)}
                aria-current={on ? "page" : undefined}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold backdrop-blur transition"
                style={on ? { background: st ? `linear-gradient(135deg, ${st.color}, ${st.color}aa)` : "linear-gradient(135deg, #F0D9A4, #C8A86E)", borderColor: st?.light ?? "#F0D9A4", color: st ? "#fff" : "#15122a", boxShadow: `0 0 24px -6px ${st?.color ?? "#D4B57A"}` } : { borderColor: st ? `${st.light}40` : "rgb(233 204 142 / .35)", color: st?.light ?? "#F0D9A4", background: "rgb(24 21 52 / .55)" }}
              >
                {st ? <st.Icon className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />} {st ? st.plural : "Todo"}
              </FilterLink>
            );
          })}
        </nav>
      )}

      <div className="mt-8 space-y-4">
        {feed.posts.map((post) => (
          <PostCard key={post.id} post={post} timeZone={tz} tier={post.productId !== productId ? post.product.title : null} canSave={!isOwner && !scoped} />
        ))}
        {access && feed.posts.length === 0 && <p className="text-sm text-muted">{before ? "No hay publicaciones anteriores." : "Pronto habrá contenido nuevo aquí."}</p>}
        {feed.nextBefore && (
          <Link href={`/cuenta/membresias/${productId}?${ver ? `ver=${ver}&` : ""}antes=${encodeURIComponent(feed.nextBefore)}`} className="btn btn-outline min-h-11 w-full">
            Ver publicaciones anteriores
          </Link>
        )}
        {before && (
          <Link href={tabHref(ver)} className="block text-center text-sm font-semibold text-muted hover:text-ink">
            Volver a lo último
          </Link>
        )}
      </div>

      {customer && access && (
        <form action={setCommunityEmails} className="mt-8 flex flex-wrap items-center gap-3 rounded-2xl border border-line px-4 py-3 text-sm">
          <Mail className="h-4 w-4 shrink-0 text-muted" />
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="on" value={customer.postEmailsOptOutAt ? "1" : "0"} />
          <span className="min-w-0 flex-1">
            Avisos por email de publicaciones nuevas: <strong>{customer.postEmailsOptOutAt ? "Desactivados" : "Activados"}</strong>
          </span>
          <SubmitButton className="btn btn-ghost btn-sm min-h-10">{customer.postEmailsOptOutAt ? "Activar" : "Desactivar"}</SubmitButton>
        </form>
      )}

      {sub && !pastDue && (
        <div className="mt-10 rounded-2xl border border-line p-5">
          <p className="text-sm font-semibold">Tu suscripción</p>
          <p className="mt-1 text-sm text-muted">
            {formatPrice(sub.priceCents, "EUR", sub.interval)} ·{" "}
            {sub.cancelAtPeriodEnd
              ? `cancelada: mantienes el acceso hasta el ${shortDate(sub.currentPeriodEnd)}`
              : `próxima renovación el ${shortDate(sub.currentPeriodEnd)}`}
          </p>
          {scoped ? (
            <p className="mt-3 text-sm text-muted">Para gestionar tu suscripción, entra con el enlace de tu email.</p>
          ) : (
            <form action={sub.cancelAtPeriodEnd ? resumeMembership : cancelMembership} className="mt-4">
              <input type="hidden" name="subscriptionId" value={sub.id} />
              <SubmitButton className={`btn btn-sm ${sub.cancelAtPeriodEnd ? "btn-primary" : "btn-danger"}`}>
                {sub.cancelAtPeriodEnd ? "Reactivar suscripción" : "Cancelar suscripción"}
              </SubmitButton>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
