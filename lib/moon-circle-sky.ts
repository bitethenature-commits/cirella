/**
 * El cielo de un círculo de la luna: la luna nueva o llena más cercana a su fecha (±4 días), el signo
 * en el que está y una frase sobre esa energía. Lo usa la ficha del círculo en lugar de la foto.
 * Puro (astronomy-engine, sin BD ni red).
 */
import { moonPhasesBetween, SIGN_GLYPHS, SIGNS } from "./astro-calendar";

export type MoonCircleSky = { phase: "new" | "full"; sign: string; glyph: string; title: string; phrase: string };

/** Una frase por signo: lo que siembra la luna nueva y lo que ilumina la luna llena. */
const PHRASES: Record<(typeof SIGNS)[number], { new: string; full: string }> = {
  Aries: {
    new: "Un comienzo valiente: enciende la chispa de lo que quieres empezar y confía en tu impulso.",
    full: "Ilumina tu fuego interior: suelta la prisa y celebra el coraje que ya has demostrado.",
  },
  Tauro: {
    new: "Siembra en tierra fértil: intenciones de calma, abundancia y placer en lo sencillo.",
    full: "Florece lo que cuidaste con paciencia: honra tu cuerpo, tu valor y lo que te sostiene.",
  },
  Géminis: {
    new: "Nuevas ideas en el aire: abre conversaciones, aprende y deja que la curiosidad te guíe.",
    full: "Claridad en tus palabras: di lo que sientes y suelta los pensamientos que te dispersan.",
  },
  Cáncer: {
    new: "Un nido nuevo para tu alma: siembra hogar, ternura y cuidado hacia ti misma.",
    full: "Las emociones salen a la luz: abraza lo que sientes y deja ir lo que ya no te protege.",
  },
  Leo: {
    new: "Tu luz pide espacio: siembra la intención de brillar y crear desde el corazón.",
    full: "Brilla sin pedir permiso: celebra quién eres y suelta el miedo a ser vista.",
  },
  Virgo: {
    new: "Ordena para florecer: siembra rutinas amables, salud y pequeños rituales diarios.",
    full: "Cosecha lo que perfeccionaste: suelta la exigencia y agradece cada paso dado.",
  },
  Libra: {
    new: "Siembra armonía: intenciones de equilibrio, belleza y vínculos que te nutran.",
    full: "Tus relaciones se iluminan: busca el equilibrio entre dar y recibir, y suelta lo que pesa.",
  },
  Escorpio: {
    new: "Una semilla en lo profundo: atrévete a transformarte desde dentro, con verdad.",
    full: "Lo oculto se revela: suelta lo que ya murió en ti y renace más fuerte.",
  },
  Sagitario: {
    new: "Apunta al horizonte: siembra fe, aventura y el deseo de expandir tu mundo.",
    full: "La sabiduría se ilumina: celebra lo aprendido y suelta las creencias que te limitan.",
  },
  Capricornio: {
    new: "Pon la primera piedra: siembra metas sólidas y el compromiso de construir tu camino.",
    full: "Cosecha tus logros: reconoce tu esfuerzo y suelta las cargas que no te corresponden.",
  },
  Acuario: {
    new: "Siembra lo nuevo y lo distinto: sueños colectivos, libertad y tu manera única de ser.",
    full: "Tu esencia se libera: celebra lo que te hace única y suelta lo que te encasilla.",
  },
  Piscis: {
    new: "Siembra desde la intuición: sueña, medita y escucha lo que te susurra el alma.",
    full: "El velo se vuelve fino: entrégate, perdona y deja que todo se disuelva en amor.",
  },
};

const DAY = 86_400_000;

/** El cielo del círculo con fecha `at`, o null si no hay luna nueva ni llena cerca. */
export function moonCircleSky(at: Date): MoonCircleSky | null {
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
