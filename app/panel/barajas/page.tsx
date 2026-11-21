import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUp, Layers, Pencil, Plus } from "lucide-react";
import { DeleteButton } from "@/components/ui/delete-button";
import { EmptyState } from "@/components/ui/empty";
import { Flash } from "@/components/ui/flash";
import { requireCreator } from "@/lib/auth";
import { asDeckStatus } from "@/lib/oracle-rules";
import { tenantDb } from "@/lib/tenant";
import { Badge, PageHeader } from "../ui";
import { deleteDeck, moveDeck, toggleDeck } from "./actions";

export const metadata: Metadata = { title: "Barajas" };

/**
 * «Barajas»: sus barajas de oráculo propias. Una baraja publicada se puede elegir en el bloque
 * «Modelo interactivo → Oráculo» de su portada o de una página extra; en borrador no se ve.
 */
export default async function DecksPage({ searchParams }: { searchParams: Promise<{ borrada?: string }> }) {
  const { creator } = await requireCreator();
  const sp = await searchParams;
  const decks = await tenantDb(creator.id).oracleDeck.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { cards: true } }, cards: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], take: 1, select: { imageUrl: true } } },
  });
  return (
    <div>
      <PageHeader
        title="Barajas"
        subtitle="Tus propias barajas de oráculo, con tus imágenes y tus textos. Publica una y elígela en el bloque «Modelo interactivo → Oráculo» de tu página."
        actions={
          <Link href="/panel/barajas/nueva" className="btn btn-primary">
            <Plus className="h-4 w-4" /> Nueva baraja
          </Link>
        }
      />
      {sp.borrada && <Flash ok="Baraja borrada. Donde la usabas sale ahora el Oráculo de la Luna de serie." />}
      {decks.length === 0 ? (
        <EmptyState icon={<Layers className="h-5 w-5" />} title="Crea tu primera baraja" action={<Link href="/panel/barajas/nueva" className="btn btn-primary">Nueva baraja</Link>}>
          Ponle nombre, sube el reverso y añade tus cartas. Mientras no la publiques, en tu web sigue saliendo el Oráculo de la Luna de serie.
        </EmptyState>
      ) : (
        <ul className="space-y-2.5">
          {decks.map((d, i) => {
            const status = asDeckStatus(d.status);
            const thumb = d.backImageUrl ?? d.cards[0]?.imageUrl ?? null;
            return (
              <li key={d.id} className="card flex items-center gap-3 p-3 sm:gap-4">
                <div className="flex flex-col">
                  <form action={moveDeck}>
                    <input type="hidden" name="id" value={d.id} />
                    <input type="hidden" name="dir" value="up" />
                    <button disabled={i === 0} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-20" aria-label={`Subir «${d.name}»`}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                  </form>
                  <form action={moveDeck}>
                    <input type="hidden" name="id" value={d.id} />
                    <input type="hidden" name="dir" value="down" />
                    <button disabled={i === decks.length - 1} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-20" aria-label={`Bajar «${d.name}»`}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
                <div className="relative grid h-16 w-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-sand text-muted">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <Layers className="h-5 w-5" />
                  )}
                </div>
                <Link href={`/panel/barajas/${d.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{d.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {d._count.cards} {d._count.cards === 1 ? "carta" : "cartas"}
                    {d.description ? ` · ${d.description}` : ""}
                  </p>
                  <div className="mt-1.5">
                    <Badge tone={status === "PUBLISHED" ? "success" : "warning"}>{status === "PUBLISHED" ? "Publicada" : "Borrador"}</Badge>
                  </div>
                </Link>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  <form action={toggleDeck} className="hidden sm:block">
                    <input type="hidden" name="id" value={d.id} />
                    <button className="btn btn-ghost btn-sm">{status === "PUBLISHED" ? "Pasar a borrador" : "Publicar"}</button>
                  </form>
                  <Link href={`/panel/barajas/${d.id}`} className="btn btn-outline btn-sm">
                    <Pencil className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Editar</span>
                  </Link>
                  <DeleteButton action={deleteDeck} id={d.id} what={d.name} message={`¿Borrar la baraja «${d.name}» con todas sus cartas? No se puede deshacer.`} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-6 text-xs text-muted">
        Para enseñar una baraja en tu web, añade un bloque «Modelo interactivo» con el modelo «Oráculo» en{" "}
        <Link href="/panel/pagina" className="underline underline-offset-2">Mi página</Link> o en una de tus{" "}
        <Link href="/panel/pagina?ver=paginas" className="underline underline-offset-2">Páginas</Link> y elige la baraja.
      </p>
    </div>
  );
}
