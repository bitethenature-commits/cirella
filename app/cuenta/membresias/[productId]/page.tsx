import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, CalendarDays, Headphones, PenLine } from "lucide-react";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { creatorBrief, hasAccess } from "@/lib/customer";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { cancelMembership, resumeMembership } from "../../actions";
import { CreatorTag } from "../../ui";
import { payRenewalNow } from "./actions";

const KIND = { TEXT: { icon: PenLine, label: "Publicación" }, AUDIO: { icon: Headphones, label: "Audio" }, VIDEO: { icon: Headphones, label: "Vídeo" }, EVENT: { icon: CalendarDays, label: "Directo" } } as const;

const shortDate = (d: Date) => d.toLocaleDateString("es-ES", { day: "numeric", month: "long" });

export default async function MembershipFeed({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ pago?: string; error?: string }>;
}) {
  const { productId } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/cuenta/membresias/${productId}`);
  const sub = await prisma.subscription.findFirst({
    where: { userId: user.id, productId, status: { in: ["ACTIVE", "PAST_DUE"] } },
    orderBy: { createdAt: "desc" },
  });
  const pastDue = sub?.status === "PAST_DUE";
  // Con la renovación pendiente de pago se puede entrar a pagarla aunque el periodo de gracia haya vencido.
  const access = await hasAccess(user.id, productId);
  if (!access && !pastDue) redirect("/cuenta/membresias");
  const product = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
    include: { creator: true, posts: access ? { orderBy: { publishedAt: "desc" } } : { take: 0 } },
  });
  const c = creatorBrief(product.creator);
  return (
    <div className="max-w-2xl">
      <Link href="/cuenta/membresias" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Mis membresías
      </Link>
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

      <div className="mt-8 space-y-4">
        {product.posts.map((post) => {
          const k = KIND[post.kind as keyof typeof KIND] ?? KIND.TEXT;
          return (
            <article key={post.id} className="card p-6">
              <p className="flex items-center gap-2 text-xs text-muted">
                <k.icon className="h-3.5 w-3.5" /> {k.label} · {post.publishedAt.toLocaleDateString("es-ES", { day: "numeric", month: "long" })}
              </p>
              <h2 className="display mt-2 text-[1.6rem] leading-tight">{post.title}</h2>
              <p className="mt-3 whitespace-pre-line text-[0.98rem] leading-relaxed text-ink/80">{post.body}</p>
              {post.mediaUrl && (
                <a href={post.mediaUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm mt-4">
                  {post.kind === "EVENT" ? "Unirme al directo" : "Abrir"}
                </a>
              )}
            </article>
          );
        })}
        {access && product.posts.length === 0 && <p className="text-sm text-muted">Pronto habrá contenido nuevo aquí.</p>}
      </div>

      {sub && !pastDue && (
        <div className="mt-10 rounded-2xl border border-line p-5">
          <p className="text-sm font-semibold">Tu suscripción</p>
          <p className="mt-1 text-sm text-muted">
            {formatPrice(sub.priceCents, "EUR", sub.interval)} ·{" "}
            {sub.cancelAtPeriodEnd
              ? `cancelada: mantienes el acceso hasta el ${shortDate(sub.currentPeriodEnd)}`
              : `próxima renovación el ${shortDate(sub.currentPeriodEnd)}`}
          </p>
          <form action={sub.cancelAtPeriodEnd ? resumeMembership : cancelMembership} className="mt-4">
            <input type="hidden" name="subscriptionId" value={sub.id} />
            <SubmitButton className={`btn btn-sm ${sub.cancelAtPeriodEnd ? "btn-primary" : "btn-danger"}`}>
              {sub.cancelAtPeriodEnd ? "Reactivar suscripción" : "Cancelar suscripción"}
            </SubmitButton>
          </form>
        </div>
      )}
      <div className="mt-4"><CreatorTag name={c.displayName} avatarUrl={c.avatarUrl} /></div>
    </div>
  );
}
