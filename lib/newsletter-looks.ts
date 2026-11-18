/**
 * Looks de la newsletter: solo el aspecto (fondo con geometría, colores, burbujas, letras y esquinas),
 * nunca textos ya escritos. Al crear una newsletter con un look, el email empieza vacío. Las plantillas
 * propias (Newsletter › Plantillas) son looks que hace la dueña a su gusto. Puro.
 */
import { DEFAULT_EMAIL_STYLE, newBlock, readStyle, type EmailDesign, type EmailStyle } from "./email-blocks";

export type LookKey = "noche" | "flor" | "marfil" | "lavanda" | "bosque" | "rosa" | "medianoche" | "terracota";

const look = (s: Partial<EmailStyle>): EmailStyle => ({ ...DEFAULT_EMAIL_STYLE, ...s });

export const NEWSLETTER_LOOKS: { key: LookKey; name: string; style: EmailStyle }[] = [
  { key: "noche", name: "Noche y oro", style: look({ pattern: "estrellas", patternColor: "#D9BF8C", patternStrength: "m", headingFont: "cormorant" }) },
  {
    key: "flor",
    name: "Negra · Flor de la vida",
    style: look({ bg: "#050507", content: "#0E0D12", text: "#E6DCC6", heading: "#F0D9A4", link: "#D4B57A", accent: "#D4B57A", bubble: "#17151C", pattern: "flor", patternColor: "#D4B57A", patternStrength: "s", headingFont: "cormorant", bodyFont: "georgia" }),
  },
  {
    key: "marfil",
    name: "Marfil art déco",
    style: look({ bg: "#EFE7D8", content: "#FFFDF8", text: "#3B342C", heading: "#7A5A1E", link: "#8A6420", accent: "#B08A3E", bubble: "#F6EEDC", pattern: "rombos", patternColor: "#B08A3E", patternStrength: "m", headingFont: "playfair", bodyFont: "georgia", radius: "s" }),
  },
  {
    key: "lavanda",
    name: "Lavanda en ondas",
    style: look({ bg: "#E6E0F3", content: "#FFFFFF", text: "#3A3350", heading: "#54468A", link: "#6B58C4", accent: "#7A63B8", bubble: "#F1ECFA", pattern: "ondas", patternColor: "#7A63B8", patternStrength: "m", headingFont: "lora", bodyFont: "helvetica" }),
  },
  {
    key: "bosque",
    name: "Bosque y triángulos",
    style: look({ bg: "#0F2A24", content: "#F7F4EC", text: "#2E3A35", heading: "#1F4D40", link: "#2F6B57", accent: "#B8925A", bubble: "#ECEEE3", pattern: "triangulos", patternColor: "#B8925A", patternStrength: "m", headingFont: "cormorant", bodyFont: "georgia", radius: "m" }),
  },
  {
    key: "rosa",
    name: "Rosa empolvado y lunas",
    style: look({ bg: "#F2E2DF", content: "#FFFBFA", text: "#4A3A3A", heading: "#8E4F52", link: "#A8625F", accent: "#C4877A", bubble: "#F9ECE8", pattern: "lunas", patternColor: "#C4877A", patternStrength: "m", headingFont: "playfair", bodyFont: "georgia" }),
  },
  {
    key: "medianoche",
    name: "Medianoche en panal",
    style: look({ bg: "#0B1830", content: "#101F3D", text: "#DCE3F0", heading: "#E8D3A2", link: "#C9A86A", accent: "#C9A86A", bubble: "#172A50", pattern: "panal", patternColor: "#C9A86A", patternStrength: "s", headingFont: "montserrat", bodyFont: "helvetica", radius: "m" }),
  },
  {
    key: "terracota",
    name: "Terracota en abanicos",
    style: look({ bg: "#5A2E20", content: "#FBF5EE", text: "#3D2B22", heading: "#A2522F", link: "#A2522F", accent: "#C2703D", bubble: "#F6E7DA", pattern: "abanicos", patternColor: "#E8B48A", patternStrength: "s", headingFont: "lora", bodyFont: "georgia" }),
  },
];

/** Una newsletter nueva con un aspecto: el estilo y dos huecos vacíos (título y texto) para escribir. */
export function lookDesign(style: unknown): EmailDesign {
  const s = readStyle(style);
  return { v: 1, style: s, blocks: [newBlock("title", s), newBlock("text", s)] };
}

/** Solo el aspecto de un diseño (para guardar una plantilla). */
export function styleOnly(design: unknown): EmailDesign {
  const raw = design && typeof design === "object" ? (design as { style?: unknown }).style : undefined;
  return { v: 1, style: readStyle(raw), blocks: [] };
}
