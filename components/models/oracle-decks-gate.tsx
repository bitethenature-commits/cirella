"use client";

import { useEffect, useState } from "react";
import { Layers, Lock } from "lucide-react";
import { NewsletterUnlockForm } from "@/components/creator-page/portal-section";
import { BUILTIN_ORACLE_DECK, type OracleDeckView } from "./data/oracle";
import { loadAccess, type AccessData, type ModelGateInfo } from "./model-gate-scope";
import { cn } from "./model-kit";
import { OracleModel } from "./oracle-model";

/**
 * El oráculo en las páginas públicas de la web personal: la baraja del bloque (o la de serie) la usa todo
 * el mundo, sin cuenta. «Más barajas» deja elegir entre las demás barajas publicadas de la dueña (Panel →
 * Barajas) solo a quien ha entrado en su cuenta y es suscriptora confirmada de la newsletter; a las demás
 * personas les enseña el mismo formulario del portal. Las barajas no vienen en la página: se piden a
 * /api/mi-energia/barajas, que comprueba el acceso en el servidor.
 */

async function loadDecks(username: string): Promise<OracleDeckView[] | null> {
  try {
    const r = await fetch(`/api/mi-energia/barajas?u=${encodeURIComponent(username)}`, { cache: "no-store", credentials: "same-origin" });
    if (!r.ok) return null;
    const d = (await r.json()) as { decks?: OracleDeckView[] };
    return Array.isArray(d.decks) ? d.decks : null;
  } catch {
    return null;
  }
}

export function OracleWithDecks({ deck, gate }: { deck: OracleDeckView | null; gate: ModelGateInfo }) {
  const base = deck && deck.cards.length ? deck : BUILTIN_ORACLE_DECK;
  const [selected, setSelected] = useState<OracleDeckView>(base);
  const [open, setOpen] = useState(false);
  const [access, setAccess] = useState<AccessData | null | "loading">("loading");
  const [decks, setDecks] = useState<OracleDeckView[] | null | "loading">(null);
  const [next, setNext] = useState<string>();
  useEffect(() => setNext(`${window.location.pathname}#mas-barajas`), []);

  const unlocked = access !== "loading" && !!access?.unlocked;
  useEffect(() => {
    if (!open || access !== "loading") return;
    let alive = true;
    void loadAccess(gate.username).then((d) => alive && setAccess(d));
    return () => {
      alive = false;
    };
  }, [open, access, gate.username]);
  // Una sola petición (no se cancela al pasar a «cargando»: si no, se quedaba cargando para siempre).
  useEffect(() => {
    if (!open || !unlocked || decks !== null) return;
    setDecks("loading");
    void loadDecks(gate.username).then((d) => setDecks(d ?? []));
  }, [open, unlocked, decks, gate.username]);

  // La de la página primero; luego las demás publicadas (sin repetir la misma).
  const options = decks && decks !== "loading" ? [base, ...decks.filter((d) => d.id !== base.id && d.cards.length)] : [base];

  return (
    <div>
      <div
        id="mas-barajas"
        className="mb-6 scroll-mt-24 rounded-[calc(var(--r-card)*0.7)] border px-4 py-3"
        style={{ borderColor: "color-mix(in oklab, var(--c-gold) 30%, transparent)", background: "color-mix(in oklab, var(--c-gold) 5%, transparent)" }}
        data-decks={open ? (access === "loading" ? "loading" : unlocked ? "unlocked" : "locked") : "closed"}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 text-[0.88rem] leading-snug">
            <span className="cp-eyebrow !text-[0.58rem]">Baraja</span>
            <span className="mt-0.5 block font-semibold">{selected.name}</span>
          </p>
          <button type="button" className="cp-btn-ghost !min-h-10 !text-[0.85rem]" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            <Layers className="h-4 w-4" aria-hidden /> Más barajas
          </button>
        </div>

        {open && access === "loading" && <p className="cp-faint mt-3 text-[0.8rem]">Comprobando tu acceso…</p>}

        {open && access !== "loading" && !unlocked && (
          <div className="mt-4">
            <p className="mb-3 flex items-start gap-2 text-[0.86rem] leading-snug">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                <strong className="font-semibold">Las demás barajas son para suscriptoras.</strong> <span className="cp-muted">Regístrate y suscríbete a la newsletter para elegirlas; esta la puedes usar siempre.</span>
              </span>
            </p>
            <NewsletterUnlockForm
              id="mas-barajas-form"
              what="elegir otras barajas"
              label="Suscríbete para elegir otras barajas"
              access={access}
              creatorName={gate.creatorName}
              privacyHref={gate.privacyHref}
              next={next}
              via="carta"
              signedInHint="Solo falta que te apuntes a la newsletter para elegir otras barajas."
              sentHint="vuelves aquí con todas las barajas"
              footerHint="vuelves a esta página"
              onUnlocked={() => {
                setDecks(null);
                void loadAccess(gate.username, true).then(setAccess);
              }}
            />
          </div>
        )}

        {open && unlocked && (
          <div className="mt-4">
            {decks === "loading" || decks === null ? (
              <p className="cp-faint text-[0.8rem]">Cargando tus barajas…</p>
            ) : options.length < 2 ? (
              <p className="cp-muted text-[0.85rem]">Por ahora esta es la única baraja publicada.</p>
            ) : (
              <ul className="flex flex-wrap gap-2" aria-label="Elegir baraja">
                {options.map((d) => (
                  <li key={d.id ?? "serie"}>
                    <button
                      type="button"
                      aria-pressed={selected.id === d.id}
                      onClick={() => {
                        setSelected(d);
                        setOpen(false);
                      }}
                      className={cn("cp-btn-ghost !min-h-9 !px-3.5 !text-[0.82rem]", selected.id === d.id && "!border-[var(--c-gold)]")}
                    >
                      {d.name}
                      <span className="cp-faint"> · {d.cards.length}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      {/* Otra baraja, otra tirada: se empieza de cero. */}
      <OracleModel key={selected.id ?? "serie"} deck={selected} />
    </div>
  );
}
