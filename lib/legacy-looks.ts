import type { CardStyle, Decor, Design } from "./templates";

/**
 * Los diseños de las antiguas plantillas de fábrica, solo para pasar a «diseño propio» las páginas que se
 * guardaron con una (lib/page-config.ts, readPageConfig): así se siguen viendo igual. Ya no se pueden elegir.
 */
type Look = { c: { bg: string; bg2: string; text: string; accent: string; accentText: string; gold: string }; f: string; r: string; k: CardStyle; d: Decor };

const LOOKS: Record<string, Look> = 
{"mystical":{"c":{"bg":"#0B0E1F","bg2":"#1A1D3D","text":"#F3ECDD","accent":"#C9BBF2","accentText":"#0B0E1F","gold":"#D9BF8C"},"f":"classic","r":"round","k":"glass","d":"stars"},"minimal":{"c":{"bg":"#F4F1EA","bg2":"#E8E2D4","text":"#2B2F27","accent":"#6F8766","accentText":"#FFFFFF","gold":"#B39A6B"},"f":"serene","r":"soft","k":"solid","d":"none"},"luxury":{"c":{"bg":"#F7F3EC","bg2":"#EDE5D8","text":"#15130F","accent":"#15130F","accentText":"#F7F3EC","gold":"#A8844E"},"f":"luxury","r":"sharp","k":"outline","d":"lines"},"cosmic":{"c":{"bg":"#05050B","bg2":"#16102E","text":"#EEEDFF","accent":"#A594FF","accentText":"#05050B","gold":"#7DE3EC"},"f":"modern","r":"round","k":"glass","d":"aurora"},"editorial":{"c":{"bg":"#F7EEE7","bg2":"#EED9CC","text":"#3B2521","accent":"#B4583F","accentText":"#FFFFFF","gold":"#C59A6A"},"f":"editorial","r":"soft","k":"editorial","d":"grain"},"tierra":{"c":{"bg":"#EFE6D8","bg2":"#E2D3BC","text":"#4A2E20","accent":"#6B6B2E","accentText":"#FFFFFF","gold":"#C0892F"},"f":"editorial","r":"soft","k":"solid","d":"grain"},"oceano":{"c":{"bg":"#071A2B","bg2":"#0F3047","text":"#F1E9DA","accent":"#7FB8C9","accentText":"#071A2B","gold":"#D8C39A"},"f":"serene","r":"round","k":"glass","d":"none"},"cuarzo":{"c":{"bg":"#F8ECEC","bg2":"#EFD6D6","text":"#4A2C34","accent":"#C77D8C","accentText":"#FFFFFF","gold":"#B8925A"},"f":"classic","r":"round","k":"solid","d":"none"},"bosque":{"c":{"bg":"#0F1F18","bg2":"#1C3328","text":"#F2EBDC","accent":"#9CB88A","accentText":"#0F1F18","gold":"#D4B97A"},"f":"classic","r":"soft","k":"glass","d":"none"},"medianoche":{"c":{"bg":"#0A0907","bg2":"#1C1810","text":"#F5EFE2","accent":"#D4AF6A","accentText":"#0A0907","gold":"#E3C88A"},"f":"luxury","r":"sharp","k":"outline","d":"lines"},"fugaces":{"c":{"bg":"#070B1C","bg2":"#141A3A","text":"#EEF0FF","accent":"#9DB4FF","accentText":"#070B1C","gold":"#F2D58F"},"f":"classic","r":"round","k":"glass","d":"shooting"},"polvo":{"c":{"bg":"#15110B","bg2":"#2A2114","text":"#F6EEDC","accent":"#E0B65C","accentText":"#15110B","gold":"#F0D08A"},"f":"luxury","r":"sharp","k":"outline","d":"golddust"},"luciernagas":{"c":{"bg":"#0B1610","bg2":"#16281D","text":"#EEF2E2","accent":"#C8E07A","accentText":"#0B1610","gold":"#E9D98A"},"f":"serene","r":"soft","k":"glass","d":"fireflies"},"olas":{"c":{"bg":"#EEF5F6","bg2":"#D6E7EA","text":"#183A47","accent":"#2F7E95","accentText":"#FFFFFF","gold":"#C2A36E"},"f":"serene","r":"round","k":"solid","d":"waves"},"petalos":{"c":{"bg":"#FBF1EF","bg2":"#F3DCD8","text":"#4B2930","accent":"#C2566E","accentText":"#FFFFFF","gold":"#C79B6B"},"f":"editorial","r":"round","k":"editorial","d":"petals"},"luna":{"c":{"bg":"#0A0E22","bg2":"#1A2042","text":"#F2EEE2","accent":"#C9C6E8","accentText":"#0A0E22","gold":"#E8D7A8"},"f":"classic","r":"round","k":"glass","d":"moon"},"nebulosa":{"c":{"bg":"#120A22","bg2":"#2A1440","text":"#F6ECFA","accent":"#E79AD0","accentText":"#120A22","gold":"#C9B2FF"},"f":"modern","r":"round","k":"glass","d":"nebula"},"constelaciones":{"c":{"bg":"#060A18","bg2":"#111A33","text":"#E9EEFA","accent":"#8FB3E8","accentText":"#060A18","gold":"#E9CF8E"},"f":"luxury","r":"sharp","k":"outline","d":"constellation"},"otono":{"c":{"bg":"#F6EADB","bg2":"#EBD3B8","text":"#47291A","accent":"#B5532A","accentText":"#FFFFFF","gold":"#C48A2E"},"f":"editorial","r":"soft","k":"solid","d":"leaves"},"niebla":{"c":{"bg":"#E6ECE4","bg2":"#D3DECF","text":"#2D3A30","accent":"#5E7D63","accentText":"#FFFFFF","gold":"#A99668"},"f":"serene","r":"soft","k":"solid","d":"mist"},"nieve":{"c":{"bg":"#0E1C30","bg2":"#1C3150","text":"#EEF3FA","accent":"#A9C6E8","accentText":"#0E1C30","gold":"#DCE6F2"},"f":"classic","r":"round","k":"glass","d":"snow"},"burbujas":{"c":{"bg":"#0D1530","bg2":"#1D2550","text":"#F1F0FF","accent":"#9FE3E6","accentText":"#0D1530","gold":"#F2B8E6"},"f":"modern","r":"round","k":"glass","d":"bubbles"},"velas":{"c":{"bg":"#140D08","bg2":"#2A1C12","text":"#F5E9D6","accent":"#E8A651","accentText":"#140D08","gold":"#F2C879"},"f":"classic","r":"soft","k":"glass","d":"candles"},"mandala":{"c":{"bg":"#160F1E","bg2":"#2B1E38","text":"#F4ECE0","accent":"#D6A85C","accentText":"#160F1E","gold":"#E6C27E"},"f":"luxury","r":"round","k":"outline","d":"mandala"},"lluvia":{"c":{"bg":"#1E2830","bg2":"#2E3B46","text":"#ECF0F2","accent":"#9DB7C7","accentText":"#1E2830","gold":"#D2C3A2"},"f":"serene","r":"soft","k":"glass","d":"rain"},"reflejos":{"c":{"bg":"#04222B","bg2":"#0A3A47","text":"#E6F6F5","accent":"#6FD3D0","accentText":"#04222B","gold":"#CDEFD8"},"f":"serene","r":"round","k":"glass","d":"caustics"},"desierto":{"c":{"bg":"#F3E4CC","bg2":"#E7CFA7","text":"#4A3020","accent":"#B8743A","accentText":"#FFFFFF","gold":"#C99A4E"},"f":"editorial","r":"sharp","k":"solid","d":"haze"}}
;

const PAIRS: Record<string, Pick<Design, "fontDisplay" | "fontBody" | "displayWeight">> = {
  classic: { fontDisplay: "cormorant", fontBody: "inter", displayWeight: 500 },
  editorial: { fontDisplay: "fraunces", fontBody: "inter", displayWeight: 400 },
  luxury: { fontDisplay: "bodoni", fontBody: "manrope", displayWeight: 500 },
  modern: { fontDisplay: "syne", fontBody: "inter", displayWeight: 600 },
  serene: { fontDisplay: "instrument", fontBody: "dmsans", displayWeight: 400 },
};

/** El diseño completo de una plantilla antigua con los cambios que se le hicieron (null si no era una). */
export function legacyDesign(template: unknown, old: unknown): Design | null {
  if (typeof template !== "string" || !(template in LOOKS)) return null;
  const l = LOOKS[template];
  const o = (old && typeof old === "object" ? old : {}) as Record<string, unknown>;
  const str = (k: string) => (typeof o[k] === "string" && o[k] ? (o[k] as string) : null);
  const accent = str("accent");
  const background = str("background");
  return {
    background: background ?? l.c.bg,
    bg2: background ?? l.c.bg2,
    text: str("text") ?? l.c.text,
    accent: accent ?? l.c.accent,
    accentText: accent ? null : l.c.accentText,
    gold: l.c.gold,
    ...(PAIRS[str("fontPair") ?? l.f] ?? PAIRS.classic),
    radius: str("radius") ?? l.r,
    cardStyle: l.k,
    decor: l.d,
    backgroundImageUrl: str("backgroundImageUrl"),
  };
}
