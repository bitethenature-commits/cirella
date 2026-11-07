import type { ComponentType, SVGProps } from "react";
import { Layers, Sparkles } from "lucide-react";
import { AstrologyIcon } from "./astrology-icon";
import { EnergyIcon } from "./energy-icon";
import { GeneKeysIcon } from "./gene-keys-icon";
import { HumanDesignIcon } from "./human-design-icon";
import { MoonIcon } from "./moon-icon";
import { OracleIcon } from "./oracle-icon";
import { RuneIcon } from "./rune-icon";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

/** El icono de un sistema por su nombre («Human Design», «Gene Keys», «Astrología»…), o null si no es ninguno. */
export function knownSystemIcon(title: string): Icon | null {
  const t = title.toLowerCase();
  // Primero el oráculo y las runas: «carta de oráculo» no es la carta astral.
  if (t.includes("oráculo") || t.includes("oraculo")) return OracleIcon;
  if (t.includes("runa")) return RuneIcon;
  if (t.includes("human")) return HumanDesignIcon;
  if (t.includes("gene")) return GeneKeysIcon;
  if (t.includes("astrolog") || t.includes("carta")) return AstrologyIcon;
  if (t.includes("luna")) return MoonIcon;
  if (t.includes("tarot")) return Layers as Icon;
  if (t.includes("energ")) return EnergyIcon;
  return null;
}

/** El icono de un sistema; si no es ninguno conocido, unas estrellas. */
export function systemIcon(title: string): Icon {
  return knownSystemIcon(title) ?? (Sparkles as Icon);
}

/**
 * El icono dorado de un sistema, con el tamaño ajustado a cada dibujo: los redondos (carta astral y luna) algo
 * más pequeños para que pesen lo mismo que los demás. `scale` = 1 son unos 48 px.
 */
export function SystemIconMark({ icon: Icon, scale = 1, className = "" }: { icon: Icon; scale?: number; className?: string }) {
  const round = Icon === AstrologyIcon || Icon === MoonIcon;
  const own = round || Icon === HumanDesignIcon || Icon === GeneKeysIcon || Icon === EnergyIcon || Icon === OracleIcon || Icon === RuneIcon;
  const rem = (round ? 2.5 : Icon === EnergyIcon ? 2.75 : own ? 3 : 2.25) * scale;
  return <Icon aria-hidden className={`cp-gold shrink-0 ${className}`} style={{ width: `${rem}rem`, height: `${rem}rem` }} strokeWidth={own ? 1.05 : 1.4} />;
}
