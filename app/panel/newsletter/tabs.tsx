import Link from "next/link";
import { Settings } from "lucide-react";
import { Tr } from "@/lib/i18n/client";

/**
 * Las pestañas de la Newsletter: Newsletter (tus newsletters, crear una y las plantillas), Automatizaciones y
 * Ajustes mail. Las suscriptoras están en Personas y las cifras, en Estadísticas.
 */
const TABS = [
  { href: "/panel/newsletter", label: "Newsletter", icon: null },
  { href: "/panel/newsletter/automatizaciones", label: "Automatizaciones", icon: null },
  { href: "/panel/newsletter/ajustes", label: "Ajustes mail", icon: Settings },
] as const;

/** Pestañas de la sección Newsletter (se desplazan en el móvil). */
export function NewsletterTabs({ current }: { current: (typeof TABS)[number]["href"] }) {
  return (
    <nav aria-label="Newsletter" className="-mx-4 mb-6 overflow-x-auto px-4 [scrollbar-width:none]">
      <div className="inline-flex gap-1 rounded-full bg-sand p-1 text-sm">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.href === current ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 font-medium transition ${t.href === current ? "bg-white shadow-soft" : "text-muted hover:text-ink"}`}
          >
            {t.icon && <t.icon className="h-4 w-4" />}
            <Tr s={t.label} />
          </Link>
        ))}
      </div>
    </nav>
  );
}
