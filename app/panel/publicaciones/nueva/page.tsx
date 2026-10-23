import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCreator } from "@/lib/auth";
import { appHost } from "@/lib/env";
import { PageHeader } from "../../ui";
import { PostForm } from "../post-form";

export const metadata: Metadata = { title: "Nueva publicación" };

export default async function NewPostPage() {
  const { creator } = await requireCreator();
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/panel/publicaciones" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Publicaciones
      </Link>
      <PageHeader title="Nueva publicación" />
      <PostForm
        host={appHost()}
        username={creator.username}
        post={{ id: null, title: "", slug: "", excerpt: "", body: "", bodyFormat: "MD", imageUrl: null, status: "DRAFT", publishedOn: "" }}
      />
    </div>
  );
}
