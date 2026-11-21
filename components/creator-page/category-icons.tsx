import { Sparkles } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import type { CourseCategory } from "@/lib/course-categories";
import { AstrologyIcon } from "./astrology-icon";
import { EnergyIcon } from "./energy-icon";
import { GeneKeysIcon } from "./gene-keys-icon";
import { HumanDesignIcon } from "./human-design-icon";
import { MoonIcon } from "./moon-icon";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

/** El icono de cada tema (los mismos de «Sistemas con los que trabajo»); Especiales, las estrellas. */
export const CATEGORY_ICON: Record<CourseCategory, Icon> = {
  ASTROLOGIA: AstrologyIcon,
  HUMAN_DESIGN: HumanDesignIcon,
  GENE_KEYS: GeneKeysIcon,
  LUNA: MoonIcon,
  MI_ENERGIA: EnergyIcon,
  ESPECIAL: Sparkles as Icon,
};

/** Los redondos (carta astral, luna) llenan su cuadrado: se dibujan algo más pequeños para que pesen igual. */
const ROUND: ReadonlySet<CourseCategory> = new Set(["ASTROLOGIA", "LUNA", "ESPECIAL"]);

/**
 * Los iconos de los temas de un curso, uno al lado de otro (un curso de Astrología + Mi energía lleva
 * los dos). `size` es el lado en rem del icono más grande; los redondos salen un 15 % más pequeños.
 */
export function CategoryIcons({ categories, size, className = "", gap = 0.25 }: { categories: readonly CourseCategory[]; size: number; className?: string; gap?: number }) {
  if (!categories.length) return null;
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center ${className}`} style={{ gap: `${gap}rem` }}>
      {categories.map((c) => {
        const I = CATEGORY_ICON[c];
        const s = ROUND.has(c) ? size * 0.85 : size;
        return <I key={c} style={{ width: `${s}rem`, height: `${s}rem` }} strokeWidth={c === "ESPECIAL" ? 1.3 : 1.15} />;
      })}
    </span>
  );
}
