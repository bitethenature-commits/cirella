import { PageHeader } from "../../ui";
import { requireNewsletterOwner } from "../guard";
import { NewsletterTabs } from "../tabs";
import { AutomaticEmails } from "../../automatizaciones/automatic-emails";

export const dynamic = "force-dynamic";

/**
 * Automatizaciones de la newsletter: los emails que salen solos (recibos, accesos, recordatorios y
 * avisos para ti). Aquí se encienden, se elige cuándo salen y se escriben a tu manera.
 */
export default async function AutomationsPage() {
  const { creator } = await requireNewsletterOwner();
  return (
    <div>
      <PageHeader title="Automatizaciones" subtitle="Los emails que salen solos: recibos, accesos, recordatorios y avisos para ti." />
      <NewsletterTabs current="/panel/newsletter/automatizaciones" />
      <AutomaticEmails creator={creator} />
    </div>
  );
}
