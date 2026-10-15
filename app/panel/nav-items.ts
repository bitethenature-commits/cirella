import {
  BarChart3,
  CalendarDays,
  CreditCard,
  Home,
  LayoutGrid,
  Menu,
  Palette,
  Receipt,
  Settings,
  Sparkles,
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
