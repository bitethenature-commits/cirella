"use client";

import { Bookmark, CalendarDays, ChevronLeft, ChevronRight, X, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { savePost } from "./actions";

/**
 * Las membresías «a página entera» (Esencia): cada publicación es una página. Arriba y abajo, «Anterior» y
 * «Siguiente» y un calendario del mes con los días que tienen publicación marcados (al tocar uno, se abre;
 * si hay varias ese día, se elige). Y «Guardar», que la lleva a «Mis archivos».
 */

export type ReaderItem = { id: string; day: string; title: string; href: string };

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const WEEK = ["L", "M", "X", "J", "V", "S", "D"];

function Calendar({ items, currentId, close, noun }: { items: ReaderItem[]; currentId: string; close: () => void; noun: string }) {
  const cur = items.find((i) => i.id === currentId)?.day ?? items[items.length - 1]?.day ?? new Date().toISOString().slice(0, 10);
  const [ym, setYm] = useState(() => ({ y: Number(cur.slice(0, 4)), m: Number(cur.slice(5, 7)) - 1 }));
  const [pick, setPick] = useState<string | null>(null);
  const byDay = new Map<string, ReaderItem[]>();
  for (const i of items) byDay.set(i.day, [...(byDay.get(i.day) ?? []), i]);
  const first = new Date(Date.UTC(ym.y, ym.m, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
  const key = (d: number) => `${ym.y}-${String(ym.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const move = (n: number) => {
    setPick(null);
    setYm(({ y, m }) => ({ y: y + Math.floor((m + n) / 12), m: (((m + n) % 12) + 12) % 12 }));
  };
  const monthHas = (y: number, m: number) => items.some((i) => i.day.startsWith(`${y}-${String(m + 1).padStart(2, "0")}`));
  return (
    <div className="absolute right-0 top-full z-30 mt-2 w-[19rem] rounded-2xl border border-line bg-white p-4 shadow-xl" role="dialog" aria-label="Ir a una fecha">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => move(-1)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-sand" aria-label="Mes anterior">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold capitalize">
          {MONTHS[ym.m]} {ym.y}
        </p>
        <button type="button" onClick={() => move(1)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-sand" aria-label="Mes siguiente">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[0.7rem] text-muted">
        {WEEK.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, i) => (
          <span key={`e${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const d = i + 1;
          const k = key(d);
          const list = byDay.get(k);
          const isCur = list?.some((x) => x.id === currentId);
          if (!list)
            return (
              <span key={k} className="grid h-9 place-items-center rounded-full text-sm text-ink/35">
                {d}
              </span>
            );
          const cls = `grid h-9 place-items-center rounded-full text-sm font-semibold transition ${isCur ? "bg-ink text-white" : "bg-gold/25 text-ink hover:bg-gold/45"}`;
          return list.length === 1 ? (
            <Link key={k} href={list[0].href} onClick={close} className={cls} title={list[0].title}>
              {d}
            </Link>
          ) : (
            <button key={k} type="button" onClick={() => setPick(k)} className={cls} title={`${list.length} publicaciones`}>
              {d}
            </button>
          );
        })}
      </div>
      {pick && (
        <ul className="mt-3 space-y-1 border-t border-line pt-3">
          {byDay.get(pick)!.map((x) => (
            <li key={x.id}>
              <Link href={x.href} onClick={close} className="block truncate rounded-lg px-2 py-1.5 text-sm hover:bg-sand">
                {x.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!monthHas(ym.y, ym.m) && <p className="mt-3 text-center text-xs text-muted">Este mes no hay nada.</p>}
      <p className="mt-3 flex items-center gap-1.5 text-[0.7rem] text-muted">
        <span className="inline-block h-3 w-3 rounded-full bg-gold/40" /> días con {noun}
      </p>
    </div>
  );
}

/** Anterior · calendario · Siguiente. Va arriba y abajo de la publicación. */
export function ReaderNav({ items, currentId, noun = "publicación" }: { items: ReaderItem[]; currentId: string; noun?: string }) {
  const i = items.findIndex((x) => x.id === currentId);
  const prev = i > 0 ? items[i - 1] : null;
  const next = i >= 0 && i < items.length - 1 ? items[i + 1] : null;
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", off);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", off);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const btn = "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-3.5 text-sm font-semibold transition hover:bg-sand";
  return (
    <nav className="flex items-center justify-between gap-2" aria-label="Publicaciones">
      {prev ? (
        <Link href={prev.href} className={btn} title={prev.title}>
          <ChevronLeft className="h-4 w-4" /> Anterior
        </Link>
      ) : (
        <span className={`${btn} pointer-events-none opacity-35`}>
          <ChevronLeft className="h-4 w-4" /> Anterior
        </span>
      )}
      <div className="relative" ref={box}>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Ir a una fecha" className="grid h-11 w-11 place-items-center rounded-full border border-line transition hover:bg-sand">
          {open ? <X className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
        </button>
        {open && <Calendar items={items} currentId={currentId} close={() => setOpen(false)} noun={noun} />}
      </div>
      {next ? (
        <Link href={next.href} className={btn} title={next.title}>
          Siguiente <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span className={`${btn} pointer-events-none opacity-35`}>
          Siguiente <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </nav>
  );
}

/** «Guardar»: sale en «Mis archivos», en Favoritos y en la carpeta de los textos de su membresía. */
export function SaveButton({ postId, saved, folder }: { postId: string; saved: boolean; folder: string }) {
  const [state, setState] = useState(saved);
  const [optimistic, setOptimistic] = useOptimistic(state);
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        aria-pressed={optimistic}
        onClick={() =>
          start(async () => {
            setOptimistic(!optimistic);
            const r = await savePost(postId);
            if ("error" in r) setError(r.error);
            else {
              setError(null);
              setState(r.saved);
            }
          })
        }
        className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${optimistic ? "border-gold bg-gold/15 text-ink" : "border-line text-ink hover:bg-sand"}`}
      >
        <Star className={`h-4 w-4 ${optimistic ? "fill-current text-gold" : ""}`} /> {optimistic ? "En favoritos" : "Favorito"}
      </button>
      {optimistic && !error && (
        <p className="mt-1 text-xs text-muted">
          En tus{" "}
          <Link href="/cuenta/archivos?abrir=favoritos" className="font-semibold underline-offset-2 hover:underline">
            Favoritos
          </Link>{" "}
          y en {folder}.
        </p>
      )}
      {error && (
        <p className="mt-1 text-xs text-rose" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
