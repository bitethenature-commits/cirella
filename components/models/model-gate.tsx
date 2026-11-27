"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowUpRight, Lock, Sparkles, UserRound } from "lucide-react";
import { NewsletterUnlockForm } from "@/components/creator-page/portal-section";
import type { BirthProfile } from "@/lib/birth-profile";
import { profileSummary } from "@/lib/birth-profiles-rules";
import { BirthProfileEditor } from "./birth-profile-editor";
import { cn } from "./model-kit";
import { ENERGY_PATH, ModelGateScope, useModelGate, type GatedModel, type ModelGateInfo, type ModelGateState } from "./model-gate-scope";
import { Tr, useT } from "@/lib/i18n/client";

export type { GatedModel, ModelGateInfo } from "./model-gate-scope";

/**
 * «Calcular con mis datos» de los modelos calculados (carta natal, Diseño Humano, Gene Keys, Luna) en
 * las páginas de los métodos. El ejemplo lo ve todo el mundo; calcular con datos propios, solo quien
 * ha entrado en su cuenta Y es suscriptora confirmada de la newsletter (la regla del Portal de Noticias,
 * que comprueba el servidor en /api/mi-energia: la página está cacheada y no sabe quién mira).
 *
 *   · Sin acceso: «Regístrate y suscríbete a la newsletter para calcular tu carta» y, al pulsar, el
 *     mismo formulario del portal, que vuelve a esta página.
 *   · Con acceso y sus datos guardados en «Mi energía»: se aplican solos, con «Usar otros datos» (otra
 *     persona guardada o datos nuevos) y «Ver el ejemplo».
 *   · Con acceso y sin datos guardados: el formulario, con la opción de guardarlos.
 *
 * Dos colocaciones: `inside` (la de siempre, una franja encima del modelo, dentro de su caja) y `below`
 * (versión rápida: el botón centrado debajo de la caja, con el enlace a la versión completa de «Mi
 * energía»). El estado vive en ModelGateScope (model-gate-scope.tsx).
 */

const NOUN: Record<GatedModel, string> = {
  chart: "tu carta",
  bodygraph: "tu carta de Diseño Humano",
  geneKeys: "tu perfil de Gene Keys",
  lunar: "tu luna natal",
};

/** El modelo de siempre con su franja encima (lo usan los bloques sin «Versión rápida»). */
export function ModelGate({ model, gate, children }: { model: GatedModel; gate: ModelGateInfo; children: (profile: BirthProfile | undefined) => ReactNode }) {
  return (
    <ModelGateScope model={model} gate={gate}>
      <ModelGateBar variant="inside" />
      <GatedChildren>{children}</GatedChildren>
    </ModelGateScope>
  );
}

function GatedChildren({ children }: { children: (profile: BirthProfile | undefined) => ReactNode }) {
  const g = useModelGate();
  return <>{children(g?.active?.profile)}</>;
}

/** La barra de «Calcular con mis datos» (dentro de un ModelGateScope). */
export function ModelGateBar({ variant = "inside" }: { variant?: "inside" | "below" }) {
  const g = useModelGate();
  const anchor = g ? `calcular-${g.model}` : "calcular";
  /** Adónde vuelve el enlace del email: esta página, a la altura del modelo. */
  const [next, setNext] = useState<string>();
  useEffect(() => setNext(`${window.location.pathname}#${anchor}`), [anchor]);
  if (!g) return null;
  return variant === "below" ? <BelowBar g={g} anchor={anchor} next={next} /> : <InsideBar g={g} anchor={anchor} next={next} />;
}

function InsideBar({ g, anchor, next }: { g: ModelGateState; anchor: string; next?: string }) {
  const { access, unlocked, active, panel, setPanel, own, profiles, choose } = g;
  const noun = NOUN[g.model];

  let bar: ReactNode;
  if (access === "loading") bar = <p className="cp-faint text-[0.8rem]"><Tr s={"Ejemplo · comprobando si puedes calcular con tus datos…"} /></p>;
  else if (!unlocked) {
    bar = (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex min-w-0 items-start gap-2 text-[0.88rem] leading-snug">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            <strong className="font-semibold"><Tr s={"Regístrate y suscríbete a la newsletter para calcular"} />{" "}<Tr s={noun} />.</strong> <span className="cp-muted"><Tr s={"Mientras, aquí tienes el ejemplo."} /></span>
          </span>
        </p>
        {panel !== "subscribe" && (
          <button type="button" className="cp-btn !min-h-10 !text-[0.85rem]" onClick={() => setPanel("subscribe")}><Tr s={"Calcular con mis datos"} /></button>
        )}
      </div>
    );
  } else if (active) {
    bar = (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 text-[0.88rem] leading-snug">
          <span className="cp-eyebrow !text-[0.58rem]"><Tr s={"Con tus datos"} /></span>
          <span className="mt-0.5 block font-semibold"><Tr s={active.profile.name} /></span>
          <span className="cp-muted block text-[0.8rem]">{profileSummary(active.profile)}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="cp-btn-ghost !min-h-10 !text-[0.85rem]" onClick={() => setPanel(panel === "choose" ? "none" : "choose")} aria-expanded={panel === "choose"}><Tr s={"Usar otros datos"} /></button>
          <button type="button" className="cp-btn-ghost !min-h-10 !text-[0.85rem]" onClick={() => choose(null)}><Tr s={"Ver el ejemplo"} /></button>
        </div>
      </div>
    );
  } else {
    bar = (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="cp-muted flex items-center gap-2 text-[0.85rem]">
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden />{" "}<Tr s={"Estás viendo el ejemplo."} /></p>
        {panel === "none" && (
          <button
            type="button"
            className="cp-btn !min-h-10 !text-[0.85rem]"
            onClick={() => {
              if (own) choose({ id: own.id, profile: own });
              else setPanel(profiles.length ? "choose" : "form");
            }}
          ><Tr s={"Calcular con mis datos"} /></button>
        )}
      </div>
    );
  }

  return (
    <div
      id={anchor}
      className="mb-5 scroll-mt-24 rounded-[calc(var(--r-card)*0.7)] border px-4 py-3"
      style={{
        borderColor: "color-mix(in oklab, var(--c-gold) 30%, transparent)",
        background: "color-mix(in oklab, var(--c-gold) 5%, transparent)",
      }}
      data-gate={access === "loading" ? "loading" : unlocked ? "unlocked" : "locked"}
    >
      {bar}
      <GatePanels g={g} anchor={anchor} next={next} />
    </div>
  );
}

/** Versión rápida: debajo de la caja del modelo, centrado. */
function BelowBar({ g, anchor, next }: { g: ModelGateState; anchor: string; next?: string }) {
  const { access, unlocked, active, panel, setPanel, own, profiles, choose } = g;
  const noun = NOUN[g.model];
  const full = active?.id ? `${ENERGY_PATH[g.model]}?perfil=${encodeURIComponent(active.id)}` : ENERGY_PATH[g.model];
  const fullLink = (
    <Link href={full} className="cp-gold inline-flex min-h-10 items-center gap-1 text-[0.85rem] underline decoration-dotted underline-offset-4"><Tr s={"Ver la versión completa en Mi energía"} />{" "}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
    </Link>
  );

  let bar: ReactNode;
  if (access === "loading") bar = <p className="cp-faint min-h-10 content-center text-[0.8rem]"><Tr s={"Comprobando si puedes calcular con tus datos…"} /></p>;
  else if (!unlocked)
    bar = (
      <>
        {panel !== "subscribe" && (
          <button type="button" className="cp-btn" onClick={() => setPanel("subscribe")}><Tr s={"Calcular con mis datos"} /></button>
        )}
        <p className="cp-muted mt-2 flex max-w-md items-start justify-center gap-1.5 text-[0.82rem] leading-snug">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span><Tr s={"Para calcular"} />{" "}<Tr s={noun} /><Tr s={", regístrate y suscríbete a la newsletter. Mientras, arriba tienes el ejemplo."} /></span>
        </p>
      </>
    );
  else if (active)
    bar = (
      <>
        <p className="text-[0.88rem] leading-snug">
          <span className="cp-eyebrow !text-[0.58rem]"><Tr s={"Con tus datos ·"} />{" "}</span>
          <span className="font-semibold"><Tr s={active.profile.name} /></span>
          <span className="cp-muted block text-[0.8rem]">{profileSummary(active.profile)}</span>
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <button type="button" className="cp-btn-ghost !min-h-10 !text-[0.85rem]" onClick={() => setPanel(panel === "choose" ? "none" : "choose")} aria-expanded={panel === "choose"}><Tr s={"Usar otros datos"} /></button>
          <button type="button" className="cp-btn-ghost !min-h-10 !text-[0.85rem]" onClick={() => choose(null)}><Tr s={"Ver el ejemplo"} /></button>
        </div>
        <div className="mt-1">{fullLink}</div>
      </>
    );
  else
    bar = (
      <>
        {panel === "none" && (
          <button
            type="button"
            className="cp-btn"
            onClick={() => {
              if (own) choose({ id: own.id, profile: own });
              else setPanel(profiles.length ? "choose" : "form");
            }}
          ><Tr s={"Calcular con mis datos"} /></button>
        )}
        <div className="mt-1">{fullLink}</div>
      </>
    );

  return (
    <div id={anchor} className="flex scroll-mt-24 flex-col items-center text-center" data-gate={access === "loading" ? "loading" : unlocked ? "unlocked" : "locked"} data-gate-below="">
      {bar}
      <div className="w-full text-left">
        <GatePanels g={g} anchor={anchor} next={next} framed />
      </div>
    </div>
  );
}

function GatePanels({ g, anchor, next, framed }: { g: ModelGateState; anchor: string; next?: string; framed?: boolean }) {
  const t = useT();
  // Debajo de la caja (versión rápida), los paneles van en su propia tarjeta.
  const box = framed ? "cp-card mt-4 p-5 sm:p-6" : "mt-4";
  const { access, unlocked, active, panel, setPanel, own, profiles, choose, refresh, gate } = g;
  const noun = NOUN[g.model];
  return (
    <>
      {panel === "subscribe" && !unlocked && access !== "loading" && (
        <div className="mt-4">
          <NewsletterUnlockForm
            id={`${anchor}-form`}
            what={`calcular ${noun}`}
            label={`Suscríbete para calcular ${noun}`}
            access={access}
            creatorName={gate.creatorName}
            privacyHref={gate.privacyHref}
            next={next}
            via="carta"
            signedInHint={`Solo falta que te apuntes a la newsletter para calcular ${noun}.`}
            sentHint="vuelves aquí para calcular con tus datos"
            footerHint="vuelves a esta página"
            onUnlocked={() => {
              setPanel("none");
              void refresh(true);
            }}
          />
        </div>
      )}

      {panel === "choose" && unlocked && (
        <div className={box}>
          {profiles.length > 0 && (
            <>
              <p className="cp-eyebrow !text-[0.58rem]"><Tr s={"Tus personas guardadas"} /></p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {profiles.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => choose({ id: p.id, profile: p })}
                      aria-pressed={active?.id === p.id}
                      className={cn("cp-btn-ghost !min-h-9 !px-3.5 !text-[0.82rem]", active?.id === p.id && "!border-[var(--c-gold)]")}
                    >
                      <UserRound className="h-3.5 w-3.5" aria-hidden /> <Tr s={p.name} />
                      {p.isOwn && <span className="cp-faint">{" "}<Tr s={"· yo"} /></span>}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.82rem]">
            <button type="button" className="cp-gold min-h-9 underline decoration-dotted underline-offset-4" onClick={() => setPanel("form")}><Tr s={"Otros datos"} /></button>
            <Link href="/area/energy" className="cp-muted min-h-9 content-center underline underline-offset-4"><Tr s={"Gestionar en «Mi energía»"} /></Link>
          </div>
        </div>
      )}

      {panel === "form" && unlocked && (
        <div className={box}>
          <BirthProfileEditor
            mode="calc"
            own={!own}
            submitLabel={t("Calcular")}
            onCancel={() => setPanel("none")}
            onDone={(profile, saved) => {
              choose({ id: saved?.id ?? null, profile });
              if (saved) void refresh(true);
            }}
          />
        </div>
      )}
    </>
  );
}
