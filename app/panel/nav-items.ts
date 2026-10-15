import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  CreditCard,
  Home,
  LayoutGrid,
  Menu,
  Newspaper,
  Palette,
  Receipt,
  Settings,
  Sparkles,
  TicketPercent,
  Users,
  Zap,
} from "lucide-react";

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
  /** Modo personal: web de una sola dueña, sin cobros ni planes. */
  personal: boolean;
  /** Enseñar «Reservas» (en modo personal, solo si hay sesiones que se reservan aquí). */
  showBookings: boolean;
};

export const PLATFORM_NAV_FLAGS: PanelNavFlags = { personal: false, showBookings: true };

/**
 * Menú en modo personal: sin Plan (ni nada de cobros), «Ventas» pasa a ser «Inscripciones» (quién
 * se ha apuntado a qué) y se añaden Publicaciones y Códigos. Reservas, solo si hay sesiones con
 * reserva aquí.
 */
const PERSONAL_NAV: PanelNavItem[] = [
  { href: "/panel", label: "Inicio", icon: Home },
  { href: "/panel/pagina", label: "Mi página", icon: Palette },
  { href: "/panel/productos", label: "Productos", icon: LayoutGrid },
  { href: "/panel/publicaciones", label: "Publicaciones", icon: Newspaper },
  { href: "/panel/codigos", label: "Códigos", icon: TicketPercent },
  { href: "/panel/ventas", label: "Inscripciones", icon: ClipboardList },
  { href: "/panel/clientes", label: "Clientes", icon: Users },
  { href: "/panel/reservas", label: "Reservas", icon: CalendarDays },
  { href: "/panel/estadisticas", label: "Estadísticas", icon: BarChart3 },
  { href: "/panel/automatizaciones", label: "Automatizaciones", icon: Zap },
  { href: "/panel/ajustes", label: "Ajustes", icon: Settings },
];

const PERSONAL_MOBILE_NAV: PanelNavItem[] = [
  { href: "/panel", label: "Inicio", icon: Home },
  { href: "/panel/productos", label: "Productos", icon: LayoutGrid },
  { href: "/panel/pagina", label: "Página", icon: Palette },
  { href: "/panel/ventas", label: "Inscripciones", icon: ClipboardList },
  { href: "/panel/mas", label: "Más", icon: Menu },
];

/** Menú completo (barra lateral y /panel/mas). En la plataforma, el de siempre. */
export function panelNav(flags: PanelNavFlags): PanelNavItem[] {
  if (!flags.personal) return PANEL_NAV;
  return PERSONAL_NAV.filter((i) => flags.showBookings || i.href !== "/panel/reservas");
}

/** Barra inferior del móvil (4 accesos + «Más»). */
export function mobileNav(flags: PanelNavFlags): PanelNavItem[] {
  return flags.personal ? PERSONAL_MOBILE_NAV : MOBILE_NAV;
}
