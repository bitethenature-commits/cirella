"use client";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  CARDS_MAX,
  GEOMETRY_FIGURES,
  GEOMETRY_LABEL,
  MODEL_KINDS,
  MODEL_LABEL,
  PILLS_MAX,
  hasQuickVersion,
  newCard,
  newPill,
  newTimelineItem,
  TIMELINE_MAX,
  type BlockCard,
  type CardsBlock,
  type GeometryFigure,
  type ModelBlock,
  type ModelKind,
  type MoonCirclesBlock,
  type PageImage,
  type PillLink,
  type PillsBlock,
  type PhotoTextBlock,
  type QuoteBlock,
  type TimelineBlock,
  type TimelineItem,
} from "@/lib/page-blocks";
import { LinkInput, type LinkTarget } from "./link-input";
import { Tr, useT } from "@/lib/i18n/client";

/**
 * Campos de los bloques «Foto y texto», «Tarjetas», «Cita», «Trayectoria», «Modelo interactivo», «Enlaces en
 * burbuja» y «Próximos círculos de la luna» (editor de bloques).
 * Mismo aspecto que los demás: campos de 40 px, flechas para ordenar y «Añadir…» al final.
 * Los cambios llegan como función (bloque de ahora → siguiente): una foto que acaba de subir no pisa
 * lo escrito mientras en otra tarjeta.
 */
type Update<B> = (fn: (b: B) => B) => void;

/** Una baraja propia publicada que se puede elegir en el bloque «Oráculo» (Panel → Barajas). */
export type OracleDeckOption = { id: string | null; name: string };

const toImage = (img: { url: string; width: number; height: number }, prev: PageImage | null): PageImage => ({ src: img.url, alt: prev?.alt ?? "", width: img.width, height: img.height });

/** Mueve el elemento i una posición arriba o abajo. */
function moved<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const a = [...list];
  [a[i], a[j]] = [a[j], a[i]];
  return a;
}

function ItemControls({ i, count, noun, onMove, onRemove }: { i: number; count: number; noun: string; onMove: (dir: -1 | 1) => void; onRemove: () => void }) {
  return (
    <div className="flex shrink-0 items-center">
      <button type="button" disabled={i === 0} onClick={() => onMove(-1)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-20" aria-label={`Subir ${noun}`}><ArrowUp className="h-3.5 w-3.5" /></button>
      <button type="button" disabled={i === count - 1} onClick={() => onMove(1)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-20" aria-label={`Bajar ${noun}`}><ArrowDown className="h-3.5 w-3.5" /></button>
      <button type="button" onClick={onRemove} className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-sand hover:text-rose" aria-label={`Quitar ${noun}`}><X className="h-4 w-4" /></button>
    </div>
  );
}

export function PhotoTextBlockFields({ block: b, bodyMax, linkTargets, onUpdate }: { block: PhotoTextBlock; bodyMax: number; linkTargets: LinkTarget[]; onUpdate: Update<PhotoTextBlock> }) {
  const t = useT();
  const onPatch = (p: Partial<PhotoTextBlock>) => onUpdate((x) => ({ ...x, ...p }));
  return (
    <>
      <ImageUpload value={b.image?.src ?? null} onChange={(url) => !url && onPatch({ image: null })} onUploaded={(img) => onUpdate((x) => ({ ...x, image: toImage(img, x.image) }))} graphic label={t("Subir foto")} />
      {b.image && (
        <input
          className="input h-10 text-sm"
          placeholder={t("Descripción de la foto (p. ej. Cirella en su estudio)")}
          aria-label={t("Descripción de la foto")}
          value={b.image.alt}
          maxLength={300}
          onChange={(e) => {
            const alt = e.target.value;
            onUpdate((x) => (x.image ? { ...x, image: { ...x.image, alt } } : x));
          }}
        />
      )}
      <div className="inline-flex rounded-full bg-sand p-1 text-xs font-semibold" role="radiogroup" aria-label={t("Lado de la foto")}>
        {(["left", "right"] as const).map((side) => (
          <button key={side} type="button" role="radio" aria-checked={b.imageSide === side} onClick={() => onPatch({ imageSide: side })} className={`h-8 rounded-full px-3 ${b.imageSide === side ? "bg-white text-ink shadow-soft" : "text-muted"}`}>
            {side === "left" ? t("Foto a la izquierda") : t("Foto a la derecha")}
          </button>
        ))}
      </div>
      <p className="field-hint"><Tr s={"En el móvil la foto sale siempre encima del texto."} /></p>
      <input className="input h-10 text-sm font-semibold" placeholder={t("Título (p. ej. Mi historia)")} aria-label={t("Título del bloque")} value={b.title} maxLength={80} onChange={(e) => onPatch({ title: e.target.value })} />
      <RichTextEditor
        ariaLabel="Texto del bloque"
        placeholder={t("Texto junto a la foto")}
        value={b.body}
        initialFormat={b.format ?? null}
        onChange={(body) => onPatch({ body, format: "MD" })}
        maxLength={bodyMax}
        tools="basic"
        headings
        preview={false}
        tone="page"
        headingLevel={3}
        rows={5}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <input className="input h-10 text-sm" placeholder={t("Texto del botón (opcional)")} aria-label={t("Texto del botón")} value={b.buttonLabel ?? ""} maxLength={40} onChange={(e) => onPatch({ buttonLabel: e.target.value })} />
        <LinkInput value={b.buttonUrl ?? ""} onChange={(v) => onPatch({ buttonUrl: v })} ariaLabel="Enlace del botón" targets={linkTargets} />
      </div>
    </>
  );
}

export function CardsBlockFields({ block: b, linkTargets, onUpdate }: { block: CardsBlock; linkTargets: LinkTarget[]; onUpdate: Update<CardsBlock> }) {
  const t = useT();
  const onPatch = (p: Partial<CardsBlock>) => onUpdate((x) => ({ ...x, ...p }));
  const setCards = (fn: (cards: BlockCard[]) => BlockCard[]) => onUpdate((x) => ({ ...x, cards: fn(x.cards) }));
  const setCard = (i: number, fn: (c: BlockCard) => Partial<BlockCard>) => setCards((cards) => cards.map((c, n) => (n === i ? { ...c, ...fn(c) } : c)));
  return (
    <>
      <input className="input h-10 text-sm font-semibold" placeholder={t("Título (p. ej. Mis métodos)")} aria-label={t("Título del bloque de tarjetas")} value={b.title} maxLength={80} onChange={(e) => onPatch({ title: e.target.value })} />
      <ul className="space-y-2">
        {b.cards.map((c, i) => (
          <li key={i} className="space-y-2 rounded-xl border border-line p-2.5" data-card-editor>
            <div className="flex items-start gap-2.5">
              <ImageUpload className="w-24 shrink-0" value={c.image?.src ?? null} onChange={(url) => !url && setCard(i, () => ({ image: null }))} onUploaded={(img) => setCard(i, (x) => ({ image: toImage(img, x.image) }))} graphic label={t("Foto")} />
              <div className="min-w-0 flex-1 space-y-2">
                <input className="input h-10 text-sm font-semibold" placeholder={t("Título de la tarjeta")} aria-label={t("Título de la tarjeta")} value={c.title} maxLength={80} onChange={(e) => {
                    const v = e.target.value;
                    setCard(i, () => ({ title: v }));
                  }} />
                <textarea className="input !min-h-0 text-sm" rows={2} placeholder={t("Texto corto (opcional)")} aria-label={t("Texto de la tarjeta")} value={c.text} maxLength={240} onChange={(e) => {
                    const v = e.target.value;
                    setCard(i, () => ({ text: v }));
                  }} />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <div className="min-w-0 flex-1">
                <LinkInput value={c.href ?? ""} onChange={(v) => setCard(i, () => ({ href: v || undefined }))} ariaLabel="Enlace de la tarjeta" placeholder={t("Enlace al tocarla (elige una de tus páginas)")} targets={linkTargets} />
              </div>
              <ItemControls i={i} count={b.cards.length} noun="tarjeta" onMove={(dir) => setCards((cards) => moved(cards, i, dir))} onRemove={() => setCards((cards) => cards.filter((_, n) => n !== i))} />
            </div>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => setCards((cards) => (cards.length >= CARDS_MAX ? cards : [...cards, newCard()]))} disabled={b.cards.length >= CARDS_MAX} className="btn btn-outline btn-sm h-10">
        <Plus className="h-4 w-4" />{" "}<Tr s={"Añadir tarjeta"} /></button>
      <p className="field-hint"><Tr s={"Hasta"} />{" "}{CARDS_MAX}{" "}<Tr s={"tarjetas, en dos columnas en el ordenador. Toda la tarjeta lleva a su enlace."} /></p>
    </>
  );
}

export function QuoteBlockFields({ block: b, onUpdate }: { block: QuoteBlock; onUpdate: Update<QuoteBlock> }) {
  const t = useT();
  const onPatch = (p: Partial<QuoteBlock>) => onUpdate((x) => ({ ...x, ...p }));
  return (
    <>
      <textarea className="input text-sm" rows={3} placeholder={t("La frase que quieres destacar")} aria-label={t("Texto de la cita")} value={b.text} maxLength={600} onChange={(e) => onPatch({ text: e.target.value })} />
      <input className="input h-10 text-sm" placeholder={t("Autora o autor (opcional)")} aria-label={t("Autora de la cita")} value={b.author ?? ""} maxLength={120} onChange={(e) => onPatch({ author: e.target.value || undefined })} />
    </>
  );
}

export function TimelineBlockFields({ block: b, onUpdate }: { block: TimelineBlock; onUpdate: Update<TimelineBlock> }) {
  const t = useT();
  const onPatch = (p: Partial<TimelineBlock>) => onUpdate((x) => ({ ...x, ...p }));
  const setItems = (fn: (items: TimelineItem[]) => TimelineItem[]) => onUpdate((x) => ({ ...x, items: fn(x.items) }));
  const setItem = (i: number, p: Partial<TimelineItem>) => setItems((items) => items.map((x, n) => (n === i ? { ...x, ...p } : x)));
  return (
    <>
      <input className="input h-10 text-sm font-semibold" placeholder={t("Título (p. ej. Mi trayectoria)")} aria-label={t("Título de la trayectoria")} value={b.title} maxLength={80} onChange={(e) => onPatch({ title: e.target.value })} />
      <ol className="space-y-2">
        {b.items.map((it, i) => (
          <li key={i} className="space-y-2 rounded-xl border border-line p-2.5" data-timeline-editor>
            <div className="flex items-center gap-2">
              <input className="input h-10 w-28 shrink-0 text-sm" placeholder="2019" aria-label={t("Fecha o etiqueta del hito")} value={it.label} maxLength={40} onChange={(e) => setItem(i, { label: e.target.value })} />
              <input className="input h-10 min-w-0 flex-1 text-sm font-semibold" placeholder={t("Qué pasó")} aria-label={t("Título del hito")} value={it.title} maxLength={100} onChange={(e) => setItem(i, { title: e.target.value })} />
            </div>
            <div className="flex items-start gap-1">
              <textarea className="input !min-h-0 min-w-0 flex-1 text-sm" rows={2} placeholder={t("Cuéntalo en una o dos frases (opcional)")} aria-label={t("Texto del hito")} value={it.text} maxLength={400} onChange={(e) => setItem(i, { text: e.target.value })} />
              <ItemControls i={i} count={b.items.length} noun="hito" onMove={(dir) => setItems((items) => moved(items, i, dir))} onRemove={() => setItems((items) => items.filter((_, n) => n !== i))} />
            </div>
          </li>
        ))}
      </ol>
      <button type="button" onClick={() => setItems((items) => (items.length >= TIMELINE_MAX ? items : [...items, newTimelineItem()]))} disabled={b.items.length >= TIMELINE_MAX} className="btn btn-outline btn-sm h-10">
        <Plus className="h-4 w-4" />{" "}<Tr s={"Añadir hito"} /></button>
    </>
  );
}

/** «Modelo interactivo»: qué modelo, y un título y una entradilla opcionales. */
export function ModelBlockFields({ block: b, oracleDecks = [], onUpdate }: { block: ModelBlock; oracleDecks?: OracleDeckOption[]; onUpdate: Update<ModelBlock> }) {
  const t = useT();
  const onPatch = (p: Partial<ModelBlock>) => onUpdate((x) => ({ ...x, ...p }));
  const geometry = b.model === "geometry";
  const decks = oracleDecks.filter((d): d is { id: string; name: string } => !!d.id);
  // Elegida pero ya no publicada (o borrada): en la web sale la de serie hasta que la vuelva a publicar.
  const missingDeck = !!b.deck && !decks.some((d) => d.id === b.deck);
  return (
    <>
      <label className="block">
        <span className="field-label"><Tr s={"Modelo"} /></span>
        <select className="input h-10 text-sm" aria-label={t("Modelo interactivo")} value={b.model} onChange={(e) => onPatch({ model: e.target.value as ModelKind })}>
          {MODEL_KINDS.map((m) => (
            <option key={m} value={m}>
              {MODEL_LABEL[m]}
            </option>
          ))}
        </select>
      </label>
      {b.model === "oracle" && (
        <label className="block">
          <span className="field-label"><Tr s={"Baraja"} /></span>
          <select className="input h-10 text-sm" aria-label={t("Baraja del oráculo")} value={b.deck ?? ""} onChange={(e) => onPatch({ deck: e.target.value || undefined })}>
            <option value=""><Tr s={"Oráculo de la Luna (de serie)"} /></option>
            {decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
            {missingDeck && <option value={b.deck}><Tr s={"Una baraja que ya no está publicada"} /></option>}
          </select>
          <span className="field-hint block">
            {missingDeck ? t("Esa baraja ya no está publicada: en tu web sale la de serie. ") : ""}<Tr s={"Tus barajas se crean y se publican en"} />{" "}
            <a href="/panel/barajas" target="_blank" rel="noopener" className="underline underline-offset-2"><Tr s={"Barajas"} /></a>
            .
          </span>
        </label>
      )}
      {geometry && (
        <label className="block">
          <span className="field-label"><Tr s={"Figura"} /></span>
          <select className="input h-10 text-sm" aria-label={t("Figura de la geometría sagrada")} value={b.figure} onChange={(e) => onPatch({ figure: e.target.value as GeometryFigure })}>
            {GEOMETRY_FIGURES.map((f) => (
              <option key={f} value={f}>
                {GEOMETRY_LABEL[f]}
              </option>
            ))}
          </select>
        </label>
      )}
      {geometry ? (
        <textarea
          className="input text-sm"
          rows={2}
          placeholder={t("La frase que va sobre la figura (opcional)")}
          aria-label={t("Frase sobre la figura")}
          value={b.title}
          maxLength={120}
          onChange={(e) => onPatch({ title: e.target.value })}
        />
      ) : (
        <input className="input h-10 text-sm font-semibold" placeholder={t("Título (opcional, p. ej. Explora tu carta)")} aria-label={t("Título del modelo")} value={b.title} maxLength={120} onChange={(e) => onPatch({ title: e.target.value })} />
      )}
      <textarea
        className="input text-sm"
        rows={2}
        placeholder={geometry ? t("Texto pequeño debajo (opcional)") : t("Una frase para invitar a tocarlo (opcional)")}
        aria-label={t("Entradilla del modelo")}
        value={b.intro}
        maxLength={600}
        onChange={(e) => onPatch({ intro: e.target.value })}
      />
      {hasQuickVersion(b.model) && (
        <label className="flex min-h-10 cursor-pointer items-start gap-2.5 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#0E1024]" checked={!!b.quick} onChange={(e) => onPatch({ quick: e.target.checked })} />
          <span>
            <span className="font-semibold"><Tr s={"Versión rápida"} /></span>
            <span className="field-hint block"><Tr s={"Solo el dibujo, con lo justo para tocarlo, y «Calcular con mis datos» debajo. La versión completa está en «Mi energía» del área de alumnas."} /></span>
          </span>
        </label>
      )}
      <p className="field-hint">{geometry ? t("Una figura dibujada a trazo fino detrás de tu frase. Es decorativa.") : t("Tus visitantes lo tocan y se explica solo. En el móvil también se ve entero.")}</p>
    </>
  );
}

/** «Enlaces en burbuja»: de 1 a 4 píldoras (texto y enlace) hacia otras páginas. */
export function PillsBlockFields({ block: b, linkTargets, onUpdate }: { block: PillsBlock; linkTargets: LinkTarget[]; onUpdate: Update<PillsBlock> }) {
  const t = useT();
  const onPatch = (p: Partial<PillsBlock>) => onUpdate((x) => ({ ...x, ...p }));
  const setItems = (fn: (items: PillLink[]) => PillLink[]) => onUpdate((x) => ({ ...x, items: fn(x.items) }));
  const setItem = (i: number, p: Partial<PillLink>) => setItems((items) => items.map((x, n) => (n === i ? { ...x, ...p } : x)));
  return (
    <>
      <input className="input h-10 text-sm font-semibold" placeholder={t("Título (opcional, p. ej. Para seguir)")} aria-label={t("Título del bloque de burbujas")} value={b.title} maxLength={80} onChange={(e) => onPatch({ title: e.target.value })} />
      <ol className="space-y-2">
        {b.items.map((it, i) => (
          <li key={i} className="space-y-2 rounded-xl border border-line p-2.5" data-pill-editor>
            <div className="flex items-center gap-1">
              <input className="input h-10 min-w-0 flex-1 text-sm font-semibold" placeholder={t("Texto (p. ej. La comunidad)")} aria-label={t("Texto de la burbuja")} value={it.label} maxLength={60} onChange={(e) => setItem(i, { label: e.target.value })} />
              <ItemControls i={i} count={b.items.length} noun="burbuja" onMove={(dir) => setItems((items) => moved(items, i, dir))} onRemove={() => setItems((items) => items.filter((_, n) => n !== i))} />
            </div>
            <LinkInput value={it.href} onChange={(v) => setItem(i, { href: v })} ariaLabel="Enlace de la burbuja" placeholder={t("Enlace (elige una de tus páginas)")} targets={linkTargets} />
          </li>
        ))}
      </ol>
      <button type="button" onClick={() => setItems((items) => (items.length >= PILLS_MAX ? items : [...items, newPill()]))} disabled={b.items.length >= PILLS_MAX} className="btn btn-outline btn-sm h-10">
        <Plus className="h-4 w-4" />{" "}<Tr s={"Añadir burbuja"} /></button>
      <p className="field-hint"><Tr s={"De 1 a"} />{" "}{PILLS_MAX}{" "}<Tr s={"burbujas alargadas, centradas. Para llevar a la comunidad, a tus lecturas o a tus cursos (con #astrologia, #human_design… al final del enlace de Cursos, abre ese método)."} /></p>
    </>
  );
}

/** «Próximos círculos de la luna»: solo un título; los círculos se eligen solos. */
export function MoonCirclesBlockFields({ block: b, onUpdate }: { block: MoonCirclesBlock; onUpdate: Update<MoonCirclesBlock> }) {
  const t = useT();
  return (
    <>
      <input
        className="input h-10 text-sm font-semibold"
        placeholder={t("Título (opcional, p. ej. Los próximos círculos)")}
        aria-label={t("Título de los círculos")}
        value={b.title}
        maxLength={80}
        onChange={(e) => {
          const title = e.target.value;
          onUpdate((x) => ({ ...x, title }));
        }}
      />
      <p className="field-hint"><Tr s={"Salen solos los dos próximos círculos de la luna que tengas publicados (los 2 más cercanos: luna nueva, luna llena o eclipse), con su fecha, la hora de España, el precio y «Apuntarme». Cuando pasa una luna, se cambia sin que tengas que tocar nada. Un taller es círculo si lo marcas así en Productos."} /></p>
    </>
  );
}
