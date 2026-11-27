import { areaProductPath } from "@/lib/public-paths";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen, Mail } from "lucide-react";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { lastDayText } from "@/lib/access-end";
import { areaProductId } from "@/lib/area-product";
import { markFirstAccess, requireBuyerFor } from "@/lib/buyer-access";
import { loadFeed, memberPostKinds } from "@/lib/community";
import { communityTiers } from "@/lib/community-tiers";
import { LayoutGrid } from "lucide-react";
import { KIND_STYLE, kindBase, kindStyle, ka } from "../kind-style";
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
import { CourseLookApply } from "@/components/course/course-look-apply";
import { membershipColors, readAreaDesign } from "@/lib/area-design";
import { AreaDesignScope, AreaText } from "../../design-scope";
import { Tr } from "@/lib/i18n/client";
import { getLocale, getT } from "@/lib/i18n/server";
import { getContentTranslator, translateMemberPost } from "@/lib/i18n/content";

const shortDate = (d: Date) => formatDate(d, { day: "numeric", month: "long" });

export default async function MembershipFeed({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ pago?: string; error?: string; antes?: string; avisos?: string; ver?: string; dia?: string }>;
}) {
  const { productId: ref } = await params;
  const sp = await searchParams;
  // En la web personal, la membresía por su nombre (/area/membership/<nivel>); su código lleva ahí.
  const productId = await areaProductId(ref, "MEMBERSHIP", { query: sp });
  if (!productId) notFound();
  const { user, scoped, isOwner } = await requireBuyerFor({ productId }, `/area/membership/${ref}`);
  // «Ver como miembro» (estudio Comunidad): la dueña mira como alguien de ese nivel. Lo que su nivel no
  // incluye no lo ve (vuelve a la comunidad de su nivel), y no ve borradores ni programadas.
  const viewAs = await ownerViewAs({ creatorId: user.creator?.id, isOwner });
  if (viewAs && !viewAs.reach.includes(productId)) redirect(`/area/membership/${viewAs.id}`);
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
  if (!access && !pastDue) redirect("/area/membership");
  // Ver las publicaciones es empezar a acceder: desde aquí vale su renuncia al desistimiento.
  if (source) await markFirstAccess(user.id, source.productId);
  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId }, include: { creator: true } });
  // Sus textos en el idioma de la web (lib/i18n/content.ts).
  const tx = await getContentTranslator(product.creatorId, await getLocale());
  product.title = tx(product.title);
  if (product.summary) product.summary = tx(product.summary);
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
  const rawFeed = access ? await loadFeed({ productId, viewer: { userId: user.id, isOwner: ownerView }, before, kinds: ver ? [ver] : undefined }) : { posts: [], nextBefore: null };
  const feed = { ...rawFeed, posts: rawFeed.posts.map((p) => translateMemberPost(p, tx)) };
  const tabHref = (v: string | null) => (v ? `/area/membership/${ref}?ver=${v}` : `/area/membership/${ref}`);
  const courseIds = access ? await includedProductIds(productId) : [];
  const tierRows = lowerTiers.length ? await prisma.product.findMany({ where: { id: { in: lowerTiers } }, select: { id: true, title: true, emoji: true } }) : [];
  const courses = courseIds.length
    ? await prisma.product.findMany({ where: { id: { in: courseIds }, type: "COURSE", status: { not: "ARCHIVED" } }, select: { id: true, slug: true, type: true, title: true, emoji: true, imageUrl: true, _count: { select: { lessons: { where: { published: true } } } } } })
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
  // El nivel (0 = I) para el sólido de su tarjeta: el mismo orden que los portales de «Mis membresías».
  const level = (await communityTiers(product.creatorId)).filter((t) => t.status === "PUBLISHED").findIndex((t) => t.id === product.id);
  const tierName = source?.via ? `${product.title} · por ${source.via.title}` : product.title;
  // Lo de dentro que pone la creadora (Mi página › Membresías): colores, piezas, textos y el orden de las partes.
  const design = readAreaDesign(product.creator.areaDesign);
  return (
    <AreaDesignScope parts={{ texts: design.texts, pieces: design.pieces, kinds: design.kinds, order: design.order }}>
    {/* flex-col: las partes (data-area-section) van en el orden que elija la creadora. */}
    <div className="mx-auto flex max-w-3xl flex-col">
      {/* Los colores de las membresías por dentro (o los de este nivel). */}
      <CourseLookApply look={membershipColors(product.id, design)} />
      {viewAs && <ViewAsBanner creatorId={product.creatorId} tier={viewAs} />}
      {!scoped && !viewAs && (
        <Link href="/area/membership" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" />{" "}<Tr s={"Mis membresías"} /></Link>
      )}
      <div className="mt-5" data-area-section="membership:hero">
        <MemberHero eyebrow={<AreaText k="hero.eyebrow" />} title={product.title} summary={product.summary} imageUrl={product.imageUrl} greeting={greeting} moon={moon} quote={phraseOfDay(now)} />
      </div>
      {access && (
        <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-stretch" data-area-section="membership:card">
          <MemberCard name={ownerView ? c.displayName : (user.name ?? user.email)} tier={tierName} emoji={product.emoji} level={level} since={since} note={ownerView ? "Vista de la autora" : null} />
          <div className="vip-glass flex flex-col justify-center rounded-[1.4rem] p-5 text-sm leading-relaxed text-ink/80" data-area-piece="sacred-card">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-gold">
              <AreaText k="sacred.title" />
            </p>
            <p className="mt-2">
              <AreaText k="sacred.text" />
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 pt-5" data-area-section="membership:notices">
      <div>
        <Flash ok={sp.pago === "ok" ? "Pago recibido. ¡Gracias!" : null} error={sp.error} />
      </div>
      {sub && pastDue && (
        <div className="rounded-2xl border border-[#ecdcb8] bg-[#fbf5e8] p-5 text-[#7a5a1c]">
          <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />{" "}<Tr s={"No hemos podido renovar tu membresía"} /></p>
          <p className="mt-1.5 text-sm">
            {sub.nextRenewalAttemptAt && access
              ? `Mantienes el acceso hasta el ${shortDate(sub.nextRenewalAttemptAt)}. Volveremos a intentarlo ese día o puedes pagar ahora.`
              : <Tr s={"Paga la renovación para recuperar el acceso."} />}
          </p>
          <form action={payRenewalNow} className="mt-4">
            <input type="hidden" name="productId" value={productId} />
            <SubmitButton className="btn btn-primary btn-sm" pendingLabel={(await getT())("Abriendo el pago…")}><Tr s={"Pagar ahora ·"} />{" "}{formatPrice(sub.priceCents, "EUR")}
            </SubmitButton>
          </form>
        </div>
      )}

      {ownerView && (
        <div className="rounded-2xl border border-line bg-sand/60 px-4 py-3 text-sm"><Tr s={"Así ven tu comunidad tus miembros. Los borradores y las programadas solo los ves tú."} />{" "}
          <Link href={`/panel/comunidad?nivel=${productId}`} className="font-semibold underline-offset-2 hover:underline"><Tr s={"Volver a Comunidad"} /></Link>
        </div>
      )}
      {endsAt && (
        <div className="rounded-2xl border border-line p-4 text-sm">
          <p className="font-semibold"><Tr s={"Tu acceso termina el"} />{" "}{lastDayText(endsAt, product.creator.timezone)}</p>
          <p className="mt-0.5 text-muted"><Tr s={"Hasta ese día (incluido) puedes entrar cuando quieras"} />{courses.length ? <Tr s={", también a los cursos que incluye"} /> : ""}.</p>
        </div>
      )}
      {!endsAt && source?.via && <p className="text-sm text-muted"><Tr s={"Incluida en «"} />{source.via.title}».</p>}
      </div>


      {courses.length > 0 && (
        <section className="mt-8" data-area-section="membership:courses">
          <h2 className="eyebrow !text-ink">
            <AreaText k="included.title" />
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {courses.map((co) => (
              <Link key={co.id} href={areaProductPath(co)} className="card flex min-h-11 items-center gap-3 p-4 transition hover:shadow-lift" data-area-piece="included-course">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sand text-xl">{co.emoji ?? <BookOpen className="h-5 w-5" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{co.title}</span>
                  <span className="text-xs text-muted"><Tr s={"Curso ·"} />{" "}{co._count.lessons} {co._count.lessons === 1 ? <Tr s={"lección"} /> : "lecciones"}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <div data-area-section="membership:feed">
      {access && <Ornament className="mt-10" />}
      {tabs && (
        <nav className="mt-6 flex flex-wrap justify-center gap-2" aria-label={(await getT())("Filtrar")}>
          {[null, ...kinds].map((k) => {
            const on = ver === k;
            const st = k ? kindStyle(k) : null;
            return (
              <FilterLink
                key={k ?? "todo"}
                href={tabHref(k)}
                aria-current={on ? "page" : undefined}
                data-area-kind={k ? kindBase(k) : undefined}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold backdrop-blur transition"
                style={on ? { background: st ? `linear-gradient(135deg, ${st.color}, ${ka(st.color, "aa")})` : "linear-gradient(135deg, #F0D9A4, #C8A86E)", borderColor: st?.light ?? "#F0D9A4", color: st ? "#fff" : "#15122a", boxShadow: `0 0 24px -6px ${st?.color ?? "#D4B57A"}` } : { borderColor: st ? `${ka(st.light, "40")}` : "rgb(233 204 142 / .35)", color: st?.light ?? "#F0D9A4", background: "rgb(24 21 52 / .55)" }}
              >
                {st ? <st.Icon className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />} {st ? st.plural : <AreaText k="feed.all" />}
              </FilterLink>
            );
          })}
        </nav>
      )}

      <div className="mt-8 space-y-4">
        {feed.posts.map((post) => (
          <PostCard key={post.id} post={post} timeZone={tz} tier={post.productId !== productId ? post.product.title : null} canSave={!isOwner && !scoped} canLike={!isOwner} />
        ))}
        {access && feed.posts.length === 0 && <p className="text-sm text-muted">{before ? <Tr s={"No hay publicaciones anteriores."} /> : <AreaText k="feed.empty" />}</p>}
        {feed.nextBefore && (
          <Link href={`/area/membership/${ref}?${ver ? `ver=${ver}&` : ""}antes=${encodeURIComponent(feed.nextBefore)}`} className="btn btn-outline min-h-11 w-full"><Tr s={"Ver publicaciones anteriores"} /></Link>
        )}
        {before && (
          <Link href={tabHref(ver)} className="block text-center text-sm font-semibold text-muted hover:text-ink"><Tr s={"Volver a lo último"} /></Link>
        )}
      </div>
      </div>

      {customer && access && (
        <form action={setCommunityEmails} data-area-section="membership:emails" className="mt-8 flex flex-wrap items-center gap-3 rounded-2xl border border-line px-4 py-3 text-sm">
          <Mail className="h-4 w-4 shrink-0 text-muted" />
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="on" value={customer.postEmailsOptOutAt ? "1" : "0"} />
          <span className="min-w-0 flex-1"><Tr s={"Avisos por email de publicaciones nuevas:"} />{" "}<strong>{customer.postEmailsOptOutAt ? <Tr s={"Desactivados"} /> : <Tr s={"Activados"} />}</strong>
          </span>
          <SubmitButton className="btn btn-ghost btn-sm min-h-10">{customer.postEmailsOptOutAt ? <Tr s={"Activar"} /> : <Tr s={"Desactivar"} />}</SubmitButton>
        </form>
      )}

      {sub && !pastDue && (
        <div className="mt-10 rounded-2xl border border-line p-5" data-area-section="membership:subscription">
          <p className="text-sm font-semibold"><Tr s={"Tu suscripción"} /></p>
          <p className="mt-1 text-sm text-muted">
            {formatPrice(sub.priceCents, "EUR", sub.interval)} ·{" "}
            {sub.cancelAtPeriodEnd
              ? `cancelada: mantienes el acceso hasta el ${shortDate(sub.currentPeriodEnd)}`
              : `próxima renovación el ${shortDate(sub.currentPeriodEnd)}`}
          </p>
          {scoped ? (
            <p className="mt-3 text-sm text-muted"><Tr s={"Para gestionar tu suscripción, entra con el enlace de tu email."} /></p>
          ) : (
            <form action={sub.cancelAtPeriodEnd ? resumeMembership : cancelMembership} className="mt-4">
              <input type="hidden" name="subscriptionId" value={sub.id} />
              <SubmitButton className={`btn btn-sm ${sub.cancelAtPeriodEnd ? "btn-primary" : "btn-danger"}`}>
                {sub.cancelAtPeriodEnd ? <Tr s={"Reactivar suscripción"} /> : <Tr s={"Cancelar suscripción"} />}
              </SubmitButton>
            </form>
          )}
        </div>
      )}
    </div>
    </AreaDesignScope>
  );
}
