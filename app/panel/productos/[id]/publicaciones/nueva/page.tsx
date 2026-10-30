import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCreator } from "@/lib/auth";
import { loadPostEditor } from "../data";
import { PostEditor } from "../post-editor";

export const metadata: Metadata = { title: "Nueva publicación" };

export default async function NewMemberPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { creator } = await requireCreator();
  const data = await loadPostEditor(creator, id, null);
  if (!data) notFound();
  return (
    <div className="max-w-3xl">
      <Link href={`/panel/productos/${id}#publicaciones`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {data.product.title}
      </Link>
      <h1 className="display mb-6 mt-4 text-[2.2rem] leading-tight">Nueva publicación</h1>
      <PostEditor
        productId={id}
        post={data.editor}
        members={data.members}
        timeZone={creator.timezone}
        minAt={data.minAt}
        limitsLabel={data.limitsLabel}
        moonDates={data.moonDates}
        notifiedNote={null}
      />
    </div>
  );
}
