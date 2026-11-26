"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { ArrowLeft, Heart, MessageCircle, Receipt, Settings, Sparkles, Star, Store } from "lucide-react";
import { EnergyIcon } from "@/components/creator-page/energy-icon";
import { LibroMagicoIcon, LunaIcon, NivelIcon } from "./icons";
import { ProfileMenu, type ProfileInfo } from "./profile-menu";
import { Tr, useT } from "@/lib/i18n/client";

type Tab = { href: string; label: string; icon: ReactNode };

const ENERGY = "/area/energy";

/**
 * El marco del área de alumna, como el del panel (app/panel/frame.tsx), con pestañas que salen de los bordes:
 * - Arriba a la izquierda, su foto y su nombre: al tocarlo se abre su perfil (foto, nombre, frase, email y
 *   contraseña); a su lado, la pestaña «Mi energía» (el inicio en la web personal).
 * - Arriba a la derecha, «Mi panel» (quien tiene panel de creadora) o «Volver a la web» (las alumnas).
 * - En el borde izquierdo, a media altura: Mis membresías, Mis cursos y Círculos y lecturas (en la plataforma: Mis
 *   cursos, Mis sesiones, Mis membresías y Mis compras).
 * - Abajo a la izquierda: Favoritos, Me gusta y Comentarios (con sus avisos).
 * - Abajo a la derecha, «Ajustes» (su página: colores, novedades, soporte y cerrar sesión).
 * Los colores salen de los suyos (Ajustes › Colores de mi área → la barra) por .acc-frame (globals.css).
 */
export function AccountFrame({
  personal,
  unseen,
  tier,
  hasPanel,
  profile,
}: {
  personal: boolean;
  unseen: number;
  /** Su nivel de membresía (0 = I) para el sólido de «Mis membresías»; sin membresía, unas chispas. */
  tier: number | null;
  hasPanel: boolean;
  /** Su perfil, para la pestaña de arriba a la izquierda. */
  profile: ProfileInfo;
}) {
  const path = usePathname();
  const ico = "h-4 w-4 shrink-0";
  const memberships: Tab = {
    href: "/area/membership",
    label: "Mis membresías",
    icon: tier != null && tier >= 0 ? <NivelIcon level={tier} className={ico} /> : <Sparkles className={ico} strokeWidth={1.5} />,
  };
  const courses: Tab = { href: "/area/courses", label: "Mis cursos", icon: <LibroMagicoIcon className={ico} /> };
  // Web personal: «Mi energía» arriba (es el inicio) y, a la izquierda, sin «Mis compras».
  const left: Tab[] = personal
    ? [memberships, courses, { href: "/area/sessions", label: "Círculos y lecturas", icon: <LunaIcon className={ico} /> }]
    : [courses, { href: "/area/sessions", label: "Mis sesiones", icon: <LunaIcon className={ico} /> }, memberships, { href: "/area/purchases", label: "Mis compras", icon: <Receipt className={ico} strokeWidth={1.5} /> }];
  return (
    <div className="acc-frame">
      <TopLeft profile={profile} energy={personal} path={path} />
      <TopRight panel={hasPanel} />
      <LeftTabs items={left} path={path} />
      <Suspense fallback={<CornerTabs unseen={unseen} open={null} />}>
        <CornerTabsLive unseen={unseen} />
      </Suspense>
      <SettingsTab path={path} />
    </div>
  );
}

const isActive = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

/** Arriba a la izquierda: su foto y su nombre (abre su perfil) y la pestaña «Mi energía» (en el móvil, solo el icono). */
function TopLeft({ profile, energy, path }: { profile: ProfileInfo; energy: boolean; path: string }) {
  const t = useT();
  const on = isActive(path, ENERGY);
  return (
    <nav aria-label={t("Mi perfil e inicio")} className="acc-top-left fixed left-3 top-0 z-[46] flex items-start gap-1.5 sm:left-6">
      <ProfileMenu info={profile} />
      {energy && (
        <div className={`panel-side panel-tab panel-tab-top shrink-0 overflow-hidden rounded-b-2xl transition-transform ${on ? "" : "-translate-y-1 hover:translate-y-0"}`}>
          <Link href={ENERGY} aria-current={on ? "page" : undefined} title={t("Mi energía")} className="panel-nav-link flex items-center gap-2 px-3 pb-2.5 pt-3.5 text-xs font-medium sm:px-4 sm:text-sm">
            <EnergyIcon className="h-4 w-4 shrink-0" strokeWidth={1.4} />
            <span className="sr-only sm:not-sr-only"><Tr s={"Mi energía"} /></span>
          </Link>
        </div>
      )}
    </nav>
  );
}

/** Arriba a la derecha: «Mi panel» para quien también tiene panel de creadora; las alumnas, «Volver a la web». */
function TopRight({ panel }: { panel: boolean }) {
  const t = useT();
  return (
    <div className="panel-side panel-tab panel-tab-top fixed right-3 top-0 z-[44] overflow-hidden rounded-b-2xl sm:right-6">
      {panel ? (
        <Link href="/panel" title={t("Ir a mi panel de creadora")} className="panel-nav-link flex items-center gap-2 px-3 pb-2.5 pt-3.5 text-xs font-medium sm:px-4 sm:text-sm">
          <Store className="h-4 w-4 shrink-0" />
          <span className="sr-only sm:not-sr-only"><Tr s={"Mi panel"} /></span>
        </Link>
      ) : (
        <a href="/" title={t("Volver a la web")} className="panel-nav-link flex items-center gap-2 px-3 pb-2.5 pt-3.5 text-xs font-medium sm:px-4 sm:text-sm">
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span className="sr-only sm:not-sr-only"><Tr s={"Volver a la web"} /></span>
        </a>
      )}
    </div>
  );
}

/**
 * Borde izquierdo, a media altura: lo suyo (membresías, cursos, círculos y lecturas). En el ordenador, con el icono
 * arriba y el nombre debajo, medio escondidas tras el borde: al pasar por encima (o con el teclado) salen enteras.
 * En el móvil, solo el icono.
 */
function LeftTabs({ items, path }: { items: Tab[]; path: string }) {
  const t = useT();
  return (
    <nav aria-label={t("Lo tuyo")} className="pointer-events-none fixed left-0 top-1/2 z-40 flex max-h-[calc(100dvh-10.5rem)] -translate-y-1/2 flex-col gap-1.5 overflow-y-auto py-2 pr-4 [scrollbar-width:none]">
      {items.map((i) => {
        const active = isActive(path, i.href);
        return (
          <div
            key={i.href}
            className={`panel-side panel-tab panel-tab-left pointer-events-auto shrink-0 overflow-hidden rounded-r-2xl transition-transform duration-200 lg:w-[5.5rem] lg:-translate-x-7 lg:hover:translate-x-0 lg:focus-within:translate-x-0 ${active ? "" : "max-lg:-translate-x-1 max-lg:hover:translate-x-0"}`}
          >
            <Link href={i.href} aria-current={active ? "page" : undefined} title={t(i.label)} className="panel-nav-link relative flex flex-col items-center gap-2.5 px-2.5 py-3 lg:gap-1.5 lg:px-1.5 lg:pl-7">
              {i.icon}
              <span className="sr-only lg:not-sr-only lg:max-w-full lg:text-center lg:text-[0.7rem] lg:font-medium lg:leading-tight"><Tr s={i.label} /></span>
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

/** Abajo a la izquierda con la carpeta abierta (?abrir=…) encendida. */
function CornerTabsLive({ unseen }: { unseen: number }) {
  const path = usePathname();
  const open = useSearchParams().get("abrir");
  return <CornerTabs unseen={unseen} open={path.startsWith("/area/files") ? open ?? "favoritos" : null} />;
}

/** Abajo a la izquierda: Favoritos, Me gusta y Comentarios, saliendo del borde de abajo (en el móvil, solo los iconos). */
function CornerTabs({ unseen, open }: { unseen: number; open: string | null }) {
  const t = useT();
  const tabs = [
    { key: "favoritos", label: "Favoritos", icon: <Star className="h-4 w-4 shrink-0" strokeWidth={1.5} /> },
    { key: "me-gusta", label: "Me gusta", icon: <Heart className="h-4 w-4 shrink-0" strokeWidth={1.5} /> },
    { key: "comentarios", label: "Comentarios", icon: <MessageCircle className="h-4 w-4 shrink-0" strokeWidth={1.5} /> },
  ];
  return (
    <nav aria-label={t("Favoritos y comentarios")} className="fixed bottom-0 left-3 z-40 flex items-end gap-1.5 sm:left-6">
      {tabs.map((t) => {
        const active = open === t.key;
        const badge = t.key === "comentarios" && unseen > 0 ? unseen : 0;
        return (
          <div key={t.key} className={`panel-side panel-tab panel-tab-bottom overflow-hidden rounded-t-2xl transition-transform ${active ? "" : "translate-y-1 hover:translate-y-0"}`}>
            <Link
              href={`/area/files?abrir=${t.key}`}
              aria-current={active ? "page" : undefined}
              aria-label={badge ? `${t.label}: ${badge} avisos nuevos` : t.label}
              title={t.label}
              className="panel-nav-link flex items-center gap-2 px-3 pb-[calc(0.8rem+env(safe-area-inset-bottom))] pt-2.5 text-xs font-medium sm:px-4 sm:text-sm"
            >
              {t.icon}
              <span className="hidden md:inline"><Tr s={t.label} /></span>
              {badge > 0 && <span className="acc-badge !static">{badge > 99 ? "99+" : badge}</span>}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

/** Abajo a la derecha: «Ajustes», su página (colores, novedades por email, soporte y cerrar sesión). */
function SettingsTab({ path }: { path: string }) {
  const t = useT();
  const active = path.startsWith("/area/settings");
  return (
    <div className={`panel-side panel-tab panel-tab-bottom fixed bottom-0 right-3 z-40 overflow-hidden rounded-t-2xl transition-transform sm:right-6 ${active ? "" : "translate-y-1 hover:translate-y-0"}`}>
      <Link
        href="/area/settings"
        aria-current={active ? "page" : undefined}
        title={t("Ajustes")}
        className="panel-nav-link flex items-center gap-2 px-3 pb-[calc(0.8rem+env(safe-area-inset-bottom))] pt-2.5 text-xs font-medium sm:px-4 sm:text-sm"
      >
        <Settings className="h-4 w-4 shrink-0" strokeWidth={1.5} />
        <span className="sr-only sm:not-sr-only"><Tr s={"Ajustes"} /></span>
      </Link>
    </div>
  );
}
