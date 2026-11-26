import { PageHeader } from "../../ui";
import { requireNewsletterOwner } from "../guard";
import { NewsletterTabs } from "../tabs";
import { AutomaticEmails } from "../../automatizaciones/automatic-emails";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/**
 * Automatizaciones de la newsletter: los emails que salen solos (recibos, accesos, recordatorios y
 * avisos para ti). Aquí se encienden, se elige cuándo salen y se escriben a tu manera.
 */
export default async function AutomationsPage() {
  const t = await getT();
  const { creator } = await requireNewsletterOwner();
  return (
    <div>
      <PageHeader title={t("Automatizaciones")} subtitle={t("Los emails que salen solos: recibos, accesos, recordatorios y avisos para ti.")} />
      <NewsletterTabs current="/panel/newsletter/automatizaciones" />
      <AutomaticEmails creator={creator} />
    </div>
  );
}
