import { redirect } from "next/navigation";
import { requireCreator } from "@/lib/auth";
import { isPersonalMode } from "@/lib/site-mode";
import { PageHeader } from "../ui";
import { AutomaticEmails } from "./automatic-emails";

/** Plataforma: los emails que salen solos. En la web personal están en Newsletter › Automatizaciones. */
export default async function AutomationsPage() {
  const { creator } = await requireCreator();
  if (isPersonalMode()) redirect("/panel/newsletter/automatizaciones");
  return (
    <div>
      <PageHeader title="Automatizaciones" subtitle="Emails que salen solos en el momento justo." />
      <AutomaticEmails creator={creator} />
    </div>
  );
}
