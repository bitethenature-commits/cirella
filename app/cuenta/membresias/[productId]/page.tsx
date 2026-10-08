import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, Headphones, PenLine } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { creatorBrief, hasAccess } from "@/lib/customer";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { cancelMembership, resumeMembership } from "../../actions";
import { CreatorTag } from "../../ui";

const KIND = { TEXT: { icon: PenLine, label: "Publicación" }, AUDIO: { icon: Headphones, label: "Audio" }, VIDEO: { icon: Headphones, label: "Vídeo" }, EVENT: { icon: CalendarDays, label: "Directo" } } as const;

export default async function MembershipFeed({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const user = await requireUser(`/cuenta/membresias/${productId}`);
  if (!(await hasAccess(user.id, productId))) redirect("/cuenta/membresias");
  const product = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
    include: { creator: true, posts: { orderBy: { publishedAt: "desc" } } },
  });
  const sub = await prisma.subscription.findFirst({ where: { userId: user.id, productId, status: "ACTIVE" }, orderBy: { createdAt: "desc" } });
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
        {product.posts.length === 0 && <p className="text-sm text-muted">Pronto habrá contenido nuevo aquí.</p>}
      </div>

      {sub && (
        <div className="mt-10 rounded-2xl border border-line p-5">
          <p className="text-sm font-semibold">Tu suscripción</p>
          <p className="mt-1 text-sm text-muted">
            {formatPrice(sub.priceCents, "EUR", sub.interval)} ·{" "}
            {sub.cancelAtPeriodEnd
              ? `cancelada: mantienes el acceso hasta el ${sub.currentPeriodEnd.toLocaleDateString("es-ES", { day: "numeric", month: "long" })}`
              : `próxima renovación el ${sub.currentPeriodEnd.toLocaleDateString("es-ES", { day: "numeric", month: "long" })}`}
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
