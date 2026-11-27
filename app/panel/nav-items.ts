import {
  Gift,
  GraduationCap,
  Home,
  Languages,
  Layers,
  Mail,
  Moon,
  MessagesSquare,
  Newspaper,
  Orbit,
  Palette,
  Percent,
  Receipt,
  Settings,
  Sparkles,
  Users,
  Video,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { orderNav, type PanelNavPrefs } from "@/lib/panel-prefs";

/**
 * Los bloques del menú, cada uno en su borde del panel (app/panel/frame.tsx): «web» arriba (Mi página, en el botón
 * de Canva de la derecha; lo demás, junto a la etiqueta de la izquierda), «offer» en el borde izquierdo, «people»
 * abajo a la izquierda y «data» en el desplegable de Ajustes, abajo a la derecha. Inicio es la etiqueta; Plan y
 * Ajustes, en el desplegable.
 */
export type NavGroup = "web" | "offer" | "people" | "data";

export type PanelNavItem = { href: string; label: string; icon: LucideIcon; group?: NavGroup };

// Datos de navegación del panel. Viven fuera del módulo "use client" para que también
// los pueda usar un Server Component. En su orden de siempre, por bloques.
export const PANEL_NAV: PanelNavItem[] = [
  { href: "/panel", label: "Inicio", icon: Home },
  { href: "/panel/pagina", label: "Mi página", icon: Palette, group: "web" },
  { href: "/panel/circulos", label: "Círculos de la Luna", icon: Moon, group: "offer" },
  { href: "/panel/sesiones", label: "Sesiones y lecturas", icon: Video, group: "offer" },
  { href: "/panel/ofertas", label: "Ofertas", icon: Percent, group: "offer" },
  { href: "/panel/clientes", label: "Clientes", icon: Users, group: "people" },
  { href: "/panel/ventas", label: "Ventas", icon: Receipt, group: "people" },
  { href: "/panel/automatizaciones", label: "Automatizaciones", icon: Zap, group: "people" },
  { href: "/panel/modelos", label: "Modelos", icon: Orbit, group: "data" },
  { href: "/panel/plan", label: "Plan", icon: Sparkles },
  { href: "/panel/ajustes", label: "Ajustes", icon: Settings },
];

/**
 * Qué enseña el menú. Lo calcula el servidor (app/panel/nav-flags.ts) y viaja a los componentes
 * cliente como datos simples: los iconos no se pueden pasar del servidor al cliente.
 */
export type PanelNavFlags = {
  /** Modo personal: web de una sola dueña, sin planes. */
  personal: boolean;
  /** Modo personal que cobra en la web (Stripe/PayPal): sale «Ventas» después de Personas. */
  sales?: boolean;
  /** Enseñar «Reservas» (en modo personal, solo si hay sesiones que se reservan aquí). */
  showBookings: boolean;
  /** Un número junto a una sección (las solicitudes por contestar). */
  badges?: Record<string, number>;
};

export const PLATFORM_NAV_FLAGS: PanelNavFlags = { personal: false, showBookings: true };

/**
 * Menú en modo personal: sin Plan (ni nada de cobros). Mi página junta el editor de la web, las páginas extra
 * y los códigos; Personas junta las solicitudes, las lecturas por enviar y a cada persona con sus
 * inscripciones (sin «Ventas» si no cobra). Con su propio orden (Ajustes), las secciones nuevas van al final
 * de su borde (lib/panel-prefs.ts → orderNav).
 */
const PERSONAL_NAV: PanelNavItem[] = [
  { href: "/panel", label: "Inicio", icon: Home },
  { href: "/panel/pagina", label: "Mi página", icon: Palette, group: "web" },
  { href: "/panel/actualidades", label: "Actualidades", icon: Newspaper, group: "web" },
  { href: "/panel/ofertas", label: "Ofertas", icon: Percent, group: "web" },
  { href: "/panel/traducciones", label: "Traducciones", icon: Languages, group: "web" },
  { href: "/panel/comunidad", label: "Membresía", icon: MessagesSquare, group: "offer" },
  { href: "/panel/circulos", label: "Círculos de la Luna", icon: Moon, group: "offer" },
  { href: "/panel/cursos", label: "Cursos", icon: GraduationCap, group: "offer" },
  { href: "/panel/sesiones", label: "Sesiones y lecturas", icon: Video, group: "offer" },
  { href: "/panel/portal", label: "Portal de Noticias", icon: Gift, group: "offer" },
  { href: "/panel/clientes", label: "Personas", icon: Users, group: "people" },
  { href: "/panel/newsletter", label: "Newsletter", icon: Mail, group: "people" },
  { href: "/panel/modelos", label: "Modelos", icon: Orbit, group: "data" },
  { href: "/panel/barajas", label: "Barajas", icon: Layers, group: "data" },
  { href: "/panel/ajustes", label: "Ajustes", icon: Settings },
];

/**
 * En la web personal que cobra, «Ventas» sale después de Personas (con las ventas y las inscripciones).
 * Sin cobros no hay: lo de cada persona está en su ficha (Personas).
 */
const withSales = (items: PanelNavItem[], sales?: boolean) =>
  sales ? items.flatMap((i) => (i.href === "/panel/clientes" ? [i, { href: "/panel/ventas", label: "Ventas", icon: Receipt, group: "people" as const }] : [i])) : items;

/** Menú completo. En la plataforma, el de siempre. */
export function panelNav(flags: PanelNavFlags): PanelNavItem[] {
  if (!flags.personal) return PANEL_NAV;
  return withSales(PERSONAL_NAV, flags.sales);
}

/**
 * Menú con «Personalizar mi panel» (Ajustes): su orden, sin las secciones ocultas. Sin preferencias,
 * el de siempre.
 */
export function panelNavFor(flags: PanelNavFlags, nav: PanelNavPrefs | null): PanelNavItem[] {
  return orderNav(panelNav(flags), nav).visible;
}

/**
 * Dónde va cada sección en el marco del panel (app/panel/frame.tsx): Inicio, en la etiqueta de arriba a la
 * izquierda; Mi página, en el botón dorado de Canva de arriba a la derecha; lo demás de la web (Actualidades), en
 * pestañas junto a la etiqueta.
 */
export type FrameSlot = "home" | "top" | "canva" | "left" | "corner" | "settings";
export function frameSlot(item: PanelNavItem): FrameSlot {
  if (item.href === "/panel") return "home";
  if (item.href === "/panel/pagina") return "canva";
  if (item.group === "web") return "top";
  if (item.group === "offer") return "left";
  if (item.group === "people") return "corner";
  return "settings";
}

/** Nombre corto en las pestañas del borde izquierdo (van en vertical). */
export const EDGE_LABEL: Record<string, string> = {
  "/panel/circulos": "Círculos",
  "/panel/sesiones": "Sesiones",
  "/panel/portal": "Portal",
  "/panel/comunidad": "Membresía",
};
