import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { LunaIcon } from "@/app/area/icons";
import { Flash } from "@/components/ui/flash";
import { requireCreator } from "@/lib/auth";
import { eventLabel } from "@/lib/portal-rules";
import { tenantDb } from "@/lib/tenant";
import { PageHeader } from "../ui";
import { createProduct } from "../productos/actions";
import { CARD_SELECT, ProductCard } from "../productos/product-cards";
import { moonCircleSky, moonSkyFor } from "@/lib/moon-circle-sky";
import { readMoonChoice } from "@/lib/product-texts";
import { circlePackPrice } from "@/lib/circle-pack";
import { saveCirclePack } from "./actions";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Círculos de la Luna" };

/**
 * «Círculos de la Luna»: los círculos de luna nueva, luna llena y eclipse, con su fecha grande como un calendario.
 * Los próximos primero; los que ya pasaron, debajo y apagados. (Los demás talleres en directo van en
 * el Portal de Noticias.)
 */
export default async function CirclesPage({ searchParams }: { searchParams: Promise<{ limite?: string }> }) {
  const t = await getT();
  const { creator } = await requireCreator();
  const sp = await searchParams;
  const circles = await tenantDb(creator.id).product.findMany({
    where: { type: "SESSION", groupSession: true, moonCircle: true },
    orderBy: [{ eventStartAt: "asc" }, { createdAt: "asc" }],
    select: { ...CARD_SELECT, pageTexts: true },
  });
  // Cada círculo con su luna y su signo (la elegida en su estudio o, si no, la de su fecha).
  const skyOf = (c: (typeof circles)[number]) => {
    const m = readMoonChoice(c.pageTexts);
    return m ? moonSkyFor(m.phase, m.sign, m.phrase, c.eventStartAt) : c.eventStartAt ? moonCircleSky(c.eventStartAt) : null;
  };
  const packCents = await circlePackPrice(creator.id);
  const now = Date.now();
  const upcoming = circles.filter((c) => !c.eventStartAt || c.eventStartAt.getTime() >= now);
  const past = circles.filter((c) => c.eventStartAt && c.eventStartAt.getTime() < now).reverse();
  const newCircle = (label: string, cls: string) => (
    <form action={createProduct}>
      <input type="hidden" name="type" value="SESSION" />
      <input type="hidden" name="group" value="1" />
      <input type="hidden" name="moon" value="1" />
      <button className={cls}>
        <Plus className="h-4 w-4" /> <Tr s={label} />
      </button>
    </form>
  );
  const list = (items: typeof circles) => (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((c, i) => (
        <ProductCard
          key={c.id}
          p={c}
          username={creator.username}
          timeZone={creator.timezone}
          showDate
          sky={skyOf(c)}
          first={i === 0}
          last={i === items.length - 1}
          meta={c.eventStartAt ? `${eventLabel(c.eventStartAt, creator.timezone)}${c.capacity ? ` · ${c.capacity} plazas` : ""}` : "Sin fecha todavía"}
        />
      ))}
    </ul>
  );

  return (
    <div>
      <PageHeader title={t("Círculos de la Luna")} subtitle={t("Luna nueva, luna llena y eclipses, en directo por Zoom. En tu web salen los 2 más cercanos.")} actions={newCircle("Nuevo círculo", "btn btn-primary btn-sm")} />
      {sp.limite && <Flash error="Has llegado al límite de productos de tu plan." />}
      {/* El pack del área de la alumna (lib/circle-pack.ts): el próximo de luna nueva y el de luna llena. */}
      <form action={saveCirclePack} className="card mb-8 flex flex-wrap items-end gap-4 p-5">
        <div className="min-w-[14rem] flex-1">
          <p className="font-semibold"><Tr s={"Círculo completo"} /></p>
          <p className="mt-1 text-sm text-muted"><Tr s={"El pack con el próximo círculo de luna nueva y el de luna llena. Sale en el área de tus alumnas y te lo piden por email. Vacío = la suma de los dos."} /></p>
        </div>
        <label className="grid gap-1 text-sm">
          <span className="font-medium"><Tr s={"Precio del pack (€)"} /></span>
          <input name="price" inputMode="decimal" defaultValue={packCents ? (packCents / 100).toLocaleString("es-ES", { maximumFractionDigits: 2 }) : ""} placeholder={t("Ej. 40")} className="input w-32" />
        </label>
        <button className="btn btn-primary btn-sm"><Tr s={"Guardar"} /></button>
      </form>
      {circles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-4 py-12 text-center">
          <LunaIcon className="mx-auto h-10 w-10 text-gold" />
          <p className="mt-3 font-serif text-[1.4rem]"><Tr s={"Todavía no hay círculos"} /></p>
          <p className="mt-1 text-sm text-muted"><Tr s={"Crea el de la próxima luna nueva, luna llena o eclipse."} /></p>
          <div className="mt-4 flex justify-center">{newCircle("Nuevo círculo", "btn btn-primary btn-sm")}</div>
        </div>
      ) : (
        <div className="space-y-10">
          {upcoming.length > 0 && (
            <section aria-labelledby="proximos-t">
              <h2 id="proximos-t" className="mb-4 font-serif text-[1.5rem]"><Tr s={"Próximos"} /></h2>
              {list(upcoming)}
            </section>
          )}
          {past.length > 0 && (
            <section aria-labelledby="pasados-t">
              <h2 id="pasados-t" className="mb-4 font-serif text-[1.5rem] text-muted"><Tr s={"Ya celebrados"} /></h2>
              {list(past)}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
