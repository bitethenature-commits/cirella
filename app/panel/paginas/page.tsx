import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUp, ExternalLink, FileText, Pencil, Plus } from "lucide-react";
import { barePage, hiddenProductSlugs, SitePageView } from "@/components/creator-page/site-page-view";
import { systemIcon } from "@/components/creator-page/system-icon";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/empty";
import { Flash } from "@/components/ui/flash";
import { requireCreator } from "@/lib/auth";
import { appHost, appUrl } from "@/lib/env";
import { nextMoonCircles } from "@/lib/moon-circles";
import { oracleDecksForBlocks } from "@/lib/oracle-decks";
import { getPublicCreator } from "@/lib/public";
import { isPersonalMode } from "@/lib/site-mode";
import { GIFTS_SLUG, ONE_TO_ONE_SLUG, readSitePageContent, SITE_PAGE_STATE_LABEL, sitePagePath, sitePageState } from "@/lib/site-pages";
import { ensureGiftsPage, ensureOneToOnePage } from "@/lib/site-pages.server";
import { tenantDb } from "@/lib/tenant";
import { Badge, PageHeader } from "../ui";
import { ModelThumb } from "../modelos/model-thumb";
import { moveSitePageAction } from "./actions";

export const metadata: Metadata = { title: "Páginas" };

const TONE = { DRAFT: "warning", PUBLISHED: "success", CHANGES: "neutral" } as const;

/**
 * Páginas extra: lista con su icono (el mismo que sale en la web), una foto en pequeño de cómo se ve (el
 * borrador, con el diseño de la web), su dirección, su estado y el orden en el que salen en el pie.
 */
export default async function SitePagesPage({ searchParams }: { searchParams: Promise<{ borrada?: string }> }) {
  const { creator } = await requireCreator();
  const sp = await searchParams;
  const personal = isPersonalMode();
  // La 1:1 sale siempre aquí (la primera vez se crea con lo que enseña la web).
  await ensureOneToOnePage(creator.id);
  await ensureGiftsPage(creator.id);
  const [pages, data] = await Promise.all([
    tenantDb(creator.id).sitePage.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, slug: true, status: true, draft: true, published: true, showInNav: true },
    }),
    getPublicCreator(creator.username, true),
  ]);
  // Lo que hace falta para dibujar cada página en pequeño.
  const contents = pages.map((p) => readSitePageContent(p.draft, p.title));
  const decks = await Promise.all(contents.map((c) => oracleDecksForBlocks(creator.id, c.blocks)));
  const moonCircles = data ? nextMoonCircles(data.products) : [];
  const hidden = data ? hiddenProductSlugs(data.products, data.signupsOnly) : new Set<string>();

  return (
    <div>
      <PageHeader
        title="Páginas"
        subtitle="Páginas aparte de tu portada: «Sobre mí», «Preguntas frecuentes»… Cada una con su propia dirección y en el pie de tu web."
        actions={
          <Link href="/panel/paginas/nueva" className="btn btn-primary">
            <Plus className="h-4 w-4" /> Nueva página
          </Link>
        }
      />
      {sp.borrada && <Flash ok="Página borrada." />}

      {pages.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title="Crea tu primera página"
          action={<Link href="/panel/paginas/nueva" className="btn btn-primary">Nueva página</Link>}
        >
          Cuenta tu historia en «Sobre mí» o resuelve dudas en «Preguntas frecuentes», con textos, imágenes, galerías y vídeos.
        </EmptyState>
      ) : (
        <ul className="space-y-2.5">
          {pages.map((p, i) => {
            const state = sitePageState(p);
            const path = sitePagePath(creator.username, p.slug, personal);
            const Icon = systemIcon(p.title);
            return (
              <li key={p.id} className="card flex items-center gap-2 p-3 sm:gap-3">
                <div className="flex shrink-0 flex-col">
                  {(["up", "down"] as const).map((dir) => (
                    <form key={dir} action={moveSitePageAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="dir" value={dir} />
                      <button
                        disabled={(dir === "up" && i === 0) || (dir === "down" && i === pages.length - 1)}
                        className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-20"
                        aria-label={dir === "up" ? `Subir «${p.title}»` : `Bajar «${p.title}»`}
                      >
                        {dir === "up" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                      </button>
                    </form>
                  ))}
                </div>
                {data && (
                  <Link href={`/panel/paginas/${p.id}`} className="hidden shrink-0 sm:block" aria-label={`Editar «${p.title}»`}>
                    <ModelThumb>
                      <SitePageView
                        username={creator.username}
                        config={data.config}
                        content={contents[i]}
                        allowCustom={data.allowCustom}
                        personal={data.personal}
                        signupsOnly={data.signupsOnly}
                        hiddenSlugs={hidden}
                        siteOrigin={appUrl()}
                        pages={data.pages}
                        currentPath={path}
                        back={false}
                        oracleDecks={decks[i]}
                        moonCircles={moonCircles}
                        bare={barePage(p.slug)}
                      />
                    </ModelThumb>
                  </Link>
                )}
                <Link href={`/panel/paginas/${p.id}`} className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-center gap-2 font-semibold">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#0d0c22] text-gold">
                      <Icon className="h-5 w-5" strokeWidth={1.3} aria-hidden />
                    </span>
                    <span className="truncate">{p.slug === ONE_TO_ONE_SLUG ? `1:1 · ${p.title}` : p.title}</span>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">{appHost()}{path}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge tone={TONE[state]}>{SITE_PAGE_STATE_LABEL[state]}</Badge>
                    {state !== "DRAFT" && !p.showInNav && p.slug !== ONE_TO_ONE_SLUG && p.slug !== GIFTS_SLUG && <Badge>Fuera del pie</Badge>}
                    {(p.slug === ONE_TO_ONE_SLUG || p.slug === GIFTS_SLUG) && state === "DRAFT" && <Badge>En la web sale la de siempre hasta que la publiques</Badge>}
                  </div>
                </Link>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  {state !== "DRAFT" && (
                    <>
                      <CopyButton text={`${appUrl()}${path}`} className="btn btn-ghost btn-sm hidden sm:inline-flex" />
                      <Link href={path} target="_blank" className="btn btn-ghost btn-sm" aria-label={`Ver «${p.title}» en tu web`}>
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </>
                  )}
                  <Link href={`/panel/paginas/${p.id}`} className="btn btn-outline btn-sm">
                    <Pencil className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Editar</span>
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-6 text-xs text-muted">
        Las páginas publicadas salen en el pie de tu web en este orden. Para añadir un botón en tu portada, abre la página y ve a «Ajustes».
      </p>
    </div>
  );
}
