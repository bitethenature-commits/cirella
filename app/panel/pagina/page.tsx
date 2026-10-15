import { requireCreator } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readPageConfig } from "@/lib/page-config";
import { getPublicCreator } from "@/lib/public";
import { TEMPLATE_KEYS, type TemplateKey } from "@/lib/templates";
import { PageEditor } from "./editor";

export default async function EditorPage() {
  const { creator } = await requireCreator();
  const [data, templates] = await Promise.all([
    getPublicCreator(creator.username, true),
    prisma.template.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const draft = readPageConfig(creator.pageDraft, creator.displayName);
  const published = creator.pagePublished ? readPageConfig(creator.pagePublished, creator.displayName) : null;
  return (
    <PageEditor
      initial={draft}
      publishedJson={published ? JSON.stringify(published) : ""}
      creatorId={creator.id}
      username={creator.username}
      products={data?.products ?? []}
      posts={data?.posts ?? []}
      postCount={data?.postCount ?? 0}
      discountCodes={data?.discountCodes ?? []}
      personal={data?.personal ?? false}
      templates={templates.map((t) => t.key).filter((k): k is TemplateKey => (TEMPLATE_KEYS as readonly string[]).includes(k))}
      allowCustom={data?.features.customDesign ?? false}
      allowRemoveBranding={data?.features.removeBranding ?? false}
      platformName={data?.platformName ?? "Cirella"}
      referralCode={creator.referralCode}
    />
  );
}
