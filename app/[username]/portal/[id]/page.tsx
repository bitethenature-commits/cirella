import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { PortalSection } from "@/components/creator-page/portal-section";
import { TrackOnMount } from "@/components/creator-page/tracking";
import { creatorLegalHref } from "@/lib/legal";
import { sectionTitle } from "@/lib/page-config";
import { homeFoldPath, portalItemPath } from "@/lib/site-sections";
import { appUrl } from "@/lib/env";
import { sectionPageData } from "../../section-data";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

type Params = { username: string; id: string };

async function load(username: string, id: string) {
  const data = await sectionPageData(username);
  if (!data || !data.personal) return null;
  const item = data.portal.find((i) => i.id === id);
  return item ? { data, item } : null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { username, id } = await params;
  const found = await load(username, id);
  if (!found) return { title: (await getT())("Página no encontrada") };
  const { data, item } = found;
  const title = `${item.title} · ${data.config.displayName}`;
  const description = item.summary || `Para quien está suscrita a la newsletter de ${data.config.displayName}.`;
  const url = `${appUrl()}${portalItemPath(data.creator.username, item.id, true)}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: data.siteName, ...(item.coverUrl ? { images: [item.coverUrl] } : {}) },
  };
}

/**
 * Una noticia del Portal de Noticias, en su página (el portal no tiene página: vive en el desplegable de la
 * portada). Llega bloqueada como la portada y el navegador pide a /api/portal, con su sesión, el contenido;
 * si no está suscrita, debajo sale el formulario de la newsletter, que al confirmar vuelve aquí.
 * Solo en la web personal (la newsletter es de la dueña).
 */
export default async function PortalItemPage({ params }: { params: Promise<Params> }) {
  const { username, id } = await params;
  const found = await load(username, id);
  if (!found) notFound();
  const { data, item } = found;
  const { creator, config } = data;
  const portalTitle = sectionTitle(config, "portal");
  return (
    <CreatorShell page="portal" username={creator.username} config={config} allowCustom={data.allowCustom} personal={data.personal} signupsOnly={data.signupsOnly} pages={data.pages}>
      <main className="mx-auto max-w-3xl px-4 pb-12 pt-8 sm:pt-12">
        <Link href={homeFoldPath(creator.username, "portal", true)} className="cp-muted inline-flex items-center gap-1.5 text-sm hover:underline">
          <ArrowLeft className="h-4 w-4" /> <Tr s={portalTitle} />
        </Link>
        <h1 className="sr-only">{item.title}</h1>
        <div className="mt-5">
          <PortalSection
            items={[item]}
            title={portalTitle}
            creatorName={config.displayName}
            privacyHref={creatorLegalHref(creator.username, "privacidad")}
            portalHref={data.path("portal")}
            username={creator.username}
            preview={false}
            single
            fallbackImage={config.coverUrl ?? config.avatarUrl ?? null}
          />
        </div>
      </main>
      <TrackOnMount creatorId={creator.id} type="PAGE_VIEW" />
    </CreatorShell>
  );
}
