import Link from "next/link";
import { ChevronRight, Mail } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { AUTOMATIONS, automationDefaultOn, EDITABLE_EMAILS, type AutomationTrigger } from "@/lib/automation-catalog";
import { readDesign } from "@/lib/email-blocks";
import { tenantDb } from "@/lib/tenant";
import { Badge, PageHeader } from "../../ui";
import { requireNewsletterOwner } from "../guard";
import { NewsletterTabs } from "../tabs";
import { toggleNewsletterWelcome } from "./actions";

export const dynamic = "force-dynamic";

/** Los emails que se envían solos y que puede escribir a su manera (asunto y texto). */
export default async function AutomaticEmailsPage() {
  const { creator } = await requireNewsletterOwner();
  const rows = await tenantDb(creator.id).automation.findMany();
  const by = new Map(rows.map((r) => [r.trigger, r]));
  const triggers = Object.keys(EDITABLE_EMAILS) as AutomationTrigger[];
  const welcome = by.get("NEWSLETTER_WELCOME");
  const welcomeOn = welcome ? welcome.enabled : automationDefaultOn("NEWSLETTER_WELCOME");
  return (
    <div>
      <PageHeader title="Emails automáticos" subtitle="Escríbelos con tus palabras: asunto y texto, con imágenes y botones. Lo importante (el acceso, el recibo, la fecha) se añade solo." />
      <NewsletterTabs current="/panel/newsletter/emails" />
      <ul className="card divide-y divide-line">
        {triggers.map((t) => {
          const row = by.get(t);
          const custom = !!readDesign(row?.design) || !!row?.subject;
          return (
            <li key={t}>
              <Link href={`/panel/newsletter/emails/${t}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-paper">
                <Mail className="h-4 w-4 shrink-0 text-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{AUTOMATIONS[t].label}</span>
                  <span className="block truncate text-xs text-muted">{AUTOMATIONS[t].description}</span>
                </span>
                {custom ? <Badge tone="dark">Tu versión</Badge> : <Badge>Original</Badge>}
                <ChevronRight className="h-4 w-4 text-faint" />
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="card mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-semibold">Bienvenida a la newsletter</p>
          <p className="text-xs text-muted">Un email al confirmar el alta. {welcomeOn ? "Activada." : "Desactivada."}</p>
        </div>
        <form action={toggleNewsletterWelcome}>
          <input type="hidden" name="on" value={welcomeOn ? "0" : "1"} />
          <SubmitButton className={welcomeOn ? "btn btn-outline btn-sm" : "btn btn-primary btn-sm"}>{welcomeOn ? "Desactivar" : "Activar"}</SubmitButton>
        </form>
      </div>
      <p className="mt-4 text-xs text-muted">
        Cuándo se envía cada uno y si está activado se cambia en <Link href="/panel/automatizaciones" className="underline underline-offset-2">Automatizaciones</Link>.
      </p>
    </div>
  );
}
