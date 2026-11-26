import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { Flash } from "@/components/ui/flash";
import { requireCreator } from "@/lib/auth";
import { nextMoonDates } from "@/lib/moon-dates";
import { getPublicCreator } from "@/lib/public";
import { resolveTheme, themeStyle } from "@/lib/templates";
import { asPortalKind, readPortalMedia } from "@/lib/portal-rules";
import { isPersonalMode } from "@/lib/site-mode";
import { sitePageLinkTargets } from "@/lib/site-pages.server";
import { tenantDb } from "@/lib/tenant";
import { dateKeyInTz, minutesToLabel, zonedParts } from "@/lib/tz";
import { PageHeader } from "../../ui";
import { deletePortalItem } from "../actions";
import { PortalForm } from "../portal-form";
import { Tr } from "@/lib/i18n/client";

export const metadata: Metadata = { title: "Portal de Noticias" };

const SAVED: Record<string, string> = { publicado: "Publicado en tu portal.", borrador: "Guardado como borrador: no se ve en tu web." };

export default async function EditPortalItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ guardado?: string; falta?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { creator } = await requireCreator();
  const item = await tenantDb(creator.id).portalItem.findFirst({ where: { id } });
  if (!item) notFound();
  const at = item.eventAt;
  // El tema de la web: el editor se ve como la web.
  const site = await getPublicCreator(creator.username, true);
  const t = site ? resolveTheme(site.config.template, site.config.theme, site.allowCustom) : null;
  const theme = t && site ? { style: themeStyle(t), card: t.card, template: site.config.template } : null;
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/panel/portal" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" />{" "}<Tr s={"Portal de Noticias"} /></Link>
      <PageHeader title="Editar" />
      {sp.guardado && SAVED[sp.guardado] && <Flash ok={SAVED[sp.guardado]} />}
      {sp.falta && <Flash error="Sube el archivo antes de publicarlo." />}
      <PortalForm
        theme={theme}
        linkTargets={await sitePageLinkTargets(creator.id, creator.username, isPersonalMode())}
        moonDates={nextMoonDates(new Date(), creator.timezone).map((m) => ({ label: m.label, date: m.date, time: m.time }))}
        item={{
          id: item.id,
          kind: asPortalKind(item.kind),
          title: item.title,
          summary: item.summary ?? "",
          body: item.body ?? "",
          coverUrl: item.coverUrl,
          // Sin las claves de los archivos: solo el nombre y el tipo.
          media: readPortalMedia(item.media).map((m) => ({ name: m.name, kind: m.kind })),
          linkUrl: item.linkUrl ?? "",
          linkLabel: item.linkLabel ?? "",
          eventDate: at ? dateKeyInTz(at, creator.timezone) : "",
          eventTime: at ? (() => { const z = zonedParts(at, creator.timezone); return minutesToLabel(z.hour * 60 + z.minute); })() : "",
          featured: item.featured,
          status: item.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
        }}
      />
      <ConfirmForm action={deletePortalItem} message="¿Borrarlo del portal? Sus archivos también se borran y no se puede deshacer." className="mt-10 border-t border-line pt-6">
        <input type="hidden" name="id" value={item.id} />
        <button className="btn btn-ghost btn-sm text-rose">
          <Trash2 className="h-4 w-4" />{" "}<Tr s={"Borrar"} /></button>
      </ConfirmForm>
    </div>
  );
}
