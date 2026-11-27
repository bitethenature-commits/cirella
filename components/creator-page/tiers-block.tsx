import type { ReactNode } from "react";
import { Mail } from "lucide-react";
import type { TiersBlock } from "@/lib/page-blocks";
import type { WebTiers } from "@/lib/web-tiers";
import { PortalCircles, PortalFeature, PortalIncludes, PortalPrice, TierPortal, portalButton } from "./tier-portal";
import { TrackedLink } from "./tracking";
import { Tr } from "@/lib/i18n/client";

/**
 * La sección «Niveles de la comunidad» (lib/page-blocks.ts → TiersBlock): las tarjetas de los niveles una al lado de
 * la otra, de menos a más, más anchas que el resto de la página. Cada tarjeta lleva su propio diseño (lib/tier-look.ts);
 * la sección, solo el fondo de ensueño detrás de todas. Sin hooks: vale en el servidor y en Mi página.
 */

/**
 * Su marco: el fondo de ensueño (si lo lleva) y la rejilla de tarjetas. `wide`: más ancha que la página (en la web;
 * en Mi página la sección entera ya lo es).
 */
export function TiersFrame({ b, wide = false, children, after }: { b: Pick<TiersBlock, "stage">; wide?: boolean; children: ReactNode; after?: ReactNode }) {
  return (
    <div className={wide ? "tp-wide" : undefined}>
      <div className={b.stage ? "tp-stage" : undefined}>
        <div className="tp-grid">{children}</div>
        {after}
      </div>
    </div>
  );
}

/** Los niveles en la web: cada uno con su precio, lo que incluye, su botón y, en el más completo, los próximos círculos. */
export function TiersShow({ b, data }: { b: TiersBlock; data: WebTiers }) {
  if (!data.tiers.length) return <p className="cp-muted text-center"><Tr s={data.empty} /></p>;
  return (
    <TiersFrame
      b={b}
      wide
      after={
        data.note && (
          <p className="cp-muted mt-10 text-center text-sm">
            <Tr s={data.note.text} />{" "}
            <a href={data.note.href} className="cp-gold underline underline-offset-4">
              <Tr s={data.note.link} />
            </a>
            .
          </p>
        )
      }
    >
      {data.tiers.map((t) => (
        <TierPortal
          key={t.id}
          as="section"
          level={t.level}
          image={t.imageUrl}
          emblem={t.emblem}
          look={t.look}
          title={<span id={`nivel-${t.id}`}>{t.title}</span>}
          intro={t.intro || null}
          badge={t.highlight && b.badge ? b.badge : null}
          className={t.highlight ? "is-highlight" : ""}
          style={{ animationDelay: `${t.level * 0.15}s` }}
          ariaLabel={t.title}
          bottom={
            <TrackedLink
              href={t.href}
              event={{ creatorId: data.creatorId, type: "PRODUCT_CLICK" as const, productId: t.id }}
              className={portalButton(t.highlight)}
              ariaLabel={t.paid ? `${t.cta}: ${t.title}` : `Unirme a ${t.title}`}
            >
              {t.paid ? (
                <>
                  <Mail className="h-4 w-4" /> <Tr s={t.cta} />
                </>
              ) : (
                <><Tr s={"Unirme a"} />{" "}{t.title}</>
              )}
            </TrackedLink>
          }
        >
          <PortalPrice price={t.price} interval={t.interval} regular={t.regular} saleLine={t.saleLine} />
          {(t.includesPrevious || t.features.length > 0) && (
            <ul className="relative mt-6 w-full space-y-3.5 text-left text-[0.93rem]">
              {t.includesPrevious && <PortalIncludes title={t.includesPrevious} />}
              {t.features.map((f, i) => (
                <PortalFeature key={i} f={f} />
              ))}
            </ul>
          )}
          {t.highlight && data.circles.length > 0 && <PortalCircles circles={data.circles} />}
        </TierPortal>
      ))}
    </TiersFrame>
  );
}
