"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Lock, Sparkles, UserRound } from "lucide-react";
import { NewsletterUnlockForm, type UnlockAccess } from "@/components/creator-page/portal-section";
import type { BirthProfile } from "@/lib/birth-profile";
import { profileSummary, type SavedBirthProfile } from "@/lib/birth-profiles-rules";
import { BirthProfileEditor } from "./birth-profile-editor";
import { cn } from "./model-kit";

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
 */

export type ModelGateInfo = {
  username: string;
  creatorName: string;
  privacyHref: string;
};
export type GatedModel = "chart" | "bodygraph" | "geneKeys" | "lunar";

type AccessData = UnlockAccess & {
  unlocked: boolean;
  profiles: SavedBirthProfile[];
};

const NOUN: Record<GatedModel, string> = {
  chart: "tu carta",
  bodygraph: "tu carta de Diseño Humano",
  geneKeys: "tu perfil de Gene Keys",
  lunar: "tu luna natal",
};

/** Una petición por página aunque haya varios modelos (se repite tras suscribirse o guardar). */
const requests = new Map<string, Promise<AccessData | null>>();
function loadAccess(username: string, fresh = false): Promise<AccessData | null> {
  if (fresh) requests.delete(username);
  let p = requests.get(username);
  if (!p) {
    p = fetch(`/api/mi-energia?u=${encodeURIComponent(username)}`, {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then((r) => (r.ok ? (r.json() as Promise<AccessData>) : null))
      .catch(() => null);
    requests.set(username, p);
  }
  return p;
}

type Panel = "none" | "subscribe" | "choose" | "form";

export function ModelGate({ model, gate, children }: { model: GatedModel; gate: ModelGateInfo; children: (profile: BirthProfile | undefined) => ReactNode }) {
  const [access, setAccess] = useState<AccessData | null | "loading">("loading");
  const [active, setActive] = useState<{
    id: string | null;
    profile: BirthProfile;
  } | null>(null);
  /** Ya eligió algo (otro perfil, el ejemplo): no se vuelve a aplicar el propio solo. */
  const [chosen, setChosen] = useState(false);
  const [panel, setPanel] = useState<Panel>("none");
  const anchor = `calcular-${model}`;
  /** Adónde vuelve el enlace del email: esta página, a la altura del modelo. */
  const [next, setNext] = useState<string>();
  useEffect(() => setNext(`${window.location.pathname}#${anchor}`), [anchor]);

  const refresh = useCallback(
    (fresh: boolean) =>
      loadAccess(gate.username, fresh).then((d) => {
        setAccess(d);
        return d;
      }),
    [gate.username],
  );
  useEffect(() => {
    void refresh(false);
  }, [refresh]);

  const profiles = access && access !== "loading" ? access.profiles : [];
  const own = profiles.find((p) => p.isOwn) ?? null;
  // Con sus datos guardados: se aplican solos (una vez; si elige otra cosa, se respeta).
  useEffect(() => {
    if (!chosen && !active && own) setActive({ id: own.id, profile: own });
  }, [own, chosen, active]);

  const unlocked = access !== "loading" && !!access?.unlocked;
  const noun = NOUN[model];

  const choose = (p: SavedBirthProfile) => {
    setChosen(true);
    setActive({ id: p.id, profile: p });
    setPanel("none");
  };

  let bar: ReactNode;
  if (access === "loading") bar = <p className="cp-faint text-[0.8rem]">Ejemplo · comprobando si puedes calcular con tus datos…</p>;
  else if (!unlocked) {
    bar = (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex min-w-0 items-start gap-2 text-[0.88rem] leading-snug">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            <strong className="font-semibold">Regístrate y suscríbete a la newsletter para calcular {noun}.</strong> <span className="cp-muted">Mientras, aquí tienes el ejemplo.</span>
          </span>
        </p>
        {panel !== "subscribe" && (
          <button type="button" className="cp-btn !min-h-10 !text-[0.85rem]" onClick={() => setPanel("subscribe")}>
            Calcular con mis datos
          </button>
        )}
      </div>
    );
  } else if (active) {
    bar = (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 text-[0.88rem] leading-snug">
          <span className="cp-eyebrow !text-[0.58rem]">Con tus datos</span>
          <span className="mt-0.5 block font-semibold">{active.profile.name}</span>
          <span className="cp-muted block text-[0.8rem]">{profileSummary(active.profile)}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="cp-btn-ghost !min-h-10 !text-[0.85rem]" onClick={() => setPanel(panel === "choose" ? "none" : "choose")} aria-expanded={panel === "choose"}>
            Usar otros datos
          </button>
          <button
            type="button"
            className="cp-btn-ghost !min-h-10 !text-[0.85rem]"
            onClick={() => {
              setChosen(true);
              setActive(null);
              setPanel("none");
            }}
          >
            Ver el ejemplo
          </button>
        </div>
      </div>
    );
  } else {
    bar = (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="cp-muted flex items-center gap-2 text-[0.85rem]">
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden /> Estás viendo el ejemplo.
        </p>
        {panel === "none" && (
          <button
            type="button"
            className="cp-btn !min-h-10 !text-[0.85rem]"
            onClick={() => {
              if (own) choose(own);
              else setPanel(profiles.length ? "choose" : "form");
            }}
          >
            Calcular con mis datos
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
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
          <div className="mt-4">
            {profiles.length > 0 && (
              <>
                <p className="cp-eyebrow !text-[0.58rem]">Tus personas guardadas</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {profiles.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => choose(p)}
                        aria-pressed={active?.id === p.id}
                        className={cn("cp-btn-ghost !min-h-9 !px-3.5 !text-[0.82rem]", active?.id === p.id && "!border-[var(--c-gold)]")}
                      >
                        <UserRound className="h-3.5 w-3.5" aria-hidden /> {p.name}
                        {p.isOwn && <span className="cp-faint"> · yo</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.82rem]">
              <button type="button" className="cp-gold min-h-9 underline decoration-dotted underline-offset-4" onClick={() => setPanel("form")}>
                Otros datos
              </button>
              <Link href="/cuenta/mi-energia" className="cp-muted min-h-9 content-center underline underline-offset-4">
                Gestionar en «Mi energía»
              </Link>
            </div>
          </div>
        )}

        {panel === "form" && unlocked && (
          <div className="mt-4">
            <BirthProfileEditor
              mode="calc"
              own={!own}
              submitLabel="Calcular"
              onCancel={() => setPanel("none")}
              onDone={(profile, saved) => {
                setChosen(true);
                setActive({ id: saved?.id ?? null, profile });
                setPanel("none");
                if (saved) void refresh(true);
              }}
            />
          </div>
        )}
      </div>
      {children(active?.profile)}
    </div>
  );
}
