import Link from "next/link";
import { CalendarDays, Headphones, Heart, MessageCircle, PenLine, Video } from "lucide-react";
import { attachmentSummary, MEMBER_POST_KIND_LABEL, type MemberPostKind, type MemberPostState } from "@/lib/community-rules";
import { richToPlain, truncateWords } from "@/lib/rich-text";
import { formatDate } from "@/lib/tz";

const ICON: Record<string, typeof PenLine> = { TEXT: PenLine, AUDIO: Headphones, VIDEO: Video, EVENT: CalendarDays };

export type CardPost = {
  id: string;
  productId: string;
  title: string;
  body: string;
  bodyFormat: string | null;
  kind: string;
  publishedAt: Date;
  state: MemberPostState;
  likedByMe: boolean;
  files: { kind: string; durationSec: number | null }[];
  _count: { likes: number; comments: number };
};

/**
 * Tarjeta de una publicación en el feed: sin reproductores (se cargan en su página), con un
 * extracto, el resumen de sus archivos y los «me gusta» y comentarios. Toda la tarjeta es el enlace.
 */
export function PostCard({ post, timeZone }: { post: CardPost; timeZone: string }) {
  const Icon = ICON[post.kind] ?? PenLine;
  const excerpt = truncateWords(richToPlain(post.body, post.bodyFormat), 220);
  const files = attachmentSummary(post.files);
  return (
    <Link href={`/cuenta/membresias/${post.productId}/${post.id}`} className="card block min-h-11 p-5 transition hover:shadow-lift sm:p-6" data-post-card>
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <Icon className="h-3.5 w-3.5" /> {MEMBER_POST_KIND_LABEL[post.kind as MemberPostKind] ?? "Publicación"} · {formatDate(post.publishedAt, { day: "numeric", month: "long" }, timeZone)}
        {post.state === "DRAFT" && <span className="rounded-full bg-sand px-2 py-0.5 font-semibold text-ink">Borrador · solo lo ves tú</span>}
        {post.state === "SCHEDULED" && <span className="rounded-full border border-[#ecdcb8] bg-[#fbf5e8] px-2 py-0.5 font-semibold text-[#7a5a1c]">Programada · solo lo ves tú</span>}
      </p>
      <h2 className="display mt-2 text-[1.5rem] leading-tight">{post.title}</h2>
      {excerpt && <p className="mt-2 text-[0.95rem] leading-relaxed text-ink/75">{excerpt}</p>}
      {files && <p className="mt-3 text-sm font-medium text-ink/80">{files}</p>}
      <p className="mt-3 flex items-center gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1"><Heart className={`h-3.5 w-3.5 ${post.likedByMe ? "fill-rose text-rose" : ""}`} /> {post._count.likes}</span>
        <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> {post._count.comments} {post._count.comments === 1 ? "comentario" : "comentarios"}</span>
      </p>
    </Link>
  );
}
