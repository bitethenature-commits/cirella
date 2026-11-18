import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ExternalLink, FileText, Pencil, Plus, Video } from "lucide-react";
import { OracleCard } from "@/components/creator-page/oracle-card";
import { DeleteButton } from "@/components/ui/delete-button";
import { Flash } from "@/components/ui/flash";
import { deleteMessage } from "@/lib/delete-copy";
import { requireCreator } from "@/lib/auth";
import { readPageConfig } from "@/lib/page-config";
import { planFeatures } from "@/lib/plans";
import { toPublicProduct } from "@/lib/product-view";
import { isPersonalMode, ownerUsername } from "@/lib/site-mode";
import { resolveTheme, themeStyle } from "@/lib/templates";
import { tenantDb } from "@/lib/tenant";
import { Badge, PageHeader } from "../ui";
import { createProduct, deleteProduct, moveProduct } from "../productos/actions";

export const metadata: Metadata = { title: "Sesiones y lecturas" };

/**
 * «Sesiones y lecturas»: las lecturas y las sesiones 1:1, con la misma carta que sale en la web (con los
 * colores de tu web). Toda la carta abre su editor; debajo, si se ve en la web, el orden y Editar. Se
 * piden y se cierran fuera de la web (por email), así que aquí solo se llevan como producto visible.
 */
export default async function SessionsPage({ searchParams }: { searchParams: Promise<{ limite?: string }> }) {
  const { creator } = await requireCreator();
  const sp = await searchParams;
  const products = await tenantDb(creator.id).product.findMany({
    where: { OR: [{ type: "DIGITAL" }, { type: "SESSION", groupSession: false }] },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { orders: { where: { status: "PAID" } } } } },
  });
  const config = readPageConfig(creator.pagePublished ?? creator.pageDraft, creator.displayName);
  const personal = isPersonalMode() && ownerUsername() === creator.username;
  const theme = resolveTheme(config.template, config.theme, personal || planFeatures(creator.plan).customDesign);
  const groups = [
    { key: "DIGITAL", title: "Lecturas", hint: "Las preparas tú y las envías por email.", Icon: FileText, button: "Nueva lectura", items: products.filter((p) => p.type === "DIGITAL") },
    { key: "SESSION", title: "Sesiones 1:1", hint: "Cara a cara por Zoom: el día y la hora los cerráis por email.", Icon: Video, button: "Nueva sesión", items: products.filter((p) => p.type === "SESSION") },
  ];

  return (
    <div>
      <PageHeader
        title="Sesiones y lecturas"
        subtitle="Lo que se ve en tu web, con sus mismas cartas. Se piden con el formulario de solicitud y lo cerráis por email."
        actions={
          <>
            <form action={createProduct}>
              <input type="hidden" name="type" value="DIGITAL" />
              <button className="btn btn-primary btn-sm">
                <Plus className="h-4 w-4" /> Nueva lectura
              </button>
            </form>
            <form action={createProduct}>
              <input type="hidden" name="type" value="SESSION" />
              <button className="btn btn-outline btn-sm">
                <Plus className="h-4 w-4" /> Nueva sesión
              </button>
            </form>
          </>
        }
      />
      {sp.limite && <Flash error="Has llegado al límite de productos de tu plan." />}

      <div className="space-y-10">
        {groups.map((g) => (
          <section key={g.key} aria-labelledby={`g-${g.key}`}>
            <div className="mb-4 flex items-center gap-3">
              <span className="panel-emblem h-10 w-10 shrink-0">
                <g.Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id={`g-${g.key}`} className="font-serif text-[1.5rem] leading-tight">
                  {g.title} <span className="studio-count ml-1 align-middle text-xs">{g.items.length}</span>
                </h2>
                <p className="text-xs text-muted">{g.hint}</p>
              </div>
            </div>
            {g.items.length === 0 ? (
              <form action={createProduct}>
                <input type="hidden" name="type" value={g.key} />
                <button className="w-full rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted transition hover:border-gold hover:text-gold">
                  <Plus className="mx-auto mb-1 h-5 w-5" /> {g.button}
                </button>
              </form>
            ) : (
              // Las cartas de la web, con los colores de tu web.
              <div className="cp !min-h-0 overflow-hidden rounded-[2rem] border border-gold/25 p-4 sm:p-6" style={themeStyle(theme)} data-card={theme.card} data-template={config.template}>
                <ul className="mx-auto grid max-w-[16rem] gap-6 sm:max-w-none sm:grid-cols-2 lg:grid-cols-3">
                  {g.items.map((p, i) => (
                    <li key={p.id} className="flex flex-col">
                      <div className="flex-1">
                        <OracleCard p={toPublicProduct(p, { lessons: 0, timeZone: creator.timezone })} username={creator.username} trackCreatorId={null} editHref={`/panel/productos/${p.id}`} />
                      </div>
                      <div className="mt-3 flex items-center gap-1">
                        {p.status === "PUBLISHED" ? <Badge tone="success">Visible</Badge> : p.status === "ARCHIVED" ? <Badge>Archivada</Badge> : <Badge tone="warning">Borrador</Badge>}
                        <span className="flex-1" />
                        <form action={moveProduct}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="dir" value="up" />
                          <input type="hidden" name="sameType" value="1" />
                          <button disabled={i === 0} className="grid h-8 w-8 place-items-center rounded-lg opacity-80 hover:opacity-100 disabled:opacity-25" aria-label={`Mover antes «${p.title}»`}>
                            <ArrowLeft className="h-3.5 w-3.5" />
                          </button>
                        </form>
                        <form action={moveProduct}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="dir" value="down" />
                          <input type="hidden" name="sameType" value="1" />
                          <button disabled={i === g.items.length - 1} className="grid h-8 w-8 place-items-center rounded-lg opacity-80 hover:opacity-100 disabled:opacity-25" aria-label={`Mover después «${p.title}»`}>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </form>
                        {p.status === "PUBLISHED" && (
                          <Link href={`/${creator.username}/${p.slug}`} target="_blank" className="grid h-8 w-8 place-items-center rounded-lg opacity-80 hover:opacity-100" aria-label={`Ver «${p.title}» en la web`}>
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        )}
                        <Link href={`/panel/productos/${p.id}`} className="cp-btn-ghost !min-h-8 !px-3 !text-[0.8rem]">
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </Link>
                        <DeleteButton action={deleteProduct} id={p.id} what={p.title} message={deleteMessage(`«${p.title}»`, p._count.orders)} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
