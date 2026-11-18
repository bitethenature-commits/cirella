import Link from "next/link";

const TABS = [
  { href: "/panel/newsletter", label: "Newsletter" },
  { href: "/panel/newsletter/suscriptoras", label: "Suscriptoras" },
  { href: "/panel/newsletter/plantillas", label: "Plantillas" },
  { href: "/panel/newsletter/automatizaciones", label: "Automatizaciones" },
  { href: "/panel/newsletter/estadisticas", label: "Estadísticas" },
  { href: "/panel/newsletter/ajustes", label: "Envío" },
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
            className={`whitespace-nowrap rounded-full px-3.5 py-2 font-medium transition ${t.href === current ? "bg-white shadow-soft" : "text-muted hover:text-ink"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
