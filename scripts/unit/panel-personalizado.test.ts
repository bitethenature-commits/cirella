/**
 * «Personalizar mi panel» (Ajustes): colores del panel como variables CSS (con texto legible sobre
 * el acento y las pestañas), lectura tolerante de lo guardado y orden/visibilidad del menú (cada sección en
 * su borde del panel).
 */
import { frameSlot, panelNav, panelNavFor } from "../../app/panel/nav-items";
import { contrastRatio } from "../../lib/colors";
import { EMPTY_PANEL_PREFS, orderNav, panelSideVars, parsePanelPrefs, readPanelPrefs } from "../../lib/panel-prefs";
import { eq, ok, test } from "./harness";

const FLAGS = { personal: true, sales: false, showBookings: true };

test("un orden guardado antes de Cursos y Comunidad: las dos salen al final", () => {
  const before = panelNav(FLAGS).filter((i) => i.href !== "/panel/cursos" && i.href !== "/panel/comunidad").map((i) => i.href);
  const nav = { order: before, hidden: [] };
  eq(panelNavFor(FLAGS, nav).map((i) => i.href).slice(-2), ["/panel/cursos", "/panel/comunidad"]);
});

test("sin preferencias: ninguna variable (el panel de siempre) y el menú de siempre", () => {
  eq(panelSideVars(null), {});
  eq(readPanelPrefs(null), EMPTY_PANEL_PREFS);
  eq(readPanelPrefs("basura"), EMPTY_PANEL_PREFS);
  eq(panelNavFor(FLAGS, null), panelNav(FLAGS));
});

test("la barra del menú con su texto legible", () => {
  for (const side of ["#0B0E1F", "#EFE9FA", "#FFFFFF", "#B4583F"]) {
    const v = panelSideVars(side);
    ok(contrastRatio(v["--panel-side-text"], v["--panel-side-bg"]) >= 4.5, side);
  }
});

test("lo guardado: colores solo hex, Inicio y Ajustes nunca ocultos, rutas del panel y tarjetas conocidas", () => {
  const p = readPanelPrefs({
    design: { background: "#aabbcc", decor: "nada", cardFrame: "vine" },
    sidebar: "url(x)",
    nav: { order: ["/panel/newsletter", "/panel", "https://evil.io", "/panel/newsletter"], hidden: ["/panel", "/panel/ajustes", "/panel/codigos"] },
    home: ["atajos", "nada", "resumen"],
  });
  eq(p.design, { background: "#aabbcc", cardFrame: "vine" });
  eq(p.sidebar, null);
  eq(p.nav, { order: ["/panel/newsletter", "/panel"], hidden: ["/panel/codigos"] });
  ok(!parsePanelPrefs({ sidebar: "javascript:x" }).ok);
  ok(parsePanelPrefs({ design: null, sidebar: null, nav: null, home: [] }).ok);
  eq(readPanelPrefs({ design: {} }).design, null);
});

test("orden del menú: su orden, ocultas fuera, nuevas en su sitio de siempre", () => {
  const items = [{ href: "/panel" }, { href: "/panel/a" }, { href: "/panel/b" }, { href: "/panel/c" }, { href: "/panel/ajustes" }];
  const r = orderNav(items, { order: ["/panel/c", "/panel", "/panel/ajustes", "/panel/a"], hidden: ["/panel/a", "/panel"] });
  eq(r.visible.map((i) => i.href), ["/panel/c", "/panel", "/panel/ajustes", "/panel/b"]);
  // /panel/b no estaba en su orden: va al final.
  eq([...r.visible, ...r.hidden].map((i) => i.href).sort(), items.map((i) => i.href).sort());
  eq(r.hidden.map((i) => i.href), ["/panel/a"]);
  ok(r.visible.some((i) => i.href === "/panel"), "Inicio no se oculta");
});

test("cada sección en su borde: lo que ofrece a la izquierda, Personas y Newsletter abajo a la izquierda, lo demás en Ajustes", () => {
  const slot = (s: string) => panelNav(FLAGS).filter((i) => frameSlot(i) === s).map((i) => i.href);
  eq(slot("home"), ["/panel"]);
  eq(slot("left"), ["/panel/comunidad", "/panel/circulos", "/panel/cursos", "/panel/sesiones", "/panel/portal"]);
  eq(slot("corner"), ["/panel/clientes", "/panel/newsletter"]);
  eq(slot("settings"), ["/panel/modelos", "/panel/barajas", "/panel/ajustes"]);
  const nav = { order: [], hidden: ["/panel/cursos"] };
  ok(!panelNavFor(FLAGS, nav).some((i) => i.href === "/panel/cursos"), "oculta, también en su borde");
});
