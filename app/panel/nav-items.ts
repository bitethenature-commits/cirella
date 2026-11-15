import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  Gift,
  GraduationCap,
  Home,
  Inbox,
  Layers,
  LayoutGrid,
  Mail,
  Menu,
  MessagesSquare,
  Newspaper,
  Orbit,
  Palette,
  Receipt,
  Settings,
  Sparkles,
  TicketPercent,
  Users,
  Zap,
} from "lucide-react";

import { bottomBarItems, orderNav, type PanelNavPrefs } from "@/lib/panel-prefs";

// Datos de navegación del panel. Viven fuera del módulo "use client" para que también
// los pueda usar un Server Component (p. ej. /panel/mas).
export const PANEL_NAV = [
  { href: "/panel", label: "Inicio", icon: Home },
  { href: "/panel/pagina", label: "Mi página", icon: Palette },
  { href: "/panel/productos", label: "Productos", icon: LayoutGrid },
  { href: "/panel/ventas", label: "Ventas", icon: Receipt },
  { href: "/panel/clientes", label: "Clientes", icon: Users },
  { href: "/panel/reservas", label: "Reservas", icon: CalendarDays },
  { href: "/panel/estadisticas", label: "Estadísticas", icon: BarChart3 },
  { href: "/panel/automatizaciones", label: "Automatizaciones", icon: Zap },
  { href: "/panel/modelos", label: "Modelos", icon: Orbit },
  { href: "/panel/plan", label: "Plan", icon: Sparkles },
  { href: "/panel/ajustes", label: "Ajustes", icon: Settings },
];

export const MOBILE_NAV = [
  { href: "/panel", label: "Inicio", icon: Home },
  { href: "/panel/productos", label: "Productos", icon: LayoutGrid },
  { href: "/panel/pagina", label: "Página", icon: Palette },
  { href: "/panel/ventas", label: "Ventas", icon: CreditCard },
  { href: "/panel/mas", label: "Más", icon: Menu },
];

export type PanelNavItem = (typeof PANEL_NAV)[number];

/**
 * Qué enseña el menú. Lo calcula el servidor (app/panel/nav-flags.ts) y viaja a los componentes
 * cliente como datos simples: los iconos no se pueden pasar del servidor al cliente.
 */
export type PanelNavFlags = {
  /** Modo personal: web de una sola dueña, sin planes. */
  personal: boolean;
  /** Modo personal que cobra en la web (Stripe/PayPal): «Ventas» en vez de «Inscripciones». */
  sales?: boolean;
  /** Enseñar «Reservas» (en modo personal, solo si hay sesiones que se reservan aquí). */
  showBookings: boolean;
};

export const PLATFORM_NAV_FLAGS: PanelNavFlags = { personal: false, showBookings: true };

/**
 * Menú en modo personal: sin Plan (ni nada de cobros), «Ventas» pasa a ser «Inscripciones» (quién
 * se ha apuntado a qué) y se añaden Páginas (extra), Cursos (estudio de cursos), Comunidad (estudio
 * de la membresía), Publicaciones («Actualidades»), Portal de Noticias, Barajas (de oráculo), Códigos
 * y Newsletter. Reservas, solo si hay sesiones con reserva aquí. Con «Personalizar mi panel», las
 * secciones nuevas van al final de su orden (lib/panel-prefs.ts → orderNav).
 */
const PERSONAL_NAV: PanelNavItem[] = [
  { href: "/panel", label: "Inicio", icon: Home },
  { href: "/panel/cursos", label: "Cursos", icon: GraduationCap },
  { href: "/panel/comunidad", label: "Comunidad", icon: MessagesSquare },
  { href: "/panel/actualidades", label: "Actualidades", icon: Newspaper },
  { href: "/panel/portal", label: "Portal de Noticias", icon: Gift },
  // Carpeta «Mi web» (NAV_FOLDERS).
  { href: "/panel/pagina", label: "Mi página", icon: Palette },
  { href: "/panel/paginas", label: "Páginas", icon: FileText },
  { href: "/panel/productos", label: "Productos", icon: LayoutGrid },
  { href: "/panel/reservas", label: "Reservas", icon: CalendarDays },
  { href: "/panel/barajas", label: "Barajas", icon: Layers },
  { href: "/panel/modelos", label: "Modelos", icon: Orbit },
  // Carpeta «Ventas y clientas» (NAV_FOLDERS).
  { href: "/panel/solicitudes", label: "Solicitudes", icon: Inbox },
  { href: "/panel/codigos", label: "Códigos", icon: TicketPercent },
  { href: "/panel/ventas", label: "Inscripciones", icon: ClipboardList },
  { href: "/panel/estadisticas", label: "Estadísticas", icon: BarChart3 },
  { href: "/panel/clientes", label: "Clientes", icon: Users },
  { href: "/panel/newsletter", label: "Newsletter", icon: Mail },
  { href: "/panel/automatizaciones", label: "Automatizaciones", icon: Zap },
  { href: "/panel/ajustes", label: "Ajustes", icon: Settings },
];

/**
 * Carpetas del menú lateral: sus secciones van juntas dentro, en este orden, donde estaría la primera
 * de ellas. Solo agrupan las que existan en ese menú.
 */
export const NAV_FOLDERS: { key: string; label: string; hrefs: string[] }[] = [
  { key: "web", label: "Mi web", hrefs: ["/panel/pagina", "/panel/paginas", "/panel/productos"] },
  { key: "negocio", label: "Ventas y clientas", hrefs: ["/panel/solicitudes", "/panel/codigos", "/panel/ventas", "/panel/estadisticas", "/panel/clientes"] },
];

const PERSONAL_MOBILE_NAV: PanelNavItem[] = [
  { href: "/panel", label: "Inicio", icon: Home },
  { href: "/panel/productos", label: "Productos", icon: LayoutGrid },
  { href: "/panel/pagina", label: "Página", icon: Palette },
  { href: "/panel/solicitudes", label: "Solicitudes", icon: Inbox },
  { href: "/panel/mas", label: "Más", icon: Menu },
];

/** En la web personal que cobra, «Inscripciones» vuelve a ser «Ventas» (incluye también las inscripciones). */
const withSalesLabel = (items: PanelNavItem[], sales?: boolean) =>
  sales ? items.map((i) => (i.href === "/panel/ventas" ? { ...i, label: "Ventas", icon: Receipt } : i)) : items;

/** Menú completo (barra lateral y /panel/mas). En la plataforma, el de siempre. */
export function panelNav(flags: PanelNavFlags): PanelNavItem[] {
  if (!flags.personal) return PANEL_NAV;
  return withSalesLabel(PERSONAL_NAV.filter((i) => flags.showBookings || i.href !== "/panel/reservas"), flags.sales);
}

/** Barra inferior del móvil (4 accesos + «Más»). */
export function mobileNav(flags: PanelNavFlags): PanelNavItem[] {
  return flags.personal ? withSalesLabel(PERSONAL_MOBILE_NAV, flags.sales) : MOBILE_NAV;
}

/** Nombre corto en la barra de abajo (5 huecos en 375 px). */
const SHORT_LABEL: Record<string, string> = { "/panel/pagina": "Página", "/panel/automatizaciones": "Automatiz.", "/panel/estadisticas": "Estadísticas", "/panel/portal": "Portal" };
const MORE: PanelNavItem = { href: "/panel/mas", label: "Más", icon: Menu };

/**
 * Menú con «Personalizar mi panel» (Ajustes): su orden, sin las secciones ocultas. Sin preferencias,
 * el de siempre.
 */
export function panelNavFor(flags: PanelNavFlags, nav: PanelNavPrefs | null): PanelNavItem[] {
  return orderNav(panelNav(flags), nav).visible;
}

/**
 * Barra de abajo con sus preferencias: las 4 primeras secciones visibles de su orden y «Más» (el
 * resto). Sin preferencias, la de siempre.
 */
export function mobileNavFor(flags: PanelNavFlags, nav: PanelNavPrefs | null): PanelNavItem[] {
  if (!nav) return mobileNav(flags);
  return [...bottomBarItems(panelNavFor(flags, nav)).map((i) => (SHORT_LABEL[i.href] ? { ...i, label: SHORT_LABEL[i.href] } : i)), MORE];
}
