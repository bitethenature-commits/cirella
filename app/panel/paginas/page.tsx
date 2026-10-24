import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUp, ExternalLink, FileText, Pencil, Plus } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/empty";
import { Flash } from "@/components/ui/flash";
import { requireCreator } from "@/lib/auth";
import { appHost, appUrl } from "@/lib/env";
import { isPersonalMode } from "@/lib/site-mode";
import { SITE_PAGE_STATE_LABEL, sitePagePath, sitePageState } from "@/lib/site-pages";
import { tenantDb } from "@/lib/tenant";
import { Badge, PageHeader } from "../ui";
import { moveSitePageAction } from "./actions";

export const metadata: Metadata = { title: "Páginas" };

const TONE = { DRAFT: "warning", PUBLISHED: "success", CHANGES: "neutral" } as const;

/** Páginas extra: lista con su dirección, su estado y el orden en el que salen en el pie de la web. */
export default async function SitePagesPage({ searchParams }: { searchParams: Promise<{ borrada?: string }> }) {
  const { creator } = await requireCreator();
  const sp = await searchParams;
  const personal = isPersonalMode();
  const pages = await tenantDb(creator.id).sitePage.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, slug: true, status: true, draft: true, published: true, showInNav: true },
  });

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
                <Link href={`/panel/paginas/${p.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">{appHost()}{path}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge tone={TONE[state]}>{SITE_PAGE_STATE_LABEL[state]}</Badge>
                    {state !== "DRAFT" && !p.showInNav && <Badge>Fuera del pie</Badge>}
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
