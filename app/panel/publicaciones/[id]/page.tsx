import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Trash2 } from "lucide-react";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { requireCreator } from "@/lib/auth";
import { appHost } from "@/lib/env";
import { isPersonalMode } from "@/lib/site-mode";
import { sitePageLinkTargets } from "@/lib/site-pages.server";
import { POST_STATE_LABEL, postPath, postState, readPostMedia } from "@/lib/posts";
import { tenantDb } from "@/lib/tenant";
import { dateKeyInTz } from "@/lib/tz";
import { Badge, PageHeader } from "../../ui";
import { deletePost } from "../actions";
import { PostForm } from "../post-form";

export const metadata: Metadata = { title: "Publicación" };

const SAVED: Record<string, string> = {
  publicada: "Publicada: ya se ve en tu página.",
  borrador: "Borrador guardado. No se ve en tu página hasta que la publiques.",
};

export default async function EditPostPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ guardada?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { creator } = await requireCreator();
  const post = await tenantDb(creator.id).post.findFirst({ where: { id } });
  if (!post) notFound();
  const state = postState(post);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/panel/actualidades" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Actualidades
      </Link>
      <PageHeader
        title="Editar publicación"
        subtitle={<Badge tone={state === "PUBLISHED" ? "success" : state === "DRAFT" ? "warning" : "neutral"}>{POST_STATE_LABEL[state]}</Badge>}
        actions={
          state === "PUBLISHED" ? (
            <Link href={postPath(creator.username, post.slug)} target="_blank" className="btn btn-outline btn-sm">
              <ExternalLink className="h-4 w-4" /> Ver en tu página
            </Link>
          ) : null
        }
      />
      <PostForm
        host={appHost()}
        username={creator.username}
        personal={isPersonalMode()}
        linkTargets={await sitePageLinkTargets(creator.id, creator.username, isPersonalMode())}
        initialMessage={sp.guardada ? (SAVED[sp.guardada] ?? null) : null}
        post={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt ?? "",
          body: post.body,
          bodyFormat: post.bodyFormat,
          imageUrl: post.imageUrl,
          status: post.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
          publishedOn: post.publishedAt ? dateKeyInTz(post.publishedAt, creator.timezone) : "",
          media: readPostMedia(post.mediaKind, post.media),
          ctaLabel: post.ctaLabel ?? "",
          ctaUrl: post.ctaUrl ?? "",
          ctaCode: post.ctaCode ?? "",
        }}
      />
      <ConfirmForm action={deletePost} message="¿Borrar esta publicación? Desaparece de tu página y no se puede deshacer." className="mt-10 border-t border-line pt-6">
        <input type="hidden" name="id" value={post.id} />
        <button className="btn btn-ghost btn-sm text-rose">
          <Trash2 className="h-4 w-4" /> Borrar publicación
        </button>
      </ConfirmForm>
    </div>
  );
}
