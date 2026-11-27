import { contrastRatio, mixHex, textOn } from "@/lib/colors";
import { EMAIL_FONTS, RADIUS_PX, type EmailStyle } from "@/lib/email-blocks";
import { cornerCss, patternCss } from "@/lib/email-patterns";
import { Tr } from "@/lib/i18n/client";

/**
 * Cómo se ve un look (fondo con geometría, tarjeta, títulos, texto, burbuja y botón), dibujado con CSS
 * al momento. «thumb»: miniatura con rayas en lugar de texto (para elegir). «full»: el creador de
 * plantillas, con un texto de muestra que no se guarda en ningún sitio.
 */
export function LookPreview({ style: s, brand, size = "thumb" }: { style: EmailStyle; brand?: string; size?: "thumb" | "full" }) {
  const full = size === "full";
  const radius = full ? RADIUS_PX[s.radius] : Math.round(RADIUS_PX[s.radius] / 2);
  const head = EMAIL_FONTS[s.headingFont].stack;
  const body = EMAIL_FONTS[s.bodyFont].stack;
  const border = mixHex(s.bg, s.text, 0.08);
  const corner = cornerCss({ bg: s.content, pattern: s.cornerPattern, patternColor: s.patternColor, patternStrength: s.patternStrength, pos: s.cornerPos });
  const bubble = patternCss({ bg: s.bubble, pattern: s.bubblePattern, patternColor: s.patternColor, patternStrength: s.patternStrength });
  const bar = (w: string, c: string, h = 5) => <span className="block rounded-full" style={{ width: w, height: h, background: c, opacity: 0.75 }} />;
  if (!full)
    return (
      <span className="block aspect-[4/3] w-full overflow-hidden" style={patternCss(s)} aria-hidden>
        <span className="mx-auto mt-[12%] block w-[64%] p-[7%] shadow-sm" style={{ backgroundColor: s.content, ...corner, backgroundSize: corner.backgroundImage ? "70% auto" : undefined, borderRadius: radius, border: `1px solid ${border}` }}>
          {bar("62%", s.heading, 7)}
          <span className="mt-2 block space-y-1">
            {bar("100%", s.text, 3)}
            {bar("84%", s.text, 3)}
          </span>
          <span className="mt-2 block rounded-[4px] p-1.5" style={{ ...bubble, backgroundSize: bubble.backgroundImage ? "50%" : undefined, borderLeft: `2px solid ${s.accent}` }}>
            {bar("70%", s.text, 3)}
          </span>
          <span className="mx-auto mt-2 block h-2.5 w-[46%] rounded-full" style={{ background: s.accent }} />
        </span>
      </span>
    );
  return (
    <div className="overflow-hidden rounded-3xl px-4 py-10 sm:px-10" style={patternCss(s)}>
      <div className="mx-auto" style={{ maxWidth: Math.min(s.width, 600) }}>
        <p className="mb-5 px-1 text-xl tracking-wide" style={{ fontFamily: head, color: contrastRatio(s.heading, s.bg) >= 3 ? s.heading : textOn(s.bg) }}>
          {brand || <Tr s={"Tu nombre"} />}
        </p>
        <div className="px-6 py-8 sm:px-9" style={{ backgroundColor: s.content, ...corner, borderRadius: radius, border: `1px solid ${border}`, color: s.text, fontFamily: body }}>
          <h3 className="text-[1.7rem] leading-tight" style={{ fontFamily: head, color: s.heading }}><Tr s={"Así se verán tus títulos"} /></h3>
          <p className="mt-4 text-[0.95rem] leading-relaxed"><Tr s={"Y así tu texto, con un"} />{" "}<span style={{ color: s.link, textDecoration: "underline" }}><Tr s={"enlace"} /></span>{" "}<Tr s={"en medio. Cada newsletter empieza vacía: escribes lo que quieras encima."} /></p>
          <div className="mt-5 rounded-xl px-5 py-4" style={{ ...bubble, borderLeft: `4px solid ${s.accent}`, borderRadius: Math.min(radius, 14) }}>
            <p className="text-lg" style={{ fontFamily: head, color: s.accent }}><Tr s={"✦ Una burbuja"} /></p>
            <p className="mt-1 text-sm leading-relaxed"><Tr s={"Para lo que quieres que destaque."} /></p>
          </div>
          <div className="mt-7 text-center">
            <span className="inline-block rounded-full px-6 py-3 text-xs font-bold uppercase tracking-[0.14em]" style={{ background: s.accent, color: textOn(s.accent) }}><Tr s={"Un botón"} /></span>
          </div>
        </div>
        <p className="mt-5 px-1 text-[0.7rem] leading-relaxed" style={{ color: mixHex(s.bg, textOn(s.bg), 0.6), fontFamily: body }}><Tr s={"Aquí abajo va solo el enlace para darse de baja y tus datos."} /></p>
      </div>
    </div>
  );
}
