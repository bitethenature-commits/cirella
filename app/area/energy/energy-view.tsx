"use client";

import { askConfirm } from "@/components/ui/ask-confirm";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import { ArrowLeft, ChevronDown, Pencil, Plus, Search, Trash2, UserRound } from "lucide-react";
import { AstrologyIcon } from "@/components/creator-page/astrology-icon";
import { EnergyIcon } from "@/components/creator-page/energy-icon";
import { GeneKeysIcon } from "@/components/creator-page/gene-keys-icon";
import { HumanDesignIcon } from "@/components/creator-page/human-design-icon";
import { MoonIcon } from "@/components/creator-page/moon-icon";
import { OracleSpreadIcon, RuneStonesIcon } from "@/components/creator-page/energy-tool-icons";
import { SystemIconMark } from "@/components/creator-page/system-icon";
import { BirthProfileEditor } from "@/components/models/birth-profile-editor";
import type { OracleDeckView } from "@/components/models/data/oracle";
import type { BirthProfile, ComputedProfile } from "@/lib/birth-profile";
import { BIRTH_RELATION_LABEL, longBirthDate, pickProfile, type SavedBirthProfile } from "@/lib/birth-profiles-rules";
import type { EnergySynthesis, EnergyToday } from "@/lib/energy-today";
import { deleteBirthProfile } from "./actions";
import { ENERGY_SYSTEMS, energyHref, type EnergySystemSlug, type EnergyView } from "./systems";
import { Tr, useT } from "@/lib/i18n/client";

/**
 * «Mi energía» en el navegador. Arriba, «Mis datos» (su perfil, o el formulario si aún no lo tiene) con el
 * selector de personas guardadas y «Añadir persona»; luego las burbujas del Oráculo y las Runas, los cuatro
 * sistemas y «Tu energía de hoy». Todo se calcula aquí (lib/birth-profile.ts y lib/energy-today.ts se
 * cargan aparte); del servidor solo llegan SUS perfiles y las barajas publicadas. La persona elegida va
 * en la dirección por su id (?perfil=…), nunca sus datos.
 */

function Loading({ label = "Calculando…" }: { label?: string }) {
  return (
    <div className="grid min-h-[16rem] place-items-center" aria-busy="true">
      <span className="cp-faint text-[0.85rem]"><Tr s={label} /></span>
    </div>
  );
}

const ChartModel = dynamic(() => import("@/components/models/chart-model").then((m) => m.ChartModel), { ssr: false, loading: () => <Loading /> });
const BodygraphModel = dynamic(() => import("@/components/models/bodygraph-model").then((m) => m.BodygraphModel), { ssr: false, loading: () => <Loading /> });
const GeneKeysModel = dynamic(() => import("@/components/models/gene-keys-model").then((m) => m.GeneKeysModel), { ssr: false, loading: () => <Loading /> });
const LunarModel = dynamic(() => import("@/components/models/lunar-model").then((m) => m.LunarModel), { ssr: false, loading: () => <Loading /> });
const OracleModel = dynamic(() => import("@/components/models/oracle-model").then((m) => m.OracleModel), { ssr: false, loading: () => <Loading label="Cargando el oráculo…" /> });
const RunesModel = dynamic(() => import("@/components/models/runes-model").then((m) => m.RunesModel), { ssr: false, loading: () => <Loading label="Cargando las runas…" /> });

type Energy = { computed: ComputedProfile; today: EnergyToday; synthesis: EnergySynthesis };

type Icon = ComponentType<SVGProps<SVGSVGElement>>;
/** El icono de cada sistema, el mismo que en la portada y en su página. */
const SYSTEM_ICON: Record<EnergySystemSlug, Icon> = { astrology: AstrologyIcon, "human-design": HumanDesignIcon, "gene-keys": GeneKeysIcon, moon: MoonIcon };

/** El perfil calculado y su energía de hoy (las efemérides se descargan solo aquí). */
function useEnergy(profile: BirthProfile | null): Energy | null {
  const key = profile ? JSON.stringify(profile) : "";
  const [state, setState] = useState<{ key: string; value: Energy } | null>(null);
  useEffect(() => {
    if (!key) return;
    let alive = true;
    Promise.all([import("@/lib/birth-profile"), import("@/lib/energy-today")]).then(([bp, et]) => {
      if (!alive) return;
      const computed = bp.computeAll(JSON.parse(key) as BirthProfile);
      const today = et.energyToday(computed);
      setState({ key, value: { computed, today, synthesis: et.energySynthesis(today) } });
    });
    return () => {
      alive = false;
    };
  }, [key]);
  return state?.key === key ? state.value : null;
}

const todayLabel = (d: Date) => new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(d);
const shortDate = (d: Date) => new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long" }).format(d);
const inDays = (n: number | null) => (n === null ? "—" : n === 0 ? "hoy" : n === 1 ? "mañana" : `en ${n} días`);
const fmtOrb = (deg: number) => {
  const m = Math.round(deg * 60);
  return `${Math.floor(m / 60)}°${String(m % 60).padStart(2, "0")}′`;
};

export function EnergyViewClient({ view, profiles, selectedId, decks }: { view: EnergyView; profiles: SavedBirthProfile[]; selectedId: string | null; decks: OracleDeckView[] }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const selected = pickProfile(profiles, selectedId);
  const own = profiles.find((p) => p.isOwn) ?? null;
  const [mode, setMode] = useState<"view" | "edit" | "add">("view");
  const energy = useEnergy(selected);

  const go = (id: string | null) => {
    setMode("view");
    router.replace(id ? `${pathname}?perfil=${encodeURIComponent(id)}` : pathname, { scroll: false });
    router.refresh();
  };

  if (view === "oracle" || view === "runes") return <ToolView view={view} decks={decks} profileId={selected?.id ?? null} />;

  const system = view === "inicio" ? null : ENERGY_SYSTEMS.find((s) => s.slug === view)!;

  return (
    <div className="space-y-8">
      {system && (
        <Link href={energyHref("inicio", selected?.id)} className="cp-muted inline-flex min-h-10 items-center gap-1.5 text-[0.85rem]">
          <ArrowLeft className="h-4 w-4" />{" "}<Tr s={"Mi energía"} /></Link>
      )}

      {/* 1 · Mis datos */}
      <section aria-labelledby="mis-datos">
        <div className="flex items-end justify-between gap-3">
          <h2 id="mis-datos" className="cp-display text-[1.6rem] leading-tight"><Tr s={"Mis datos"} /></h2>
          {profiles.length > 0 && <PersonPicker profiles={profiles} selected={selected} onPick={(p) => go(p.id)} onAdd={() => setMode("add")} />}
        </div>

        <div className="mt-4">
          {!own && mode === "view" && (
            <div className="mb-4">
              <BirthProfileEditor key="own" mode="save" own title={t("Tus datos de nacimiento")} submitLabel={t("Guardar mis datos")} autoFocus={false} onDone={(_, saved) => go(saved?.id ?? null)} />
            </div>
          )}
          {mode === "add" && <BirthProfileEditor key="add" mode="save" own={!own} title={t("Añadir persona")} onCancel={() => setMode("view")} onDone={(_, saved) => go(saved?.id ?? null)} />}
          {mode === "edit" && selected && (
            <BirthProfileEditor key={`edit-${selected.id}`} mode="save" initial={selected} onCancel={() => setMode("view")} onDone={(_, saved) => go(saved?.id ?? selected.id)} />
          )}
          {mode === "view" && selected && <ProfileCard profile={selected} onEdit={() => setMode("edit")} onDeleted={() => go(null)} />}
        </div>
        {profiles.length === 0 && mode === "view" && (
          <p className="cp-faint mt-3 text-[0.78rem]"><Tr s={"Cuando los guardes podrás calcular tu carta, tu diseño, tus llaves y tu luna, y añadir a otras personas."} /></p>
        )}
      </section>

      {view === "inicio" && (
        <>
          {/* 2 · Los cuatro sistemas: como en la web, un icono y su nombre debajo, sin cajas ni título */}
          <ul aria-label={t("Tus sistemas")} className="grid grid-cols-4 gap-x-2 gap-y-6 pt-2">
            {ENERGY_SYSTEMS.map((s) => (
              <li key={s.slug}>
                <SystemIconLink
                  label={t(s.label)}
                  icon={SYSTEM_ICON[s.slug]}
                  hint={selected ? (systemHint(s.slug, energy) ?? s.blurb) : s.blurb}
                  href={energyHref(s.slug, selected?.id)}
                  disabled={!selected}
                />
              </li>
            ))}
          </ul>

          {/* 3 · Oráculo y Runas */}
          <section aria-label={t("Oráculo y runas")} className="flex justify-center gap-8 sm:gap-12">
            <Bubble href={energyHref("oracle", selected?.id)} label={t("Oráculo")} icon={OracleSpreadIcon} />
            <Bubble href={energyHref("runes", selected?.id)} label={t("Runas")} icon={RuneStonesIcon} />
          </section>

          {/* 4 · Tu energía de hoy, junta */}
          {selected && <CombinedToday energy={energy} name={selected.isOwn ? null : selected.name} profileId={selected.id} />}
        </>
      )}

      {system && selected && (
        <>
          <nav aria-label={t("Sistemas")} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {ENERGY_SYSTEMS.map((s) => (
              <Link
                key={s.slug}
                href={energyHref(s.slug, selected.id)}
                aria-current={s.slug === system.slug ? "page" : undefined}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[0.82rem] transition ${s.slug === system.slug ? "border-[var(--c-gold)] bg-[color-mix(in_oklab,var(--c-gold)_14%,transparent)]" : "cp-line cp-muted"}`}
              >
                <SystemIconMark icon={SYSTEM_ICON[s.slug]} scale={0.42} />
                <Tr s={s.label} />
              </Link>
            ))}
          </nav>
          <section aria-label={t(system.label)}>
            {system.slug === "astrology" && <ChartModel profile={selected} ownForm={false} />}
            {system.slug === "human-design" && (energy ? <BodygraphModel computed={energy.computed} planets /> : <Loading />)}
            {system.slug === "gene-keys" && (energy ? <GeneKeysModel computed={energy.computed} /> : <Loading />)}
            {system.slug === "moon" && <LunarModel profile={selected} ownForm={false} />}
          </section>
          <SystemToday slug={system.slug} energy={energy} />
        </>
      )}
      {system && !selected && <p className="cp-muted text-[0.9rem]"><Tr s={"Guarda tus datos arriba para ver tu"} />{" "}<Tr s={system.label === "Luna" ? "moon" : "carta"} />.</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 *  Mis datos
 * -------------------------------------------------------------------------- */

function ProfileCard({ profile, onEdit, onDeleted }: { profile: SavedBirthProfile; onEdit: () => void; onDeleted: () => void }) {
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="cp-card p-4 sm:p-5" data-profile={profile.id}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="cp-display text-[1.35rem] leading-tight"><Tr s={profile.name} /></span>
            <span className="cp-tag">{profile.isOwn ? t("Yo") : profile.relation ? BIRTH_RELATION_LABEL[profile.relation] : t("Otra persona")}</span>
          </p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.85rem]">
            <dt className="cp-muted"><Tr s={"Fecha"} /></dt>
            <dd>{longBirthDate(profile.date)}</dd>
            <dt className="cp-muted"><Tr s={"Hora"} /></dt>
            <dd><Tr s={profile.time ?? t("No se sabe")} /></dd>
            <dt className="cp-muted"><Tr s={"Lugar"} /></dt>
            <dd className="min-w-0 truncate">
              <Tr s={profile.place.name} />
              {profile.place.detail && profile.place.detail !== "Coordenadas" ? <span className="cp-muted"> · <Tr s={profile.place.detail} /></span> : null}
            </dd>
          </dl>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <button type="button" onClick={onEdit} className="cp-btn-ghost !min-h-9 !px-3 !text-[0.8rem]">
            <Pencil className="h-3.5 w-3.5" />{" "}<Tr s={"Editar"} /></button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (!(await askConfirm(`¿Borrar los datos de ${profile.name}? Se borran del todo y no se pueden recuperar.`))) return;
              setBusy(true);
              const r = await deleteBirthProfile(profile.id);
              setBusy(false);
              if (r.ok) onDeleted();
              else setError(r.error);
            }}
            className="cp-btn-ghost !min-h-9 !px-3 !text-[0.8rem]"
          >
            <Trash2 className="h-3.5 w-3.5" /> {busy ? t("Borrando…") : t("Borrar")}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-[0.82rem]" style={{ color: "#D0584F" }}>
          <Tr s={error} />
        </p>
      )}
    </div>
  );
}

/** Selector de personas: buscar entre las guardadas, elegir una o añadir otra. */
function PersonPicker({ profiles, selected, onPick, onAdd }: { profiles: SavedBirthProfile[]; selected: SavedBirthProfile | null; onPick: (p: SavedBirthProfile) => void; onAdd: () => void }) {
  const t = useT();
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const list = useMemo(() => {
    const f = q.trim().toLocaleLowerCase("es");
    return f ? profiles.filter((p) => p.name.toLocaleLowerCase("es").includes(f)) : profiles;
  }, [profiles, q]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const listId = `${uid}-list`;
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="listbox" className="cp-btn-ghost !min-h-10 !px-3.5 !text-[0.85rem]">
        <UserRound className="h-4 w-4" /> <span className="max-w-[9rem] truncate"><Tr s={selected?.name ?? t("Personas")} /></span> <ChevronDown className="h-4 w-4" />
      </button>
      {open && (
        <div className="cp-line absolute right-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-3rem))] rounded-[min(var(--r-card),18px)] border p-2 shadow-xl" style={{ background: "var(--c-bg)" }}>
          <label className="relative block">
            <span className="sr-only"><Tr s={"Buscar persona"} /></span>
            <Search className="cp-faint pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(list.length - 1, a + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(0, a - 1));
                } else if (e.key === "Enter" && list[active]) {
                  e.preventDefault();
                  setOpen(false);
                  onPick(list[active]);
                } else if (e.key === "Escape") setOpen(false);
              }}
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={list[active] ? `${listId}-${active}` : undefined}
              placeholder={t("Buscar persona")}
              className="cp-input !h-10 !pl-9 !text-[0.9rem]"
              autoComplete="off"
            />
          </label>
          <ul id={listId} role="listbox" aria-label={t("Personas guardadas")} className="mt-1 max-h-64 overflow-auto">
            {list.map((p, i) => (
              <li
                key={p.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={p.id === selected?.id}
                onMouseEnter={() => setActive(i)}
                onClick={() => {
                  setOpen(false);
                  onPick(p);
                }}
                className={`flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-lg px-3 text-[0.9rem] ${i === active ? "bg-[color-mix(in_oklab,var(--c-gold)_12%,transparent)]" : ""}`}
              >
                <span className="truncate">
                  <Tr s={p.name} />
                  {p.id === selected?.id && <span className="cp-gold"> ·</span>}
                </span>
                <span className="cp-faint shrink-0 text-[0.75rem]">{p.isOwn ? t("Yo") : p.relation ? BIRTH_RELATION_LABEL[p.relation] : ""}</span>
              </li>
            ))}
            {list.length === 0 && <li className="cp-muted px-3 py-2 text-[0.85rem]"><Tr s={"Nadie con ese nombre."} /></li>}
          </ul>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onAdd();
            }}
            className="cp-line mt-1 flex min-h-11 w-full items-center gap-2 border-t px-3 pt-1 text-[0.9rem] font-medium"
          >
            <Plus className="h-4 w-4" />{" "}<Tr s={"Añadir persona"} /></button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 *  Burbujas, sistemas y herramientas
 * -------------------------------------------------------------------------- */

function Bubble({ href, label, icon: Icon }: { href: string; label: string; icon: Icon }) {
  return (
    <Link href={href} className="group flex flex-col items-center gap-1.5 text-center">
      {/* Sin círculo: el dibujo dorado suelto, con un brillo suave, que sube un poco al pasar por encima. */}
      <Icon
        aria-hidden
        className="cp-gold h-24 w-24 transition-transform duration-300 group-hover:-translate-y-1 group-active:scale-[0.97] sm:h-28 sm:w-28"
        strokeWidth={1.1}
        style={{ filter: "drop-shadow(0 6px 14px color-mix(in oklab, var(--c-gold) 35%, transparent))" }}
      />
      <span className="cp-display text-[1.15rem]"><Tr s={label} /></span>
    </Link>
  );
}

/** Un sistema como en la web: el icono dorado y su nombre debajo, sin caja. Sin datos guardados sale tenue. */
function SystemIconLink({ label, icon: Icon, hint, href, disabled }: { label: string; icon: Icon; hint: string; href: string; disabled: boolean }) {
  // Los redondos (carta astral, luna) llenan su cuadrado: algo más pequeños para que pesen como los demás.
  const round = Icon === AstrologyIcon || Icon === MoonIcon;
  const body = (
    <>
      <span className="grid h-14 w-14 place-items-center">
        <Icon className={`cp-gold shrink-0 transition-transform duration-300 group-hover:-translate-y-1 ${round ? "h-11 w-11" : "h-[3.25rem] w-[3.25rem]"}`} strokeWidth={1.05} aria-hidden />
      </span>
      <span className="cp-display text-[1.05rem] leading-tight sm:text-[1.2rem]"><Tr s={label} /></span>
    </>
  );
  if (disabled)
    return (
      <span className="flex flex-col items-center gap-2 text-center opacity-50" aria-disabled title={hint}>
        {body}
      </span>
    );
  return (
    <Link href={href} className="group flex flex-col items-center gap-2 text-center" title={hint}>
      {body}
    </Link>
  );
}

function systemHint(slug: EnergySystemSlug, e: Energy | null): string | null {
  if (!e) return null;
  const t = e.today;
  switch (slug) {
    case "astrology":
      return t.astro.transits.length ? `${t.astro.transits.length} tránsito${t.astro.transits.length === 1 ? "" : "s"} hoy · Luna en ${t.astro.moon.sign}` : `Luna en ${t.astro.moon.sign}`;
    case "human-design":
      return `Sol en la puerta ${t.hd.sun.gate}.${t.hd.sun.line}${t.hd.channels.length ? ` · ${t.hd.channels.length} canal${t.hd.channels.length === 1 ? "" : "es"} hoy` : ""}`;
    case "gene-keys":
      return `Llave ${t.gk.key} · ${t.gk.gift}`;
    case "moon":
      return `${t.moon.phase} en ${t.moon.sign}`;
  }
}

function ToolView({ view, decks, profileId }: { view: "oracle" | "runes"; decks: OracleDeckView[]; profileId: string | null }) {
  const t = useT();
  const [deckId, setDeckId] = useState(decks[0]?.id ?? "");
  const deck = decks.find((d) => d.id === deckId) ?? null;
  return (
    <div className="space-y-6">
      <Link href={energyHref("inicio", profileId)} className="cp-muted inline-flex min-h-10 items-center gap-1.5 text-[0.85rem]">
        <ArrowLeft className="h-4 w-4" />{" "}<Tr s={"Mi energía"} /></Link>
      <h2 className="cp-display text-[1.9rem] leading-tight">{view === "oracle" ? t("Oráculo") : t("Runas")}</h2>
      {view === "oracle" && decks.length > 1 && (
        <label className="block max-w-sm">
          <span className="cp-eyebrow mb-1.5 block !text-[0.6rem]"><Tr s={"Baraja"} /></span>
          <select value={deckId} onChange={(e) => setDeckId(e.target.value)} className="cp-input !h-11 [&_option]:bg-[var(--c-bg)]">
            {decks.map((d) => (
              <option key={d.id ?? "serie"} value={d.id ?? ""}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {view === "oracle" ? <OracleModel key={deck?.id ?? "serie"} deck={deck} /> : <RunesModel />}
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 *  Tu energía de hoy
 * -------------------------------------------------------------------------- */

function TodayFrame({ title = "Tu energía de hoy", at, children }: { title?: string; at: Date | null; children: ReactNode }) {
  const t = useT();
  return (
    <section aria-labelledby="hoy" className="cp-card p-5 sm:p-6">
      <p className="cp-eyebrow !text-[0.6rem]">{at ? todayLabel(at) : t("Hoy")}</p>
      <h2 id="hoy" className="cp-display mt-1 flex items-center gap-3 text-[1.7rem] leading-tight">
        <SystemIconMark icon={EnergyIcon} scale={0.8} />
        <span><Tr s={title} /></span>
      </h2>
      <div className="mt-4 space-y-4 text-[0.92rem] leading-relaxed">{children}</div>
    </section>
  );
}

function Block({ label, icon, children }: { label: string; icon?: Icon; children: ReactNode }) {
  return (
    <div className="border-l-2 pl-3" style={{ borderColor: "color-mix(in oklab, var(--c-gold) 55%, transparent)" }}>
      <p className="cp-eyebrow flex items-center gap-1.5 !text-[0.58rem]">
        {icon && <SystemIconMark icon={icon} scale={0.38} />}
        <Tr s={label} />
      </p>
      <div className="mt-1 space-y-1.5">{children}</div>
    </div>
  );
}

function CombinedToday({ energy, name, profileId }: { energy: Energy | null; name: string | null; profileId: string }) {
  const t = useT();
  if (!energy)
    return (
      <TodayFrame at={null}>
        <p className="cp-faint"><Tr s={"Calculando el cielo de hoy…"} /></p>
      </TodayFrame>
    );
  const s = energy.synthesis;
  return (
    <TodayFrame at={energy.today.at} title={name ? `La energía de hoy para ${name}` : t("Tu energía de hoy")}>
      {s.lines.map((l) => (
        <Block key={l.system} label={t(l.label)} icon={SYSTEM_ICON[l.system]}>
          <p><Tr s={l.text} /></p>
          <Link href={energyHref(l.system, profileId)} className="cp-gold text-[0.8rem] underline decoration-dotted underline-offset-4"><Tr s={"Ver más"} /></Link>
        </Block>
      ))}
      <p className="cp-display pt-1 text-[1.15rem] leading-snug"><Tr s={s.overall} /></p>
    </TodayFrame>
  );
}

function SystemToday({ slug, energy }: { slug: EnergySystemSlug; energy: Energy | null }) {
  const [all, setAll] = useState(false);
  if (!energy)
    return (
      <TodayFrame at={null}>
        <p className="cp-faint"><Tr s={"Calculando el cielo de hoy…"} /></p>
      </TodayFrame>
    );
  const t = energy.today;

  if (slug === "astrology") {
    const shown = all ? t.astro.transits : t.astro.transits.slice(0, 4);
    return (
      <TodayFrame at={t.at}>
        <Block label={`La Luna hoy · en ${t.astro.moon.sign}`}>
          <p><Tr s={t.astro.moon.signText} /></p>
          {t.astro.moon.houseText ? <p><Tr s={t.astro.moon.houseText} /></p> : <p className="cp-muted"><Tr s={"Sin hora de nacimiento no hay casas: el signo de la Luna es lo que cuenta hoy."} /></p>}
        </Block>
        {t.astro.transits.length === 0 ? (
          <Block label="Tránsitos">
            <p><Tr s={"Hoy ningún planeta forma un aspecto exacto con tu carta. Un día tranquilo de fondo: buen momento para lo de siempre, hecho con calma."} /></p>
          </Block>
        ) : (
          <Block label="Tránsitos a tu carta">
            <ul className="space-y-3">
              {shown.map((x) => (
                <li key={`${x.transit}-${x.natal}-${x.aspect}`}>
                  <p className="font-semibold"><Tr s={x.title} /></p>
                  <p className="cp-faint text-[0.75rem]">
                    a {fmtOrb(x.orb)} · {x.applying ? <Tr s={"se está formando"} /> : <Tr s={"se va deshaciendo"} />} · <Tr s={x.nature} />
                  </p>
                  <p className="mt-0.5"><Tr s={x.text} /></p>
                  <p className="cp-muted mt-0.5 text-[0.85rem]"><Tr s={x.tip} /></p>
                </li>
              ))}
            </ul>
            {t.astro.transits.length > 4 && (
              <button type="button" onClick={() => setAll(!all)} className="cp-gold mt-2 min-h-9 text-[0.82rem] underline decoration-dotted underline-offset-4">
                {all ? <Tr s={"Ver menos"} /> : `Ver los ${t.astro.transits.length}`}
              </button>
            )}
          </Block>
        )}
      </TodayFrame>
    );
  }

  if (slug === "human-design") {
    const hd = t.hd;
    return (
      <TodayFrame at={t.at}>
        <Block label="Las puertas de hoy">
          <p>
            <strong><Tr s={"Sol"} /></strong>{" "}<Tr s={"en la"} />{" "}{hd.sun.gate}.{hd.sun.line}: {hd.gateText(hd.sun.gate)}
          </p>
          <p>
            <strong><Tr s={"Tierra"} /></strong>{" "}<Tr s={"en la"} />{" "}{hd.earth.gate}.{hd.earth.line}: {hd.gateText(hd.earth.gate)}
          </p>
          <p>
            <strong><Tr s={"Luna"} /></strong>{" "}<Tr s={"en la"} />{" "}{hd.moon.gate}: {hd.gateText(hd.moon.gate)}
          </p>
        </Block>
        {hd.resonant.length > 0 && (
          <Block label="Suena más fuerte">
            {hd.resonant.map((r) => (
              <p key={`${r.body}-${r.gate}`}>
                {r.body === "sun" ? <Tr s={"El Sol"} /> : r.body === "earth" ? <Tr s={"La Tierra"} /> : <Tr s={"La Luna"} />}{" "}<Tr s={"pasa por tu puerta"} />{" "}{r.gate} (<Tr s={r.name} /><Tr s={"): algo que ya es tuyo se oye hoy más alto."} /></p>
            ))}
          </Block>
        )}
        <Block label="Lo que se define hoy en tu carta">
          {hd.channels.length === 0 ? (
            <p><Tr s={"Hoy el Sol, la Tierra y la Luna no completan ningún canal tuyo. Tu carta se vive tal cual: un buen día para notar cómo eres sin préstamos."} /></p>
          ) : (
            hd.channels.map((c) => <p key={`${c.channel.a}-${c.channel.b}`}><Tr s={c.text} /></p>)
          )}
          {hd.newCentres.length > 0 && (
            <>
              <p>{hd.newCentres.length === 1 ? <Tr s={"Tu centro abierto que hoy se define:"} /> : <Tr s={"Tus centros abiertos que hoy se definen:"} />}</p>
              <ul className="space-y-1">
                {hd.newCentres.map((c) => (
                  <li key={c.id}>
                    <strong><Tr s={c.name} /></strong> · <Tr s={c.text} />
                  </li>
                ))}
              </ul>
              <p className="cp-muted text-[0.85rem]"><Tr s={"Puede sentirse más fuerte o más constante de lo habitual, pero es prestado: no hace falta decidir desde ahí."} /></p>
            </>
          )}
        </Block>
        <p className="cp-muted text-[0.85rem]"><Tr s={"Lo que traen los tránsitos es temporal. Tu estrategia sigue siendo la misma:"} />{" "}{hd.strategy.charAt(0).toLowerCase() + hd.strategy.slice(1)}{" "}<Tr s={"Tu autoridad:"} />{" "}{hd.authority.toLowerCase()}.
        </p>
      </TodayFrame>
    );
  }

  if (slug === "gene-keys") {
    const gk = t.gk;
    return (
      <TodayFrame at={t.at}>
        <Block label={`La llave del día · ${gk.key}.${gk.line}`}>
          <div className="grid grid-cols-3 gap-2 text-center">
            {(
              [
                ["Sombra", gk.shadow],
                ["Don", gk.gift],
                ["Siddhi", gk.siddhi],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="cp-line rounded-xl border px-2 py-3">
                <p className="cp-eyebrow !text-[0.55rem]"><Tr s={k} /></p>
                <p className="cp-display mt-1 text-[1.05rem] leading-tight"><Tr s={v} /></p>
              </div>
            ))}
          </div>
          <p className="pt-1"><Tr s={gk.text} /></p>
          <p className="cp-muted text-[0.85rem]"><Tr s={"El Sol sigue en esta llave"} />{" "}{gk.daysLeft <= 1 ? <Tr s={"un día más, más o menos"} /> : `unos ${gk.daysLeft} días más`}<Tr s={"; enfrente, la Tierra lleva la Llave"} />{" "}{gk.earthKey}.
          </p>
        </Block>
        <Block label="En tu perfil">
          {gk.spheres.length ? (
            gk.spheres.map((s) => (
              <p key={s.id}><Tr s={"Coincide con tu"} />{" "}<strong><Tr s={s.name} /></strong><Tr s={". Es un buen día para contemplarla:"} />{" "}<Tr s={s.contemplation} />
              </p>
            ))
          ) : (
            <p><Tr s={"No coincide con ninguna de tus esferas: vívela como un clima compartido y observa qué despierta en ti."} /></p>
          )}
        </Block>
      </TodayFrame>
    );
  }

  const m = t.moon;
  return (
    <TodayFrame at={t.at}>
      <Block label={`${m.phase} · ${Math.round(m.illum * 100)} % iluminada`}>
        <p>
          <strong><Tr s={m.intent} />.</strong> <Tr s={m.practice} />
        </p>
      </Block>
      <Block label={`La Luna en ${m.sign}`}>
        <p><Tr s={m.signText} /></p>
      </Block>
      <Block label={`Con tu Luna natal en ${m.natalSign}${m.natalSignUnsure ? " (sin hora, aproximada)" : ""}`}>
        <p><Tr s={m.relation} /></p>
        {m.houseText && <p><Tr s={m.houseText} /></p>}
      </Block>
      <Block label="Próximas fechas">
        <ul className="space-y-1">
          <li><Tr s={"Tu retorno lunar:"} />{" "}<strong>{inDays(m.daysToReturn)}</strong>
            {m.returnAt && m.daysToReturn !== null && m.daysToReturn > 1 ? ` (${shortDate(m.returnAt)})` : ""}
          </li>
          <li><Tr s={"Luna nueva:"} />{" "}<strong>{inDays(m.daysToNew)}</strong>
            {m.nextNew && m.daysToNew !== null && m.daysToNew > 1 ? ` (${shortDate(m.nextNew)})` : ""}
          </li>
          <li><Tr s={"Luna llena:"} />{" "}<strong>{inDays(m.daysToFull)}</strong>
            {m.nextFull && m.daysToFull !== null && m.daysToFull > 1 ? ` (${shortDate(m.nextFull)})` : ""}
          </li>
        </ul>
      </Block>
    </TodayFrame>
  );
}
