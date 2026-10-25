/**
 * Qué es cada cosa que tiene la alumna, en una palabra («Curso», «Lectura», «Sesión»…), para «Mis
 * canales» del área de cliente en la web personal. Las lecturas son sesiones que piden datos de
 * nacimiento o se llaman «Lectura…»; los talleres, sesiones de grupo con fecha fija.
 */
import { readIntakeConfig } from "./intake";

type KindInput = { type: string; title: string; groupSession?: boolean | null; intake?: unknown; deliveryMode?: string | null };

export function channelKindLabel(p: KindInput): string {
  switch (p.type) {
    case "COURSE":
      return "Curso";
    case "MEMBERSHIP":
      return "Membresía";
    case "DIGITAL":
      // «Lo preparo yo»: una lectura que la dueña prepara y entrega.
      return p.deliveryMode === "PERSONAL" || /^lectura\b/i.test(p.title.trim()) ? "Lectura" : "Descarga";
    case "SESSION":
      if (p.groupSession) return "Taller";
      if (/^lectura\b/i.test(p.title.trim()) || readIntakeConfig(p.intake).birth !== "off") return "Lectura";
      return "Sesión";
    default:
      return "";
  }
}
