/**
 * El cielo de un círculo de la luna: la luna nueva o llena más cercana a su fecha (±4 días), el signo
 * en el que está y una frase sobre esa energía. Lo usa la ficha del círculo en lugar de la foto.
 * Puro (astronomy-engine, sin BD ni red).
 */
import { eclipsesBetween, moonPhasesBetween, SIGN_GLYPHS, SIGNS } from "./astro-calendar";

/** Los tres círculos: luna nueva, luna llena y eclipse. */
export type MoonKind = "new" | "full" | "eclipse";
export const MOON_KINDS: readonly MoonKind[] = ["new", "full", "eclipse"];
export const MOON_KIND_LABEL: Record<MoonKind, string> = { new: "Luna nueva", full: "Luna llena", eclipse: "Eclipse" };
export const MOON_KIND_ICON: Record<MoonKind, string> = { new: "🌑", full: "🌕", eclipse: "🌘" };
/** Lo que se hace en cada uno («Luna nueva · sembrar»). */
export const MOON_KIND_VERB: Record<MoonKind, string> = { new: "sembrar", full: "soltar", eclipse: "transformar" };

/**
 * `body`: en un eclipse, si es de Sol (anillo dorado) o de Luna (luna roja), según su fecha.
 */
export type MoonCircleSky = { phase: MoonKind; body?: "solar" | "lunar"; sign: string; glyph: string; title: string; phrase: string };

/** Una frase por signo: lo que siembra la luna nueva, lo que ilumina la luna llena y lo que cambia el eclipse. */
const PHRASES: Record<(typeof SIGNS)[number], { new: string; full: string; eclipse: string }> = {
  Aries: {
    new: "Un comienzo valiente: enciende la chispa de lo que quieres empezar y confía en tu impulso.",
    full: "Ilumina tu fuego interior: suelta la prisa y celebra el coraje que ya has demostrado.",
    eclipse: "Un portal de cambio: lo que empieza ahora llega con fuerza. Suelta el miedo y da el salto.",
  },
  Tauro: {
    new: "Siembra en tierra fértil: intenciones de calma, abundancia y placer en lo sencillo.",
    full: "Florece lo que cuidaste con paciencia: honra tu cuerpo, tu valor y lo que te sostiene.",
    eclipse: "La tierra se mueve bajo tus pies: suelta lo que te ata por costumbre y abre espacio a lo nuevo.",
  },
  Géminis: {
    new: "Nuevas ideas en el aire: abre conversaciones, aprende y deja que la curiosidad te guíe.",
    full: "Claridad en tus palabras: di lo que sientes y suelta los pensamientos que te dispersan.",
    eclipse: "Cambian las historias que te cuentas: escucha el mensaje que llega y deja ir las dudas.",
  },
  Cáncer: {
    new: "Un nido nuevo para tu alma: siembra hogar, ternura y cuidado hacia ti misma.",
    full: "Las emociones salen a la luz: abraza lo que sientes y deja ir lo que ya no te protege.",
    eclipse: "El alma se renueva desde la raíz: cierra un ciclo con ternura y abraza el hogar que viene.",
  },
  Leo: {
    new: "Tu luz pide espacio: siembra la intención de brillar y crear desde el corazón.",
    full: "Brilla sin pedir permiso: celebra quién eres y suelta el miedo a ser vista.",
    eclipse: "Tu luz se reinventa: suelta la máscara y deja que el destino te muestre otra forma de brillar.",
  },
  Virgo: {
    new: "Ordena para florecer: siembra rutinas amables, salud y pequeños rituales diarios.",
    full: "Cosecha lo que perfeccionaste: suelta la exigencia y agradece cada paso dado.",
    eclipse: "Un reajuste profundo: lo que ya no sirve se cae solo para que llegue lo que de verdad te cuida.",
  },
  Libra: {
    new: "Siembra armonía: intenciones de equilibrio, belleza y vínculos que te nutran.",
    full: "Tus relaciones se iluminan: busca el equilibrio entre dar y recibir, y suelta lo que pesa.",
    eclipse: "Los vínculos se transforman: confía en lo que se va y en lo que llega para equilibrarte.",
  },
  Escorpio: {
    new: "Una semilla en lo profundo: atrévete a transformarte desde dentro, con verdad.",
    full: "Lo oculto se revela: suelta lo que ya murió en ti y renace más fuerte.",
    eclipse: "Muerte y renacimiento: el eclipse te lleva a lo hondo para que salgas transformada.",
  },
  Sagitario: {
    new: "Apunta al horizonte: siembra fe, aventura y el deseo de expandir tu mundo.",
    full: "La sabiduría se ilumina: celebra lo aprendido y suelta las creencias que te limitan.",
    eclipse: "Tu camino da un giro: suelta las viejas creencias y sigue la señal que te marca el cielo.",
  },
  Capricornio: {
    new: "Pon la primera piedra: siembra metas sólidas y el compromiso de construir tu camino.",
    full: "Cosecha tus logros: reconoce tu esfuerzo y suelta las cargas que no te corresponden.",
    eclipse: "Se mueven los cimientos: lo que construyes desde ahora se apoya en tu verdad, no en el deber.",
  },
  Acuario: {
    new: "Siembra lo nuevo y lo distinto: sueños colectivos, libertad y tu manera única de ser.",
    full: "Tu esencia se libera: celebra lo que te hace única y suelta lo que te encasilla.",
    eclipse: "Un despertar repentino: deja que lo inesperado te libere y te devuelva a tu esencia.",
  },
  Piscis: {
    new: "Siembra desde la intuición: sueña, medita y escucha lo que te susurra el alma.",
    full: "El velo se vuelve fino: entrégate, perdona y deja que todo se disuelva en amor.",
    eclipse: "El velo se abre del todo: entrégate al cambio y deja que tu intuición marque el rumbo.",
  },
};

const DAY = 86_400_000;

/** El eclipse más cercano a `at` (±4 días), o null. */
function eclipseNear(at: Date) {
  const list = eclipsesBetween(new Date(at.getTime() - 4 * DAY), new Date(at.getTime() + 4 * DAY)).filter((e): e is Extract<typeof e, { kind: "eclipse" }> => e.kind === "eclipse");
  if (!list.length) return null;
  return list.reduce((a, b) => (Math.abs(b.at.getTime() - at.getTime()) < Math.abs(a.at.getTime() - at.getTime()) ? b : a));
}

/** En un eclipse con fecha: de Sol o de Luna (el eclipse real más cercano, o si no la luna de ese día). */
export function eclipseBody(at: Date | null | undefined): "solar" | "lunar" {
  if (!at) return "lunar";
  const e = eclipseNear(at);
  if (e) return e.body;
  return moonCircleSky(at, false)?.phase === "new" ? "solar" : "lunar";
}

/** El cielo del círculo con fecha `at` (un eclipse si cae uno cerca), o null si no hay luna nueva ni llena cerca. */
export function moonCircleSky(at: Date, eclipses = true): MoonCircleSky | null {
  const ec = eclipses ? eclipseNear(at) : null;
  if (ec) {
    const i = Math.floor((((ec.lon % 360) + 360) % 360) / 30);
    const sign = SIGNS[i];
    return { phase: "eclipse", body: ec.body, sign, glyph: SIGN_GLYPHS[i], title: `Eclipse en ${sign}`, phrase: PHRASES[sign].eclipse };
  }
  const events = moonPhasesBetween(new Date(at.getTime() - 4 * DAY), new Date(at.getTime() + 4 * DAY));
  const moons = events.filter((e): e is Extract<typeof e, { kind: "moon" }> => e.kind === "moon");
  if (!moons.length) return null;
  const e = moons.reduce((a, b) => (Math.abs(b.at.getTime() - at.getTime()) < Math.abs(a.at.getTime() - at.getTime()) ? b : a));
  const i = Math.floor((((e.lon % 360) + 360) % 360) / 30);
  const sign = SIGNS[i];
  return {
    phase: e.phase,
    sign,
    glyph: SIGN_GLYPHS[i],
    title: `${e.phase === "new" ? "Luna nueva" : "Luna llena"} en ${sign}`,
    phrase: PHRASES[sign][e.phase],
  };
}

/** La frase de siempre para esa luna en ese signo. */
export function moonPhrase(phase: MoonKind, sign: string): string {
  const s = (SIGNS as readonly string[]).includes(sign) ? (sign as (typeof SIGNS)[number]) : "Aries";
  return PHRASES[s][phase];
}

/** El cielo elegido a mano en el estudio (la luna y el signo), con su frase propia o la de siempre. `at`: su fecha (en un eclipse dice si es de Sol o de Luna). */
export function moonSkyFor(phase: MoonKind, sign: string, phrase?: string | null, at?: Date | null): MoonCircleSky {
  const i = Math.max(0, (SIGNS as readonly string[]).indexOf(sign));
  const s = SIGNS[i];
  return {
    phase,
    ...(phase === "eclipse" ? { body: eclipseBody(at) } : {}),
    sign: s,
    glyph: SIGN_GLYPHS[i],
    title: `${MOON_KIND_LABEL[phase]} en ${s}`,
    phrase: phrase?.trim() || PHRASES[s][phase],
  };
}
