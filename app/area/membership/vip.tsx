import type { ReactNode } from "react";
import { SpinningSolid } from "../spinning-solid";
import { MoonToday } from "./moon-today";
import { AreaText } from "../design-scope";
import { Tr } from "@/lib/i18n/client";

/**
 * El área de miembros como un templo de noche y oro: la cabecera de cada membresía (saludo personal, la flor
 * de la vida dibujándose detrás, la Luna de hoy y la frase del día) y la tarjeta de miembro VIP.
 */

/** Una frase para cada día (cambia a medianoche y se repite cada mes). Textos propios. */
const PHRASES = [
  "Lo que buscas también te está buscando a ti.",
  "Respira: no tienes que llegar a ningún sitio para estar en casa.",
  "Cada luna nueva es un permiso para empezar otra vez.",
  "Tu cuerpo es el primer templo; cuídalo como tal.",
  "La calma también es una forma de valentía.",
  "Lo pequeño, hecho con amor, es sagrado.",
  "Suelta lo que pesa: las manos vacías pueden recibir.",
  "Eres cielo antes que tormenta.",
  "Escúchate con la ternura con la que escuchas a quien amas.",
  "La intuición habla bajito: haz silencio para oírla.",
  "Hoy basta con dar un paso. Mañana, otro.",
  "Tu luz no molesta a nadie que también quiera brillar.",
  "Lo que florece despacio echa raíces profundas.",
  "Agradecer convierte lo que tienes en suficiente.",
  "No eres tarde ni pronto: estás en tu tiempo.",
  "Cada respiración es una oportunidad de volver a ti.",
  "La luna no se disculpa por sus fases. Tú tampoco.",
  "Donde pones tu atención, crece tu vida.",
  "Ser suave contigo también es disciplina.",
  "Hay sabiduría en descansar antes de estar agotada.",
  "Eres parte del cielo que miras.",
  "El amor que das vuelve por caminos que no imaginas.",
  "Confía en el ritmo: la noche siempre termina en amanecer.",
  "Tu historia también es medicina para otras.",
  "Lo sagrado no está lejos: está en este instante.",
  "Planta hoy la intención; el tiempo hará el resto.",
  "Cuando no sepas qué hacer, vuelve a la respiración.",
  "Tu alma sabe el camino aunque tu mente dude.",
  "Celebra lo que ya ha cambiado en ti.",
  "Eres luz que aprendió a atravesar la sombra.",
  "Cierra los ojos un momento: todo lo que necesitas ya está dentro.",
];
export const phraseOfDay = (d = new Date()) => PHRASES[(d.getUTCDate() + d.getUTCMonth() * 7) % PHRASES.length];

/** La flor de la vida en oro, que se dibuja despacio detrás de la cabecera. */
export function SacredFlower({ className = "" }: { className?: string }) {
  const r = 34;
  const C = 120;
  const centres: [number, number][] = [[C, C]];
  for (let i = 0; i < 6; i++) {
    const a = ((-90 + i * 60) * Math.PI) / 180;
    centres.push([C + r * Math.cos(a), C + r * Math.sin(a)]);
    centres.push([C + 2 * r * Math.cos(a), C + 2 * r * Math.sin(a)]);
    const b = ((-60 + i * 60) * Math.PI) / 180;
    centres.push([C + r * Math.sqrt(3) * Math.cos(b), C + r * Math.sqrt(3) * Math.sin(b)]);
  }
  const circ = (x: number, y: number, rr: number) => `M${(x - rr).toFixed(1)} ${y.toFixed(1)}a${rr} ${rr} 0 1 0 ${2 * rr} 0a${rr} ${rr} 0 1 0 ${-2 * rr} 0`;
  return (
    <svg viewBox="0 0 240 240" className={className} aria-hidden>
      <g fill="none" stroke="#E9CC8E" strokeWidth="0.7" strokeLinecap="round">
        {centres.map(([x, y], i) => (
          <path key={i} d={circ(x, y, r)} pathLength={1} className="vip-draw" style={{ animationDelay: `${0.15 * i}s` }} />
        ))}
        <path d={circ(C, C, 3 * r)} pathLength={1} className="vip-draw" strokeWidth="1.1" style={{ animationDelay: "3s" }} />
        <path d={circ(C, C, 3 * r + 6)} pathLength={1} className="vip-draw" strokeWidth="0.5" strokeDasharray="1 3" style={{ animationDelay: "3.4s" }} />
      </g>
    </svg>
  );
}

/** Un filete dorado con una estrella en el centro. */
export function Ornament({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`flex items-center justify-center gap-3 text-gold/80 ${className}`}>
      <span className="h-px w-16 bg-gradient-to-r from-transparent to-gold/60" />
      <span className="text-[0.7rem]">✦</span>
      <span className="h-px w-16 bg-gradient-to-l from-transparent to-gold/60" />
    </div>
  );
}

export function greetingFor(hour: number) {
  return hour >= 6 && hour < 13 ? "Buenos días" : hour >= 13 && hour < 21 ? "Buenas tardes" : "Buenas noches";
}

/** La cabecera de una membresía: su imagen, la flor de la vida, el saludo, la Luna de hoy y la frase del día. */
export function MemberHero({
  eyebrow,
  title,
  summary,
  imageUrl,
  greeting,
  moon,
  quote,
  children,
}: {
  eyebrow: ReactNode;
  title: string;
  summary: string | null;
  imageUrl: string | null;
  greeting: string | null;
  moon: { elong: number; phase: string; sign: string; glyph: string };
  quote: string;
  children?: ReactNode;
}) {
  return (
    <section className="vip-hero relative isolate overflow-hidden rounded-[2rem] p-7 sm:p-10" data-vip-hero data-area-piece="member-hero">
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-30" />
      )}
      {/* La luz (lila de siempre) y la sombra de abajo: las cambia la creadora en Mi página (--ap-glow, --ap-shade). */}
      <div
        className="absolute inset-0 -z-10"
        style={{ backgroundImage: "radial-gradient(90% 80% at 80% 10%, var(--ap-glow, rgb(132 98 204 / .45)), transparent 60%), linear-gradient(180deg, var(--ap-shade1, rgb(13 12 34 / .35)), var(--ap-shade2, rgb(13 12 34 / .92)))" }}
      />
      <span data-ap-figure className="contents">
        <SacredFlower className="pointer-events-none absolute -right-16 -top-16 -z-10 h-[22rem] w-[22rem] opacity-40 sm:-right-8 sm:h-[26rem] sm:w-[26rem]" />
      </span>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 max-w-md">
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.3em] text-gold">✦ {eyebrow} ✦</p>
          {greeting && <p className="mt-4 font-serif text-[1.15rem] italic text-ink/80"><Tr s={greeting} /></p>}
          <h1 className="vip-gold display mt-1 text-[2.8rem] leading-[1.02] sm:text-[3.6rem]">{title}</h1>
          {summary && <p className="mt-3 text-[0.95rem] leading-relaxed text-ink/75"><Tr s={summary} /></p>}
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-gold/25 bg-[rgb(13_12_34_/_.55)] px-4 py-3 backdrop-blur" data-moon-today data-area-piece="moon-today">
          <MoonToday elong={moon.elong} />
          <div className="text-left">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-gold"><AreaText k="moon.title" /></p>
            <p className="font-serif text-[1.05rem] leading-tight"><Tr s={moon.phase} /></p>
            <p className="text-xs text-muted"><Tr s={"en"} />{" "}<Tr s={moon.sign} /> <Tr s={moon.glyph} />
            </p>
          </div>
        </div>
      </div>
      <figure className="mt-8 max-w-xl border-l border-gold/40 pl-4">
        <blockquote className="font-serif text-[1.2rem] italic leading-snug text-ink/90">«<Tr s={quote} />»</blockquote>
        <figcaption className="mt-1 text-[0.66rem] uppercase tracking-[0.2em] text-muted"><AreaText k="quote.label" /></figcaption>
      </figure>
      {children}
    </section>
  );
}

/** La tarjeta de miembro VIP: dorada, con su nombre, su nivel y desde cuándo es miembro. */
export function MemberCard({ name, tier, emoji, since, note, level }: { name: string; tier: string; emoji: string | null; since: string | null; note?: string | null; level?: number | null }) {
  return (
    <div className="vip-card relative overflow-hidden rounded-[1.4rem] p-5 text-[#2A1E0C] sm:p-6" data-member-card data-area-piece="member-card">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[0.6rem] font-bold uppercase tracking-[0.28em] opacity-70"><AreaText k="card.member" /></p>
          <p className="display mt-1 truncate text-[1.6rem] leading-tight">{name}</p>
        </div>
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-[#2A1E0C]/25 bg-white/25 text-2xl" aria-hidden>
          {level != null && level >= 0 ? <SpinningSolid level={level} className="plat-glow h-8 w-8" /> : (emoji ?? "✦")}
        </span>
      </div>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[0.6rem] font-bold uppercase tracking-[0.22em] opacity-70"><AreaText k="card.level" /></p>
          <p className="font-serif text-[1.15rem]"><Tr s={tier} /></p>
        </div>
        {since && (
          <div className="text-right">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.22em] opacity-70"><AreaText k="card.since" /></p>
            <p className="font-serif text-[1.05rem] capitalize"><Tr s={since} /></p>
          </div>
        )}
      </div>
      {note && <p className="mt-3 text-xs opacity-75"><Tr s={note} /></p>}
    </div>
  );
}
