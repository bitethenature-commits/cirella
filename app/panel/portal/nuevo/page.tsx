import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCreator } from "@/lib/auth";
import { nextMoonDates } from "@/lib/moon-dates";
import { isPersonalMode } from "@/lib/site-mode";
import { sitePageLinkTargets } from "@/lib/site-pages.server";
import { PageHeader } from "../../ui";
import { PortalForm } from "../portal-form";

export const metadata: Metadata = { title: "Nuevo en el portal" };

export default async function NewPortalItemPage() {
  const { creator } = await requireCreator();
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/panel/portal" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Portal de Noticias
      </Link>
      <PageHeader title="Nuevo en el portal" />
      <PortalForm
        linkTargets={await sitePageLinkTargets(creator.id, creator.username, isPersonalMode())}
        moonDates={nextMoonDates(new Date(), creator.timezone).map((m) => ({ label: m.label, date: m.date, time: m.time }))}
        item={{ id: null, kind: "VIDEO", title: "", summary: "", body: "", coverUrl: null, media: [], linkUrl: "", linkLabel: "", eventDate: "", eventTime: "", featured: false, status: "PUBLISHED" }}
      />
    </div>
  );
}
