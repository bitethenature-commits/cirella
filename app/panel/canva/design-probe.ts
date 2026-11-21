import { resolveTheme, themeAttrs, themeStyle, type Design, type DesignKey } from "@/lib/templates";

/**
 * Qué del diseño cambia de verdad una sección o un bloque de Mi página, para que su «Diseño» enseñe solo eso. Se
 * prueba sobre la propia web, sin que se vea: a la sección se le pone cada cambio (sus variables y sus interruptores,
 * como components/creator-page/design-scope.tsx), se mira si algo de dentro cambia (colores, bordes, sombras, letras,
 * esquinas…) y se deja como estaba, todo en el mismo instante y sin transiciones.
 */

/** Lo del fondo no va en las secciones (design-scope.tsx tampoco lo pone). */
const SKIP_VAR = /^(--c-paint|--bg-img-o|--decor-o|--fx-)/;
const SKIP_ATTR = new Set(["data-paint", "data-fx-always"]);

/** Lo que se mira de cada cosa de la sección (y de sus ::before y ::after, si los tiene). */
const PROPS = [
  "color",
  "background-color",
  "background-image",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "border-top-width",
  "border-top-style",
  "border-top-left-radius",
  "border-bottom-right-radius",
  "box-shadow",
  "outline-color",
  "outline-style",
  "font-family",
  "font-weight",
  "font-style",
  "font-size",
  "text-transform",
  "letter-spacing",
  "text-decoration-color",
  "fill",
  "stroke",
  "filter",
  "backdrop-filter",
  "aspect-ratio",
  "-webkit-mask-image",
];
const PSEUDO_PROPS = ["content", "display", "background-color", "background-image", "border-top-color", "border-top-left-radius", "box-shadow", "-webkit-mask-image", "color"];

/** Dos colores que nadie usa: si al cambiar de uno a otro algo cambia, ese color sale en la sección. */
const A = "#13579b";
const B = "#c2185b";

/** Lo de los títulos: si cambia su letra, salen todos. */
const TITLE_KEYS: DesignKey[] = ["fontDisplay", "displayWeight", "displayItalic", "displayUpper", "displaySize", "displaySpacing"];

type Raw = Record<string, string>;
type Probe = { keys: DesignKey[]; base: Partial<Design>; next: Partial<Design> } | { keys: DesignKey[]; raw: [Raw, Raw] };

const PROBES: Probe[] = [
  { keys: ["text"], base: { text: A }, next: { text: B } },
  { keys: ["muted"], base: { muted: A }, next: { muted: B } },
  { keys: ["accent"], base: { accent: A }, next: { accent: B } },
  { keys: ["accentText"], base: { accentText: A }, next: { accentText: B } },
  { keys: ["gold"], base: { gold: A }, next: { gold: B } },
  // Las letras, directamente (las de la lista se cargan aparte y quizá aún no estén).
  { keys: TITLE_KEYS, raw: [{ "--font-display": "serif" }, { "--font-display": "monospace" }] },
  { keys: ["fontBody"], raw: [{ "--font-body": "serif" }, { "--font-body": "monospace" }] },
  {
    keys: ["cardStyle", "cardCustom", "cardFrame"],
    base: { cardCustom: true, cardBg: A, cardBorder: A, cardBorderWidth: 1, cardShadow: "none", cardDouble: false },
    next: { cardCustom: true, cardBg: B, cardBorder: B, cardBorderWidth: 4, cardShadow: "glow", cardDouble: true },
  },
  {
    keys: ["btnCustom", "btnFrame"],
    base: { btnCustom: true, btnStyle: "filled", btnBg: A, btnText: B, btnBorder: A, btnBorderWidth: 1 },
    next: { btnCustom: true, btnStyle: "filled", btnBg: B, btnText: A, btnBorder: B, btnBorderWidth: 4 },
  },
  {
    keys: ["panelCustom", "panelStars", "panelGeo"],
    base: { panelCustom: true, panelBg: A, panelBorder: A, panelBorderWidth: 1 },
    next: { panelCustom: true, panelBg: B, panelBorder: B, panelBorderWidth: 4 },
  },
  { keys: ["imgRadius"], base: { imgCustom: true, imgRadius: 6 }, next: { imgCustom: true, imgRadius: 34 } },
  { keys: ["avatarShape"], base: { imgCustom: true, avatarShape: "circle" }, next: { imgCustom: true, avatarShape: "square" } },
  { keys: ["photoShape"], base: { imgCustom: true, photoShape: "rounded" }, next: { imgCustom: true, photoShape: "circle" } },
  { keys: ["photoFrame"], base: { imgCustom: true, photoFrame: "double" }, next: { imgCustom: true, photoFrame: "none" } },
];
const PHOTO_KEYS: DesignKey[] = ["imgRadius", "avatarShape", "photoShape", "photoFrame"];

type Css = { vars: Raw; attrs: Record<string, string | undefined> };

/** Las variables y los interruptores de un diseño, como los pone design-scope.tsx. */
function cssOf(d: Design): Css {
  const theme = resolveTheme(null, d, true);
  const vars: Raw = {};
  for (const [k, v] of Object.entries(themeStyle(theme) as Record<string, unknown>)) if (k.startsWith("--") && !SKIP_VAR.test(k)) vars[k] = String(v);
  const attrs: Css["attrs"] = {};
  for (const [k, v] of Object.entries(themeAttrs(theme))) if (!SKIP_ATTR.has(k)) attrs[k] = v;
  return { vars, attrs };
}

/**
 * Lo que cambia algo dentro de `root` (la caja de la sección en el Canva, con data-scope), con el diseño `eff` (el de
 * la página con lo propio de la sección encima). null si no se puede mirar.
 */
export function probeScope(root: HTMLElement, eff: Design): Set<DesignKey> | null {
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  if (!win) return null;
  // Donde van las variables: su diseño propio (si lo tiene) o la propia caja, como si lo tuviera.
  const target = root.querySelector<HTMLElement>(":scope > .cp-scope, :scope > .canva-body > .cp-scope") ?? root;
  const els = [target, ...Array.from(target.querySelectorAll<Element>("*"))]
    .filter((el) => !/^(LINK|STYLE|SCRIPT|BR|SOURCE|TEMPLATE)$/.test(el.tagName) && !el.closest("[data-canva-ui], [role='toolbar']"))
    .slice(0, 1500);
  if (els.length < 2) return new Set();

  const cur = cssOf(eff);
  const addClass = !target.classList.contains("cp-scope");
  const style = doc.createElement("style");
  style.textContent = "[data-design-probe], [data-design-probe] *, [data-design-probe] *::before, [data-design-probe] *::after { transition: none !important; }";
  doc.head.appendChild(style);
  target.setAttribute("data-design-probe", "");
  if (addClass) target.classList.add("cp-scope");

  /** Pone en la sección lo de `css` (lo que cambie respecto a lo de ahora) y devuelve cómo dejarla como estaba. */
  const apply = (css: Css) => {
    const undo: (() => void)[] = [];
    const setVar = (k: string, v: string) => {
      const old = target.style.getPropertyValue(k);
      const pri = target.style.getPropertyPriority(k);
      target.style.setProperty(k, v);
      undo.push(() => (old ? target.style.setProperty(k, old, pri) : target.style.removeProperty(k)));
    };
    for (const [k, v] of Object.entries(css.vars)) if (cur.vars[k] !== v) setVar(k, v);
    // Lo que el cambio quita (una variable que ya no lleva): como si no estuviera.
    for (const k of Object.keys(cur.vars)) if (!(k in css.vars)) setVar(k, "initial");
    for (const k of new Set([...Object.keys(css.attrs), ...Object.keys(cur.attrs)])) {
      const v = css.attrs[k];
      if (v === cur.attrs[k]) continue;
      const had = target.getAttribute(k);
      if (v === undefined) target.removeAttribute(k);
      else target.setAttribute(k, v);
      undo.push(() => (had === null ? target.removeAttribute(k) : target.setAttribute(k, had)));
    }
    return () => undo.reverse().forEach((f) => f());
  };

  // Qué cosas tienen ::before o ::after (solo esas se miran también por dentro).
  const pseudos = els.map((el) => (["::before", "::after"] as const).filter((p) => win.getComputedStyle(el, p).getPropertyValue("content") !== "none"));
  const readOne = (i: number) => {
    const el = els[i];
    const cs = win.getComputedStyle(el);
    let s = PROPS.map((p) => cs.getPropertyValue(p)).join("|");
    for (const p of pseudos[i]) {
      const ps = win.getComputedStyle(el, p);
      s += "#" + PSEUDO_PROPS.map((x) => ps.getPropertyValue(x)).join("|");
    }
    return s;
  };

  const css = (p: Probe, which: 0 | 1): Css => {
    if ("raw" in p) return { vars: { ...cur.vars, ...p.raw[which] }, attrs: cur.attrs };
    return cssOf({ ...eff, ...(which === 0 ? p.base : p.next) });
  };

  const found = new Set<DesignKey>();
  try {
    for (const p of PROBES) {
      const undoBase = apply(css(p, 0));
      const before = els.map((_, i) => readOne(i));
      undoBase();
      const undoNext = apply(css(p, 1));
      let changed = false;
      for (let i = 0; i < els.length && !changed; i++) changed = readOne(i) !== before[i];
      undoNext();
      if (changed) p.keys.forEach((k) => found.add(k));
    }
  } finally {
    // Todo como estaba (y leído, para que al quitar «sin transiciones» no se anime nada).
    if (addClass) target.classList.remove("cp-scope");
    void win.getComputedStyle(target).getPropertyValue("color");
    target.removeAttribute("data-design-probe");
    style.remove();
  }
  if (PHOTO_KEYS.some((k) => found.has(k))) found.add("imgCustom");
  return found;
}
