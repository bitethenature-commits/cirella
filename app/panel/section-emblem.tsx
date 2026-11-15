"use client";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
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
  ShieldCheck,
  Sparkles,
  TicketPercent,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** El emblema de cada sección (por su dirección; la más larga que encaje). */
const ICONS: [string, LucideIcon][] = [
  ["/panel/paginas", FileText],
  ["/panel/pagina", Palette],
  ["/panel/productos", LayoutGrid],
  ["/panel/cursos", GraduationCap],
  ["/panel/comunidad", MessagesSquare],
  ["/panel/publicaciones", Newspaper],
  ["/panel/actualidades", Newspaper],
  ["/panel/portal", Gift],
  ["/panel/barajas", Layers],
  ["/panel/modelos", Orbit],
  ["/panel/solicitudes", Inbox],
  ["/panel/codigos", TicketPercent],
  ["/panel/ventas", Receipt],
  ["/panel/clientes", Users],
  ["/panel/newsletter", Mail],
  ["/panel/reservas", CalendarDays],
  ["/panel/estadisticas", BarChart3],
  ["/panel/automatizaciones", Zap],
  ["/panel/ajustes", Settings],
  ["/panel/plan", Sparkles],
  ["/panel/mas", Menu],
  ["/admin", ShieldCheck],
  ["/panel", Home],
];

export function SectionEmblem({ className = "" }: { className?: string }) {
  const path = usePathname() ?? "";
  const Icon = ICONS.filter(([p]) => path === p || path.startsWith(`${p}/`)).sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? Sparkles;
  return (
    <span className={`panel-emblem ${className}`} aria-hidden>
      <Icon className="h-[44%] w-[44%]" strokeWidth={1.5} />
    </span>
  );
}
