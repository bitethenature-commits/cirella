import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen, Mail } from "lucide-react";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { lastDayText } from "@/lib/access-end";
import { markFirstAccess, requireBuyerFor } from "@/lib/buyer-access";
import { loadFeed } from "@/lib/community";
import { creatorBrief } from "@/lib/customer";
import { prisma } from "@/lib/db";
import { accessSource, includedMembershipIds, includedProductIds } from "@/lib/membership-access";
import { formatPrice } from "@/lib/money";
import { cancelMembership, resumeMembership } from "../../actions";
import { CreatorTag } from "../../ui";
import { PostCard } from "../post-card";
import { payRenewalNow, setCommunityEmails } from "./actions";
import { formatDate } from "@/lib/tz";

const shortDate = (d: Date) => formatDate(d, { day: "numeric", month: "long" });

export default async function MembershipFeed({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ pago?: string; error?: string; antes?: string; avisos?: string }>;
}) {
  const { productId } = await params;
  const sp = await searchParams;
  const { user, scoped, isOwner } = await requireBuyerFor({ productId }, `/cuenta/membresias/${productId}`);
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
  // Un nivel superior lee también las publicaciones de los niveles que incluye (lib/tiers.ts).
  const lowerTiers = access ? await includedMembershipIds(productId) : [];
  const feed = access ? await loadFeed({ productId, alsoProductIds: lowerTiers, viewer: { userId: user.id, isOwner }, before }) : { posts: [], nextBefore: null };
  const courseIds = access ? await includedProductIds(productId) : [];
  const tierRows = lowerTiers.length ? await prisma.product.findMany({ where: { id: { in: lowerTiers } }, select: { id: true, title: true } }) : [];
  const courses = courseIds.length
    ? await prisma.product.findMany({ where: { id: { in: courseIds }, type: "COURSE", status: { not: "ARCHIVED" } }, select: { id: true, title: true, emoji: true, imageUrl: true, _count: { select: { lessons: true } } } })
    : [];
  const customer = isOwner ? null : await prisma.customer.findUnique({ where: { creatorId_userId: { creatorId: product.creatorId, userId: user.id } }, select: { postEmailsOptOutAt: true } });
  // Acceso con fecha de fin sin suscripción (dado a mano o un programa de 3 meses).
  const endsAt = !sub && source?.expiresAt ? source.expiresAt : null;
  return (
    <div className="max-w-2xl">
      {!scoped && (
        <Link href="/cuenta/membresias" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Mis membresías
        </Link>
      )}
      <div className="relative mt-5 overflow-hidden rounded-3xl bg-ink p-7 text-cream">
        {product.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
        )}
        <div className="relative">
          <p className="eyebrow !text-cream/70">Comunidad privada de {c.displayName}</p>
          <h1 className="display mt-2 text-[2.4rem] leading-tight">{product.title}</h1>
          {product.summary && <p className="mt-2 max-w-md text-sm text-cream/75">{product.summary}</p>}
        </div>
      </div>

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

      {isOwner && (
        <div className="rounded-2xl border border-line bg-sand/60 px-4 py-3 text-sm">
          Así ven tu comunidad tus miembros. Los borradores y las programadas solo los ves tú.{" "}
          <Link href={`/panel/productos/${productId}#publicaciones`} className="font-semibold underline-offset-2 hover:underline">Volver al panel</Link>
        </div>
      )}
      {endsAt && (
        <div className="rounded-2xl border border-line p-4 text-sm">
          <p className="font-semibold">Tu acceso termina el {lastDayText(endsAt, product.creator.timezone)}</p>
          <p className="mt-0.5 text-muted">Hasta ese día (incluido) puedes entrar cuando quieras{courses.length ? ", también a los cursos que incluye" : ""}.</p>
        </div>
      )}
      {!endsAt && source?.via && <p className="text-sm text-muted">Incluida en «{source.via.title}».</p>}

      {tierRows.length > 0 && (
        <p className="mt-4 text-sm text-muted" data-included-tiers>
          Tu nivel incluye también {tierRows.map((t, i) => (
            <span key={t.id}>
              {i > 0 && (i === tierRows.length - 1 ? " y " : ", ")}
              <Link href={`/cuenta/membresias/${t.id}`} className="font-semibold text-ink underline-offset-2 hover:underline">«{t.title}»</Link>
            </span>
          ))}: sus publicaciones salen aquí también.
        </p>
      )}

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

      <div className="mt-8 space-y-4">
        {feed.posts.map((post) => (
          <PostCard key={post.id} post={post} timeZone={product.creator.timezone} tier={post.productId !== productId ? post.product.title : null} />
        ))}
        {access && feed.posts.length === 0 && <p className="text-sm text-muted">{before ? "No hay publicaciones anteriores." : "Pronto habrá contenido nuevo aquí."}</p>}
        {feed.nextBefore && (
          <Link href={`/cuenta/membresias/${productId}?antes=${encodeURIComponent(feed.nextBefore)}`} className="btn btn-outline min-h-11 w-full">
            Ver publicaciones anteriores
          </Link>
        )}
        {before && (
          <Link href={`/cuenta/membresias/${productId}`} className="block text-center text-sm font-semibold text-muted hover:text-ink">
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
      <div className="mt-4"><CreatorTag name={c.displayName} avatarUrl={c.avatarUrl} /></div>
    </div>
  );
}
