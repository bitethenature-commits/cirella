/**
 * «Abrir las lecciones poco a poco» (Product.dripMode / dripEveryDays, Lesson.dripDays).
 *
 *   · null        → todas las lecciones publicadas se ven desde que se apunta (lo de siempre);
 *   · "INTERVAL"  → una lección cada N días: la 1.ª el día que se apunta, la 2.ª a los N días, la
 *                   3.ª a los 2N… (por orden del programa, contando solo las publicadas);
 *   · "LESSON"    → cada lección el día que diga su «Disponible a los N días» (vacío = desde el
 *                   primer día).
 *
 * «Se apunta» = la fecha del acceso que le da el curso (el directo o el de la membresía que lo
 * incluye). Puro: lo usan el reproductor, el progreso, los archivos (lib/course-access.ts), el
 * estudio del panel y las pruebas.
 */

export const DRIP_MODES = ["INTERVAL", "LESSON"] as const;
export type DripMode = (typeof DRIP_MODES)[number];
export const DRIP_MAX_DAYS = 365;

export type DripSettings = { mode: DripMode | null; everyDays: number | null };

export function readDrip(p: { dripMode: string | null; dripEveryDays: number | null }): DripSettings {
  const mode = (DRIP_MODES as readonly string[]).includes(p.dripMode ?? "") ? (p.dripMode as DripMode) : null;
  if (mode === "INTERVAL") {
    const every = p.dripEveryDays && p.dripEveryDays > 0 ? Math.min(DRIP_MAX_DAYS, p.dripEveryDays) : null;
    // Sin días válidos, como si no hubiera apertura poco a poco.
    return every ? { mode, everyDays: every } : { mode: null, everyDays: null };
  }
  return { mode, everyDays: null };
}

/**
 * Día (desde que se apunta, 0 = el mismo día) en que se abre cada lección. `lessons` van en el
 * orden del programa y son solo las publicadas.
 */
export function dripDayFor(drip: DripSettings, index: number, lessonDripDays: number | null): number {
  if (drip.mode === "INTERVAL" && drip.everyDays) return index * drip.everyDays;
  if (drip.mode === "LESSON") return lessonDripDays && lessonDripDays > 0 ? Math.min(DRIP_MAX_DAYS, lessonDripDays) : 0;
  return 0;
}

const DAY = 86_400_000;

/** Momento en que se abre: el mismo instante del alta + N días (sin ambigüedad de zonas horarias). */
export function opensAt(enrolledAt: Date, day: number): Date {
  return new Date(enrolledAt.getTime() + day * DAY);
}

export type DripLesson = { id: string; dripDays: number | null };

/**
 * Para una alumna: cuándo se abre cada lección (null = ya abierta). `enrolledAt` null = la dueña o
 * sin fecha: todo abierto.
 */
export function lessonLocks(drip: DripSettings, lessons: DripLesson[], enrolledAt: Date | null, now = new Date()): Map<string, Date | null> {
  const out = new Map<string, Date | null>();
  lessons.forEach((l, i) => {
    const day = dripDayFor(drip, i, l.dripDays);
    if (!enrolledAt || day === 0) return out.set(l.id, null);
    const at = opensAt(enrolledAt, day);
    out.set(l.id, at > now ? at : null);
  });
  return out;
}

/** «Desde el primer día», «A los 7 días». */
export function dripDayLabel(day: number): string {
  return day <= 0 ? "Desde el primer día" : day === 1 ? "Al día siguiente" : `A los ${day} días`;
}

/** Resumen para el estudio: «Una lección cada 7 días». */
export function dripSummary(drip: DripSettings): string {
  if (drip.mode === "INTERVAL" && drip.everyDays) return drip.everyDays === 1 ? "Una lección cada día" : `Una lección cada ${drip.everyDays} días`;
  if (drip.mode === "LESSON") return "Cada lección, el día que elijas";
  return "Todas las lecciones a la vez";
}

/** Lee los días de un formulario («7», "", basura) → número válido o null. */
export function parseDripDays(raw: unknown): number | null {
  const n = typeof raw === "string" ? Number.parseInt(raw.trim(), 10) : typeof raw === "number" ? raw : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(DRIP_MAX_DAYS, Math.floor(n));
}
