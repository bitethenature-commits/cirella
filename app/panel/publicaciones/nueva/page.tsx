import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCreator } from "@/lib/auth";
import { appHost } from "@/lib/env";
import { isPersonalMode } from "@/lib/site-mode";
import { sitePageLinkTargets } from "@/lib/site-pages.server";
import { PageHeader } from "../../ui";
import { PostForm } from "../post-form";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Nueva publicación" };

export default async function NewPostPage() {
  const t = await getT();
  const { creator } = await requireCreator();
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/panel/actualidades" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" />{" "}<Tr s={"Actualidades"} /></Link>
      <PageHeader title={t("Nueva publicación")} />
      <PostForm
        host={appHost()}
        username={creator.username}
        personal={isPersonalMode()}
        linkTargets={await sitePageLinkTargets(creator.id, creator.username, isPersonalMode())}
        post={{ id: null, title: "", slug: "", excerpt: "", body: "", bodyFormat: "MD", imageUrl: null, status: "DRAFT", publishedOn: "", media: null, ctaLabel: "", ctaUrl: "", ctaCode: "" }}
      />
    </div>
  );
}
