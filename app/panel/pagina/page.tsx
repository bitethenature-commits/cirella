import { requireCreator } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { getPublishedOracleDecks } from "@/lib/oracle-decks";
import { readPageConfig } from "@/lib/page-config";
import { getPublicCreator } from "@/lib/public";
import { sitePageState } from "@/lib/site-pages";
import { sitePageLinkTargets } from "@/lib/site-pages.server";
import { tenantDb } from "@/lib/tenant";
import { TEMPLATE_KEYS, type TemplateKey } from "@/lib/templates";
import { PageEditor } from "./editor";

export default async function EditorPage() {
  const { creator } = await requireCreator();
  const [data, templates, pages, oracleDecks] = await Promise.all([
    getPublicCreator(creator.username, true),
    prisma.template.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    tenantDb(creator.id).sitePage.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, title: true, status: true, draft: true, published: true } }),
    getPublishedOracleDecks(creator.id),
  ]);
  const personal = data?.personal ?? false;
  const linkTargets = await sitePageLinkTargets(creator.id, creator.username, personal);
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
      portal={data?.portal ?? []}
      discountCodes={data?.discountCodes ?? []}
      personal={data?.personal ?? false}
      signupsOnly={data?.signupsOnly ?? false}
      siteOrigin={appUrl()}
      templates={templates.map((t) => t.key).filter((k): k is TemplateKey => (TEMPLATE_KEYS as readonly string[]).includes(k))}
      allowCustom={data?.features.customDesign ?? false}
      allowRemoveBranding={data?.features.removeBranding ?? false}
      platformName={data?.platformName ?? "Cirella"}
      referralCode={creator.referralCode}
      pages={pages.map((p) => ({ id: p.id, title: p.title, state: sitePageState(p) }))}
      linkTargets={linkTargets}
      oracleDecks={oracleDecks}
    />
  );
}
