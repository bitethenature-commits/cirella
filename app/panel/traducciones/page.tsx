import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Languages, Loader2, RefreshCw } from "lucide-react";
import { Flash } from "@/components/ui/flash";
import { requireCreator } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { collectCreatorTexts, hashText, LANGS, type Lang } from "@/lib/i18n/content";
import { translationEnabled } from "@/lib/i18n/translate-ai";
import { Badge, PageHeader } from "../ui";
import { retranslateAction, saveTranslationAction, translateMissingAction } from "./actions";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Traducciones" };

const LANG_NAME: Record<Lang, string> = { de: "Alemán", en: "Inglés", es: "Español" };

const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "pendientes", label: "Por traducir" },
  { key: "errores", label: "Con error" },
  { key: "corregidos", label: "Corregidos a mano" },
] as const;
type Filter = (typeof FILTERS)[number]["key"];

const FLASH: Record<string, string> = {
  traduciendo: "Traduciendo en segundo plano. Vuelve a abrir esta página en un rato para ver las traducciones.",
  guardado: "Corrección guardada: ya sale así en la web.",
  "sin-cambios": "No habías cambiado nada.",
  retraduciendo: "Traduciéndolo de nuevo. En un momento lo tienes.",
};

/** Alto del cuadro según lo largo del texto. */
const rowsFor = (s: string) => Math.min(14, Math.max(2, Math.ceil(s.length / 70) + (s.match(/\n/g)?.length ?? 0)));

/**
 * «Traducciones» (junto a Actualidades y Ofertas): todos sus textos de la web pública en alemán, inglés y español,
 * agrupados por dónde salen. Lo traduce la IA sola al guardar (lib/i18n/content.ts); aquí se corrige. El original
 * (lo que ella escribió, en el idioma que sea) no se cambia aquí: se cambia donde lo escribió y se traduce de nuevo.
 */
export default async function TranslationsPage({ searchParams }: { searchParams: Promise<{ f?: string; ok?: string; error?: string }> }) {
  const { creator } = await requireCreator();
  const sp = await searchParams;
  const filter: Filter = FILTERS.some((f) => f.key === sp.f) ? (sp.f as Filter) : "todos";
  const enabled = translationEnabled();

  const [texts, rows] = await Promise.all([
    collectCreatorTexts(creator.id),
    prisma.textTranslation.findMany({ where: { creatorId: creator.id } }),
  ]);
  const byHash = new Map(rows.map((r) => [r.hash, r]));

  // Cada texto una vez, en el primer sitio donde sale.
  type Item = { text: string; place: string; row: (typeof rows)[number] | null };
  const seen = new Set<string>();
  const items: Item[] = [];
  for (const t of texts) {
    const h = hashText(t.text);
    if (seen.has(h)) continue;
    seen.add(h);
    items.push({ text: t.text, place: t.place, row: byHash.get(h) ?? null });
  }
  const pending = (i: Item) => !i.row || i.row.status === "PENDING" || i.row.status === "WORKING" || (i.row.status === "FAILED" && !i.row.lang);
  const failed = (i: Item) => i.row?.status === "FAILED";
  const manual = (i: Item) => !!i.row?.manual.length;
  const counts = { todos: items.length, pendientes: items.filter(pending).length, errores: items.filter(failed).length, corregidos: items.filter(manual).length };
  const shown = items.filter((i) => (filter === "pendientes" ? pending(i) : filter === "errores" ? failed(i) : filter === "corregidos" ? manual(i) : true));

  const groups = new Map<string, Item[]>();
  for (const i of shown) groups.set(i.place, [...(groups.get(i.place) ?? []), i]);
  const flash = sp.ok ? FLASH[sp.ok] : null;

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Traducciones"
        actions={
          <form action={translateMissingAction}>
            <button className="btn btn-primary btn-sm" disabled={!enabled}>
              <Languages className="h-4 w-4" />{" "}<Tr s={"Traducir lo que falta"} /></button>
          </form>
        }
      />
      <Flash ok={flash} error={sp.error ? "Ese texto ya no existe." : null} />

      {!enabled && (
        <div role="alert" className="mb-6 flex items-start gap-3 rounded-2xl border border-gold/50 bg-gold/10 px-4 py-3.5 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
          <p>
            <strong><Tr s={"Falta la clave de Claude."} /></strong>{" "}<Tr s={"Para traducir hace falta poner"} />{" "}<code>ANTHROPIC_API_KEY</code>{" "}<Tr s={"en el archivo"} />{" "}<code>.env</code>{" "}<Tr s={"del servidor y reiniciarlo. Mientras tanto, en alemán e inglés tus textos salen tal como los escribiste."} /></p>
        </div>
      )}

      <p className="mb-5 text-sm text-muted"><Tr s={"Escribe tus textos en el idioma que quieras: la IA saca los otros dos al guardar. Aquí puedes corregirlos. Lo que corriges queda fijo y la IA no lo vuelve a cambiar, salvo que cambies el texto original. Si un texto lleva formato (negritas, enlaces, listas), deja sus marcas como están."} /></p>

      <nav aria-label="Filtrar" className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "todos" ? "/panel/traducciones" : `/panel/traducciones?f=${f.key}`}
            aria-current={filter === f.key ? "page" : undefined}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm transition ${
              filter === f.key ? "border-gold bg-gold/15 font-semibold" : "border-line hover:border-gold/60"
            }`}
          >
            <Tr s={f.label} /> <span className="text-muted">{counts[f.key]}</span>
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
          {items.length === 0 ? <Tr s={"Aún no hay textos tuyos en la web."} /> : <Tr s={"No hay nada aquí."} />}
        </p>
      ) : (
        <div className="space-y-4">
          {[...groups].map(([place, list]) => (
            <details key={place} className="card group" open={groups.size <= 3}>
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold">
                <span className="min-w-0 truncate"><Tr s={place} /></span>
                <span className="shrink-0 text-sm font-normal text-muted">
                  {list.length} <Tr s={list.length === 1 ? "texto" : "textos"} />
                </span>
              </summary>
              <ul className="divide-y divide-line border-t border-line">
                {list.map((i) => (
                  <TextRow key={i.row?.id ?? hashText(i.text)} item={i} pending={pending(i)} enabled={enabled} />
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

async function TextRow({
  item,
  pending,
  enabled,
}: {
  item: { text: string; row: { id: string; lang: string | null; de: string | null; en: string | null; es: string | null; manual: string[]; status: string; error: string | null } | null };
  pending: boolean;
  enabled: boolean;
}) {
  const t = await getT();
  const { row, text } = item;
  const lang = row?.lang as Lang | null | undefined;
  return (
    <li id={row ? `t-${row.id}` : undefined} className="scroll-mt-24 px-4 py-4">
      {/* El original, tal cual lo escribió */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone="dark"><Tr s={"Original"} />{lang ? ` · ${LANG_NAME[lang]}` : ""}</Badge>
        {row?.status === "FAILED" && <Badge tone="danger"><Tr s={"No se pudo traducir"} /></Badge>}
        {pending && row?.status !== "FAILED" && (
          <span className="inline-flex items-center gap-1 text-xs text-muted">
            <Loader2 className="h-3.5 w-3.5" aria-hidden /> {row ? t("Por traducir") : t("Aún sin apuntar: pulsa «Traducir lo que falta»")}
          </span>
        )}
      </div>
      <p className="mb-3 whitespace-pre-line break-words rounded-xl bg-sand/40 px-3 py-2 text-sm"><Tr s={text} /></p>
      {row?.status === "FAILED" && row.error && <p className="mb-3 text-xs text-[#9a3a2e]"><Tr s={row.error} /></p>}

      {row && lang && (
        <form action={saveTranslationAction}>
          <input type="hidden" name="id" value={row.id} />
          <div className="grid gap-3 md:grid-cols-2">
            {LANGS.filter((l) => l !== lang).map((l) => {
              const value = row[l] ?? "";
              return (
                <label key={l} className="block text-sm">
                  <span className="mb-1 flex items-center gap-2 font-medium">
                    <Tr s={LANG_NAME[l]} />
                    {row.manual.includes(l) && <Badge tone="success"><Tr s={"Corregido a mano"} /></Badge>}
                  </span>
                  <textarea name={l} defaultValue={value} rows={rowsFor(value || text)} lang={l} className="input w-full resize-y text-sm" />
                </label>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <button formAction={retranslateAction} className="btn btn-outline btn-sm" disabled={!enabled} title={t("Olvida tus correcciones y la IA lo traduce otra vez")}>
              <RefreshCw className="h-4 w-4" />{" "}<Tr s={"Volver a traducir"} /></button>
            <button className="btn btn-primary btn-sm"><Tr s={"Guardar"} /></button>
          </div>
        </form>
      )}
      {row && !lang && row.status === "FAILED" && (
        <form action={retranslateAction} className="flex justify-end">
          <input type="hidden" name="id" value={row.id} />
          <button className="btn btn-outline btn-sm" disabled={!enabled}>
            <RefreshCw className="h-4 w-4" />{" "}<Tr s={"Reintentar"} /></button>
        </form>
      )}
    </li>
  );
}
