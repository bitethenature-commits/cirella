import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { PortalSection } from "@/components/creator-page/portal-section";
import { TrackOnMount } from "@/components/creator-page/tracking";
import { creatorLegalHref } from "@/lib/legal";
import { sectionTitle } from "@/lib/page-config";
import { sectionPageData } from "../section-data";
import { PortalNoteIcon } from "@/components/creator-page/home-rows";

type Params = { username: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { username } = await params;
  const data = await sectionPageData(username);
  if (!data || !data.personal) return { title: "Página no encontrada" };
  const title = `${sectionTitle(data.config, "portal")} · ${data.config.displayName}`;
  const description = `Vídeos, audios, directos y avisos para quien está suscrita a la newsletter de ${data.config.displayName}.`;
  return { title, description, alternates: { canonical: data.url("portal") }, openGraph: { title, description, url: data.url("portal"), siteName: data.siteName } };
}

/**
 * «Portal de Noticias»: todo lo que la dueña publica gratis para sus suscriptoras con cuenta. La página
 * llega bloqueada (como la portada) y el navegador pide a /api/portal, con su sesión, lo desbloqueado.
 * Solo en la web personal (la newsletter es de la dueña).
 */
export default async function PortalPage({ params }: { params: Promise<Params> }) {
  const { username } = await params;
  const data = await sectionPageData(username);
  if (!data || !data.personal) notFound();
  const { creator, config } = data;
  return (
    <CreatorShell username={creator.username} config={config} allowCustom={data.allowCustom} personal={data.personal} signupsOnly={data.signupsOnly} pages={data.pages}>
      <main className="mx-auto max-w-3xl px-4 pb-12 pt-8 sm:pt-12">
        <div className="flex items-center gap-4">
          <span className="cp-emblem grid h-14 w-14 shrink-0 place-items-center rounded-full" aria-hidden>
            <PortalNoteIcon />
          </span>
          <div>
            <p className="cp-eyebrow">Para quien está suscrita a mi newsletter</p>
            <h1 className="cp-display mt-1 text-[2.6rem] leading-tight">{sectionTitle(config, "portal")}</h1>
          </div>
        </div>
        {data.portal.length === 0 ? (
          <p className="cp-muted mt-6">Pronto habrá aquí vídeos, audios y avisos para quien está suscrita a mi newsletter.</p>
        ) : (
          <div className="mt-8">
            <PortalSection
              items={data.portal}
              title={sectionTitle(config, "portal")}
              creatorName={config.displayName}
              privacyHref={creatorLegalHref(creator.username, "privacidad")}
              portalHref={data.path("portal")}
              username={creator.username}
              preview={false}
              home
              timeZone={creator.timezone}
              fallbackImage={config.coverUrl ?? config.avatarUrl ?? null}
            />
          </div>
        )}
      </main>
      <TrackOnMount creatorId={creator.id} type="PAGE_VIEW" />
    </CreatorShell>
  );
}
