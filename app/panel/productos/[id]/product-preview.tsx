"use client";
import { useEffect } from "react";
import { ArrowLeft, Eye } from "lucide-react";
import { CourseGroups } from "@/components/creator-page/course-groups";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { OfferCard, ProductCard, SectionHeading } from "@/components/creator-page/creator-page-view";
import { ProductPageView, type ProductPageProduct } from "@/components/creator-page/product-page-view";
import type { SiteNavPage } from "@/components/creator-page/site-nav";
import { PhoneFrame } from "@/components/panel/phone-frame";
import { PreviewFrame } from "@/components/panel/preview-frame";
import { asAccessMode } from "@/lib/access-mode";
import { groupCourses } from "@/lib/course-categories";
import type { PageConfig } from "@/lib/page-config";
import { toPublicProduct } from "@/lib/product-view";
import { resolveTheme, themeStyle, themeAttrs } from "@/lib/templates";
import { TemplateDecor } from "@/components/template-decor";

type Seller = { line: string; name: string; named: boolean };

/**
 * Todo lo que la vista previa necesita y no está en el formulario (lo calcula el servidor una vez,
 * app/panel/productos/[id]/page.tsx): el diseño de su página, quién vende, lo que ya tiene el producto
 * (lecciones, archivos, publicaciones…). Mientras se escribe no se pide nada más.
 */
export type ProductPreviewContext = {
  username: string;
  timeZone: string;
  config: Pick<PageConfig, "displayName" | "avatarUrl" | "template" | "theme" | "newsletter">;
  allowCustom: boolean;
  personal: boolean;
  signupsOnly: boolean;
  pages: SiteNavPage[];
  /** Título de la sección de la portada donde sale el producto y el de «Ofertas». */
  sectionTitle: string;
  offersTitle: string;
  testimonials: { id: string; quote: string; author: string; role?: string | null }[];
  /** Quién vende (la creadora, con su nombre legal si lo tiene). */
  seller: Seller;
  /** Plazas ya ocupadas de un taller. */
  seatsTaken: number;
  claim: { legalComplete: boolean; responsible: string; processorName: string | null; demo: boolean };
  /** Lo que se gestiona fuera del formulario (se guarda al momento y llega con la página). */
  files: ProductPageProduct["files"];
  modules: ProductPageProduct["modules"];
  includes: ProductPageProduct["includes"];
  posts: ProductPageProduct["posts"];
};

export type PreviewTab = "card" | "page";

const TABS: { key: PreviewTab; label: string }[] = [
  { key: "card", label: "Tarjeta" },
  { key: "page", label: "Página" },
];

export function PreviewTabs({ tab, onChange, className = "" }: { tab: PreviewTab; onChange: (t: PreviewTab) => void; className?: string }) {
  return (
    <div role="tablist" aria-label="Qué ver" className={`inline-flex rounded-full bg-sand p-1 text-sm ${className}`}>
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={tab === t.key}
          onClick={() => onChange(t.key)}
          className={`h-8 rounded-full px-4 font-medium transition ${tab === t.key ? "bg-white shadow-soft" : "text-muted"}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Avisos de por qué lo que se ve aún no está en la web (borrador, oculto en la web sin cobros…). */
function previewNotes(ctx: ProductPreviewContext, product: ProductPageProduct, status: string): string[] {
  const notes: string[] = [];
  if (status !== "PUBLISHED") notes.push("Borrador: así se verá cuando lo publiques.");
  if (ctx.signupsOnly && asAccessMode(product.accessMode) === "PAID") notes.push("Tu web no cobra: no saldrá hasta que elijas «Gratis con email» o «Pago en otra web».");
  if (product.type === "SESSION" && product.groupSession && (!product.eventStartAt || product.eventStartAt <= new Date()))
    notes.push(product.eventStartAt ? "La fecha del taller ya pasó: no sale en tu portada." : "Sin fecha: el taller no sale en tu portada.");
  return notes;
}

/** Lo que se ve dentro del teléfono: la tarjeta (como en la portada) o la ficha del producto. */
function PreviewScene({ ctx, product, tab }: { ctx: ProductPreviewContext; product: ProductPageProduct; tab: PreviewTab }) {
  if (tab === "page") {
    const paid = asAccessMode(product.accessMode) === "PAID" && !ctx.signupsOnly;
    return (
      <CreatorShell
        username={ctx.username}
        config={ctx.config}
        allowCustom={ctx.allowCustom}
        personal={ctx.personal}
        signupsOnly={ctx.signupsOnly}
        pages={ctx.pages}
        sellerName={paid && ctx.seller.named ? ctx.seller.name : null}
      >
        <ProductPageView
          username={ctx.username}
          product={product}
          timeZone={ctx.timeZone}
          signupsOnly={ctx.signupsOnly}
          seller={ctx.seller}
          seatsLeft={product.capacity != null ? Math.max(0, product.capacity - ctx.seatsTaken) : null}
          testimonials={ctx.testimonials}
          claim={{ ...ctx.claim, isOwner: true, creatorDisplayName: ctx.config.displayName }}
          clickEvent={null}
        />
      </CreatorShell>
    );
  }
  const lessons = product.modules.reduce((a, m) => a + m.lessons.length, 0);
  const card = toPublicProduct(product, { lessons, timeZone: ctx.timeZone });
  const theme = resolveTheme(ctx.config.template, ctx.config.theme, ctx.allowCustom);
  const group = card.type === "COURSE" ? groupCourses([card])[0] : null;
  return (
    <div className="cp" style={themeStyle(theme)} {...themeAttrs(theme)}>
      <TemplateDecor decor={theme.decor} contained>
        {theme.backgroundImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={theme.backgroundImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        )}
      </TemplateDecor>
      <main className="relative mx-auto w-full max-w-[44rem] px-5 pb-16 pt-10">
        <section data-preview-card>
          <SectionHeading title={ctx.sectionTitle} />
          <div className="mt-5">
            <ProductCard p={card} username={ctx.username} trackCreatorId={null} />
          </div>
        </section>
        {card.sale && (
          <section className="mt-14">
            <SectionHeading title={ctx.offersTitle} />
            <div className="mt-5">
              <OfferCard p={card} username={ctx.username} />
            </div>
          </section>
        )}
        {group && (
          <section className="mt-14">
            <SectionHeading title="En «Cursos», por tema" />
            <CourseGroups groups={[{ key: group.key, label: group.label, categories: group.categories, count: 1, cards: <ProductCard p={card} username={ctx.username} trackCreatorId={null} /> }]} />
          </section>
        )}
      </main>
    </div>
  );
}

/** Columna fija de escritorio: pestañas, avisos y el teléfono. */
export function DesktopPreview({ ctx, product, status, tab, onTab }: { ctx: ProductPreviewContext; product: ProductPageProduct; status: string; tab: PreviewTab; onTab: (t: PreviewTab) => void }) {
  const notes = previewNotes(ctx, product, status);
  return (
    <div className="sticky top-20" data-product-preview>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Vista previa en vivo</p>
        <PreviewTabs tab={tab} onChange={onTab} />
      </div>
      {notes.map((n) => (
        <p key={n} className="mb-2 rounded-xl bg-sand px-3 py-2 text-xs text-muted">{n}</p>
      ))}
      <PhoneFrame screenClassName="h-[min(760px,calc(100dvh-215px))] w-[360px] overflow-hidden xl:w-[390px]">
        <PreviewFrame title="Vista previa del producto" className="block h-full w-full border-0 bg-transparent">
          <PreviewScene ctx={ctx} product={product} tab={tab} />
        </PreviewFrame>
      </PhoneFrame>
    </div>
  );
}

/** Teléfono y tableta: la vista previa a pantalla completa, con su botón para volver al formulario. */
export function PreviewSheet({ ctx, product, status, tab, onTab, onClose }: { ctx: ProductPreviewContext; product: ProductPageProduct; status: string; tab: PreviewTab; onTab: (t: PreviewTab) => void; onClose: () => void }) {
  const notes = previewNotes(ctx, product, status);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Vista previa" className="fixed inset-0 z-50 flex flex-col bg-paper animate-fade-in lg:hidden" data-product-preview>
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 pb-2 pt-[max(env(safe-area-inset-top),0.5rem)]">
        <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
        <PreviewTabs tab={tab} onChange={onTab} />
      </div>
      {notes.map((n) => (
        <p key={n} className="border-b border-line bg-sand px-4 py-2 text-xs text-muted">{n}</p>
      ))}
      <div className="mx-auto min-h-0 w-full max-w-[430px] flex-1">
        <PreviewFrame title="Vista previa del producto" className="block h-full w-full border-0 bg-transparent">
          <PreviewScene ctx={ctx} product={product} tab={tab} />
        </PreviewFrame>
      </div>
    </div>
  );
}

/** Botón «Vista previa» (teléfono y tableta). */
export function PreviewButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={`btn btn-outline btn-sm lg:hidden ${className}`}>
      <Eye className="h-4 w-4" /> Vista previa
    </button>
  );
}
