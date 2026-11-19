import {
  BarChart3,
  Brush,
  ClipboardList,
  CreditCard,
  FileText,
  Gift,
  GraduationCap,
  Home,
  Inbox,
  Layers,
  Mail,
  Menu,
  Moon,
  MessagesSquare,
  Newspaper,
  Orbit,
  Palette,
  Receipt,
  Settings,
  Sparkles,
  TicketPercent,
  Users,
  Video,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { bottomBarItems, orderNav, type PanelNavPrefs } from "@/lib/panel-prefs";

/** Los bloques del menú (barra lateral y «Más»). Inicio, Plan y Ajustes van sueltos. */
export type NavGroup = "web" | "offer" | "people" | "data";
export const NAV_GROUPS: Record<NavGroup, string> = { web: "Mi web", offer: "Lo que ofreces", people: "Personas", data: "Datos y modelos" };

export type PanelNavItem = { href: string; label: string; icon: LucideIcon; group?: NavGroup };

// Datos de navegación del panel. Viven fuera del módulo "use client" para que también
// los pueda usar un Server Component (p. ej. /panel/mas). En su orden de siempre, por bloques.
export const PANEL_NAV: PanelNavItem[] = [
  { href: "/panel", label: "Inicio", icon: Home },
  { href: "/panel/pagina", label: "Mi página", icon: Palette, group: "web" },
  { href: "/panel/canva", label: "Editar la web", icon: Brush, group: "web" },
  { href: "/panel/circulos", label: "Círculos de la Luna", icon: Moon, group: "offer" },
  { href: "/panel/sesiones", label: "Sesiones y lecturas", icon: Video, group: "offer" },
  { href: "/panel/solicitudes", label: "Solicitudes", icon: Inbox, group: "people" },
  { href: "/panel/ventas", label: "Ventas", icon: Receipt, group: "people" },
  { href: "/panel/clientes", label: "Clientes", icon: Users, group: "people" },
  { href: "/panel/automatizaciones", label: "Automatizaciones", icon: Zap, group: "people" },
  { href: "/panel/estadisticas", label: "Estadísticas", icon: BarChart3, group: "data" },
  { href: "/panel/modelos", label: "Modelos", icon: Orbit, group: "data" },
  { href: "/panel/plan", label: "Plan", icon: Sparkles },
  { href: "/panel/ajustes", label: "Ajustes", icon: Settings },
];

export const MOBILE_NAV: PanelNavItem[] = [
  { href: "/panel", label: "Inicio", icon: Home },
  { href: "/panel/sesiones", label: "Sesiones", icon: Video },
  { href: "/panel/pagina", label: "Página", icon: Palette },
  { href: "/panel/ventas", label: "Ventas", icon: CreditCard },
  { href: "/panel/mas", label: "Más", icon: Menu },
];

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
  /** Un número junto a una sección (las solicitudes por contestar). */
  badges?: Record<string, number>;
};

export const PLATFORM_NAV_FLAGS: PanelNavFlags = { personal: false, showBookings: true };

/**
 * Menú en modo personal: sin Plan (ni nada de cobros), «Ventas» pasa a ser «Inscripciones» (quién
 * se ha apuntado a qué) y se añaden Páginas (extra), Cursos (estudio de cursos), Membresía (estudio
 * de la membresía, en /panel/comunidad), Publicaciones («Actualidades»), Portal de Noticias, Barajas (de oráculo), Códigos
 * y Newsletter, por bloques (NAV_GROUPS). Con su propio orden (Ajustes), las secciones nuevas van al final
 * (lib/panel-prefs.ts → orderNav).
 */
const PERSONAL_NAV: PanelNavItem[] = [
  { href: "/panel", label: "Inicio", icon: Home },
  { href: "/panel/pagina", label: "Mi página", icon: Palette, group: "web" },
  { href: "/panel/canva", label: "Editar la web", icon: Brush, group: "web" },
  { href: "/panel/paginas", label: "Páginas", icon: FileText, group: "web" },
  { href: "/panel/actualidades", label: "Actualidades", icon: Newspaper, group: "web" },
  { href: "/panel/portal", label: "Portal de Noticias", icon: Gift, group: "web" },
  { href: "/panel/codigos", label: "Códigos", icon: TicketPercent, group: "web" },
  { href: "/panel/comunidad", label: "Membresía", icon: MessagesSquare, group: "offer" },
  { href: "/panel/circulos", label: "Círculos de la Luna", icon: Moon, group: "offer" },
  { href: "/panel/cursos", label: "Cursos", icon: GraduationCap, group: "offer" },
  { href: "/panel/sesiones", label: "Sesiones y lecturas", icon: Video, group: "offer" },
  { href: "/panel/solicitudes", label: "Solicitudes", icon: Inbox, group: "people" },
  { href: "/panel/ventas", label: "Inscripciones", icon: ClipboardList, group: "people" },
  { href: "/panel/clientes", label: "Clientes", icon: Users, group: "people" },
  { href: "/panel/newsletter", label: "Newsletter", icon: Mail, group: "people" },
  { href: "/panel/estadisticas", label: "Estadísticas", icon: BarChart3, group: "data" },
  { href: "/panel/modelos", label: "Modelos", icon: Orbit, group: "data" },
  { href: "/panel/barajas", label: "Barajas", icon: Layers, group: "data" },
  { href: "/panel/ajustes", label: "Ajustes", icon: Settings },
];

const PERSONAL_MOBILE_NAV: PanelNavItem[] = [
  { href: "/panel", label: "Inicio", icon: Home },
  { href: "/panel/sesiones", label: "Sesiones", icon: Video },
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
  return withSalesLabel(PERSONAL_NAV, flags.sales);
}

/** Barra inferior del móvil (4 accesos + «Más»). */
export function mobileNav(flags: PanelNavFlags): PanelNavItem[] {
  return flags.personal ? withSalesLabel(PERSONAL_MOBILE_NAV, flags.sales) : MOBILE_NAV;
}

/** Nombre corto en la barra de abajo (5 huecos en 375 px). */
const SHORT_LABEL: Record<string, string> = { "/panel/pagina": "Página", "/panel/canva": "Editar web", "/panel/automatizaciones": "Automatiz.", "/panel/estadisticas": "Estadísticas", "/panel/portal": "Portal" };
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

/**
 * El menú con sus bloques: un título antes de la primera sección de cada bloque. Solo con el orden de siempre
 * (con su propio orden, los bloques se mezclarían: va sin títulos).
 */
export function withGroupTitles<T extends PanelNavItem>(items: T[], ownOrder: boolean): (T & { title?: string })[] {
  if (ownOrder) return items;
  let last: NavGroup | undefined;
  return items.map((i) => {
    const title = i.group && i.group !== last ? NAV_GROUPS[i.group] : undefined;
    last = i.group;
    return title ? { ...i, title } : i;
  });
}
