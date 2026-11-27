import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, Layers, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { InteractiveModel } from "@/components/models/interactive-model";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { Flash } from "@/components/ui/flash";
import { requireCreator } from "@/lib/auth";
import { toOracleDeckView } from "@/lib/oracle-decks";
import { asDeckStatus, DECK_CARDS_MAX, DECK_CARDS_MIN } from "@/lib/oracle-rules";
import { getPublicCreator } from "@/lib/public";
import { richToPlain } from "@/lib/rich-text";
import { tenantDb } from "@/lib/tenant";
import { resolveTheme, themeStyle } from "@/lib/templates";
import { Badge, PageHeader } from "../../ui";
import { deleteCard, deleteDeck, moveCard, toggleDeck } from "../actions";
import { DeckForm } from "../deck-form";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Baraja" };

const CARD_FLASH: Record<string, string> = { nueva: "Carta añadida.", guardada: "Carta guardada.", borrada: "Carta borrada." };

/**
 * Una baraja: sus datos, sus cartas (añadir, editar, ordenar, borrar), publicarla y una vista previa
 * con el modelo de verdad (tirada de tres, con los colores de su web), también en borrador.
 */
export default async function DeckPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ guardada?: string; faltan?: string; carta?: string; borrador?: string }> }) {
  const t = await getT();
  const { id } = await params;
  const sp = await searchParams;
  const { creator } = await requireCreator();
  const [deck, site] = await Promise.all([
    tenantDb(creator.id).oracleDeck.findFirst({ where: { id }, include: { cards: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } } }),
    getPublicCreator(creator.username, true),
  ]);
  if (!deck) notFound();
  const status = asDeckStatus(deck.status);
  const view = toOracleDeckView(deck);
  const theme = site ? resolveTheme(site.config.template, site.config.theme, site.allowCustom) : null;
  const full = deck.cards.length >= DECK_CARDS_MAX;
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/panel/barajas" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" />{" "}<Tr s={"Barajas"} /></Link>
      <PageHeader
        title={deck.name}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge tone={status === "PUBLISHED" ? "success" : "warning"}>{status === "PUBLISHED" ? t("Publicada") : t("Borrador")}</Badge>
            <span>
              {deck.cards.length} <Tr s={deck.cards.length === 1 ? "carta" : "cartas"} />
            </span>
          </span>
        }
        actions={
          <form action={toggleDeck}>
            <input type="hidden" name="id" value={deck.id} />
            <button className={status === "PUBLISHED" ? "btn btn-outline" : "btn btn-primary"}>{status === "PUBLISHED" ? t("Pasar a borrador") : t("Publicar")}</button>
          </form>
        }
      />
      {sp.guardada && <Flash ok="Baraja creada. Ahora añade sus cartas." />}
      {sp.faltan && <Flash error={`Para publicarla necesita al menos ${DECK_CARDS_MIN} cartas (la tirada de tres).`} />}
      {sp.carta && CARD_FLASH[sp.carta] && <Flash ok={CARD_FLASH[sp.carta] + (sp.borrador ? ` Le quedan menos de ${DECK_CARDS_MIN} cartas: ha vuelto a borrador.` : "")} />}

      <DeckForm deck={{ id: deck.id, name: deck.name, description: deck.description ?? "", backImageUrl: deck.backImageUrl, backFrame: deck.backFrame }} />

      <section className="mt-8" aria-labelledby="cartas">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="cartas" className="text-lg font-semibold"><Tr s={"Cartas"} /></h2>
          {!full && (
            <Link href={`/panel/barajas/${deck.id}/cartas/nueva`} className="btn btn-outline btn-sm">
              <Plus className="h-4 w-4" />{" "}<Tr s={"Añadir carta"} /></Link>
          )}
        </div>
        {deck.cards.length === 0 ? (
          <div className="card p-6 text-center text-sm text-muted"><Tr s={"Todavía no tiene cartas."} />{" "}
            <Link href={`/panel/barajas/${deck.id}/cartas/nueva`} className="font-medium text-ink underline underline-offset-2"><Tr s={"Añade la primera"} /></Link>
            .
          </div>
        ) : (
          <ol className="space-y-2">
            {deck.cards.map((c, i) => (
              <li key={c.id} className="card flex items-center gap-3 p-2.5 sm:gap-4">
                <div className="flex flex-col">
                  <form action={moveCard}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="deckId" value={deck.id} />
                    <input type="hidden" name="dir" value="up" />
                    <button disabled={i === 0} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-20" aria-label={`Subir «${c.name}»`}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                  </form>
                  <form action={moveCard}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="deckId" value={deck.id} />
                    <input type="hidden" name="dir" value="down" />
                    <button disabled={i === deck.cards.length - 1} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-20" aria-label={`Bajar «${c.name}»`}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
                <div className="relative grid h-14 w-9 shrink-0 place-items-center overflow-hidden rounded-md bg-sand text-[0.7rem] font-semibold text-muted">
                  {c.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                  ) : (
                    i + 1
                  )}
                </div>
                <Link href={`/panel/barajas/${deck.id}/cartas/${c.id}`} className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-semibold">
                    {c.name}
                    {c.reversible && <RotateCcw className="h-3.5 w-3.5 shrink-0 text-muted" aria-label={t("Puede salir invertida")} />}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">{[c.keyword, richToPlain(c.message, "MD").replace(/\s+/g, " ").trim()].filter(Boolean).join(" · ") || t("Sin mensaje")}</p>
                </Link>
                <div className="flex shrink-0 items-center gap-1">
                  <Link href={`/panel/barajas/${deck.id}/cartas/${c.id}`} className="btn btn-ghost btn-sm" aria-label={`Editar «${c.name}»`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>
                  <ConfirmForm action={deleteCard} message={`¿Borrar la carta «${c.name}»? No se puede deshacer.`}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className="btn btn-ghost btn-sm text-rose" aria-label={`Borrar «${c.name}»`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </ConfirmForm>
                </div>
              </li>
            ))}
          </ol>
        )}
        {full && <p className="mt-2 text-xs text-muted"><Tr s={"Ha llegado al máximo de"} />{" "}{DECK_CARDS_MAX}{" "}<Tr s={"cartas."} /></p>}
      </section>

      <section className="mt-8" aria-labelledby="vista-previa">
        <h2 id="vista-previa" className="mb-1 text-lg font-semibold"><Tr s={"Vista previa"} /></h2>
        <p className="mb-3 text-xs text-muted"><Tr s={"Así se ve en tu web, con sus colores. Baraja y saca tres cartas"} />{status === "DRAFT" ? t(" (en borrador solo la ves tú, aquí)") : ""}.</p>
        {deck.cards.length === 0 ? (
          <div className="card grid place-items-center gap-2 p-8 text-sm text-muted">
            <Layers className="h-5 w-5" /><Tr s={"Añade cartas para probarla."} /></div>
        ) : (
          <div className="cp overflow-hidden rounded-2xl p-4 sm:p-6" style={theme ? themeStyle(theme) : undefined} data-card={theme?.card} data-template={site?.config.template}>
            <InteractiveModel model="oracle" deck={view} />
          </div>
        )}
      </section>

      <ConfirmForm action={deleteDeck} message={t("¿Borrar esta baraja y todas sus cartas? Donde la usabas saldrá el Oráculo de la Luna de serie. No se puede deshacer.")} className="mt-10 border-t border-line pt-6">
        <input type="hidden" name="id" value={deck.id} />
        <button className="btn btn-ghost btn-sm text-rose">
          <Trash2 className="h-4 w-4" />{" "}<Tr s={"Borrar la baraja"} /></button>
      </ConfirmForm>
    </div>
  );
}
