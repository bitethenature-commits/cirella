import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { PostArticle } from "@/components/creator-page/post-article";
import { requireCreator } from "@/lib/auth";
import { POST_STATE_LABEL, postState } from "@/lib/posts";
import { getPublicCreator } from "@/lib/public";
import { tenantDb } from "@/lib/tenant";
import { formatDate } from "@/lib/tz";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vista previa", robots: { index: false } };

/** Vista previa de una publicación (también de un borrador), con el diseño de la página. Solo la dueña. */
export default async function PostPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { creator } = await requireCreator();
  const [post, data] = await Promise.all([tenantDb(creator.id).post.findFirst({ where: { id } }), getPublicCreator(creator.username, true)]);
  if (!post || !data) notFound();
  const state = postState(post);
  const date = post.publishedAt ?? new Date();

  return (
    <>
      <div className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-ink px-4 py-2 text-center text-xs text-cream">
        <span>Vista previa · {POST_STATE_LABEL[state].toLowerCase()} · solo tú la ves</span>
        <Link href={`/panel/publicaciones/${post.id}`} className="font-semibold underline underline-offset-2">
          Volver a editar
        </Link>
      </div>
      <CreatorShell username={creator.username} config={data.config} allowCustom={data.allowCustom} personal={data.personal} signupsOnly={data.signupsOnly} back={false}>
        <PostArticle
          post={{ ...post, publishedAt: post.publishedAt }}
          dateLabel={state === "DRAFT" && !post.publishedAt ? "Borrador" : formatDate(date, { day: "numeric", month: "long", year: "numeric" }, creator.timezone)}
          listHref={null}
        />
      </CreatorShell>
    </>
  );
}
