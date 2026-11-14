import Link from "next/link";
import { ArrowLeft, BookOpen, CalendarDays, Download, Lock, Moon, UsersRound } from "lucide-react";
import { requireCreator } from "@/lib/auth";
import { canSellType } from "@/lib/plans";
import { hasPaymentProvider } from "@/lib/payments";
import { isPersonalMode } from "@/lib/site-mode";
import { PRODUCT_TYPE_HINT, PRODUCT_TYPE_LABEL, PRODUCT_TYPES } from "@/lib/types";
import { createProduct } from "../actions";
import { PageHeader } from "../../ui";

const ICONS = { DIGITAL: Download, SESSION: CalendarDays, COURSE: BookOpen, MEMBERSHIP: UsersRound } as const;
const EXAMPLES = {
  DIGITAL: "Informe de carta natal en PDF, meditación guiada, guía de rituales",
  SESSION: "Lectura de Human Design 1:1, sesión de tarot, consulta de coaching",
  COURSE: "Programa de 4 semanas, curso de astrología para principiantes",
  MEMBERSHIP: "Círculo lunar mensual, comunidad privada con directos",
} as const;

export default async function NewProductPage() {
  const { creator } = await requireCreator();
  // Web personal sin cobros: nada se cobra aquí (gratis con email o con el enlace a la web donde se
  // paga). Si cobra, se puede vender aquí también.
  const personal = isPersonalMode();
  const sells = hasPaymentProvider();
  return (
    <div className="max-w-3xl">
      <Link href="/panel/productos" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Productos
      </Link>
      <div className="mt-4">
        {personal && sells ? (
          <PageHeader
            title="¿Qué quieres publicar?"
            subtitle="Elige el tipo. Después decides si se paga aquí (tarjeta o PayPal), si se consigue gratis con email o si el botón lleva a otra web (por ejemplo, Calendly)."
          />
        ) : personal ? (
          <PageHeader
            title="¿Qué quieres publicar?"
            subtitle="Elige el tipo. Después decides si se pide con un formulario de solicitud (lo habláis por email), si se consigue gratis con email o si el botón lleva a otra web."
          />
        ) : (
          <PageHeader title="¿Qué quieres vender?" subtitle="Elige el tipo de producto. Podrás editarlo todo después." />
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {PRODUCT_TYPES.map((t) => {
          const Icon = ICONS[t];
          const allowed = canSellType(creator.plan, t);
          return allowed ? (
            <form key={t} action={createProduct}>
              <input type="hidden" name="type" value={t} />
              <button className="card group h-full w-full p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lift">
                <Icon className="h-6 w-6 text-lavender-deep" />
                <p className="display mt-4 text-[1.6rem]">{PRODUCT_TYPE_LABEL[t]}</p>
                <p className="mt-1 text-sm text-muted">{PRODUCT_TYPE_HINT[t]}</p>
                <p className="mt-3 text-xs text-faint">Ej.: {EXAMPLES[t]}</p>
              </button>
            </form>
          ) : (
            <Link key={t} href="/panel/plan" className="card relative h-full p-5 opacity-70 transition hover:opacity-100">
              <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-sand px-2.5 py-1 text-xs font-semibold"><Lock className="h-3 w-3" /> {t === "SESSION" ? "Creator" : "Pro"}</span>
              <Icon className="h-6 w-6 text-muted" />
              <p className="display mt-4 text-[1.6rem]">{PRODUCT_TYPE_LABEL[t]}</p>
              <p className="mt-1 text-sm text-muted">{PRODUCT_TYPE_HINT[t]}</p>
              <p className="mt-3 text-xs font-semibold text-lavender-deep">Mejorar plan →</p>
            </Link>
          );
        })}
        {canSellType(creator.plan, "SESSION") && (personal ? sells : true) && (
          <form action={createProduct}>
            <input type="hidden" name="type" value="SESSION" />
            <input type="hidden" name="group" value="1" />
            <button className="card group h-full w-full p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lift">
              <Moon className="h-6 w-6 text-lavender-deep" />
              <p className="display mt-4 text-[1.6rem]">Taller en directo</p>
              <p className="mt-1 text-sm text-muted">Una sesión en grupo con fecha fija y plazas: cada persona paga su plaza y recibe el enlace de Zoom.</p>
              <p className="mt-3 text-xs text-faint">Ej.: Taller de Luna Nueva por Zoom, 12 plazas</p>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
