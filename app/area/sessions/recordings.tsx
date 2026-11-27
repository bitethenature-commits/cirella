import { Download, FileText, Moon, Plus, Video } from "lucide-react";
import { MediaView } from "@/components/media/media-view";
import type { MyCircleRecording } from "@/lib/circle-recordings";
import { capitalize, formatDate } from "@/lib/tz";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

/** «Grabaciones de los círculos»: el vídeo de cada círculo ya celebrado y su workbook para descargar. */
export async function Recordings({ items }: { items: MyCircleRecording[] }) {
  const t = await getT();
  return (
    <section id="grabaciones" aria-labelledby="grabaciones-t" className="scroll-mt-32" data-block="grabaciones">
      <div className="mb-5 flex items-center gap-3.5">
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#e9cc8e]/10 text-[#f3ecdd] ring-1 ring-gold/40`}>
          <Video className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 id="grabaciones-t" className="display text-[1.9rem] leading-tight"><Tr s={"Círculos anteriores"} /></h2>
          <p className="text-sm text-muted"><Tr s={"Vuelve a ver cada círculo y descarga su workbook en PDF todas las veces que quieras."} /></p>
        </div>
      </div>
      {items.length === 0 && <p className="px-1 text-sm italic text-muted"><Tr s={"Aquí se guardarán los círculos a los que vayas, con su grabación y su workbook."} /></p>}
      <div className="space-y-5">
        {items.map((c, i) => {
          const videos = c.files.filter((f) => f.kind === "VIDEO");
          const others = c.files.filter((f) => f.kind !== "VIDEO");
          return (
            <details key={c.id} open={i === 0} className="card group overflow-hidden border-l-4 border-l-gold">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
                <Moon aria-hidden className="h-5 w-5 shrink-0 text-gold" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{c.title}</span>
                  <span className="block text-sm text-muted">{capitalize(formatDate(c.at, { weekday: "long", day: "numeric", month: "long", year: "numeric" }))}</span>
                </span>
                <Plus aria-hidden className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-45" />
              </summary>
              <div className="space-y-4 px-4 pb-5">
                {c.files.length === 0 && <p className="text-sm italic text-muted"><Tr s={"La grabación y el workbook llegarán aquí en unos días."} /></p>}
                {videos.map((f) => (
                  <MediaView key={f.id} file={f} title={`${c.title} · grabación`} />
                ))}
                {others.length > 0 && (
                  <div className="flex flex-wrap gap-2.5">
                    {others.map((f) => (
                      <a key={f.id} href={`/api/download/${f.id}`} className="inline-flex items-center gap-2 rounded-full border border-gold/50 px-4 py-2 text-sm font-semibold text-gold transition hover:bg-gold/10">
                        {f.kind === "PDF" ? <FileText className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                        {f.kind === "PDF" ? t("Descargar el workbook") : `Descargar «${f.name}»`}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
